"""Small synthetic fixtures; no browser, original-data edits, or network access."""
from __future__ import annotations
import copy
import hashlib
import json
from pathlib import Path
import re
import socket
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
import pandas as pd
from PIL import Image
from analyze import analyze
from data import HEADERS, SchemaError, load_benchmark
from metrics import compute, describe


def record(identifier, status='ok', *, domains=0, requests=0, duration=1000, presence=True):
    url=f'https://{identifier}.test/'
    headers={name.lower():"observed" for name in HEADERS} if presence else {}
    return {'schemaVersion':1,'id':identifier,'url':url,'status':status,'durationMs':duration,
        'navigation':{'httpStatus':403 if status=='blocked' else 200,'finalUrl':url,
                      **({'blocked':{'httpStatus':403}} if status=='blocked' else {})},
        'extension':{'assessment':{'dataStatus':'partial' if status=='partial' else 'complete','missingSources':['runtimePrivacy'] if status=='partial' else []},
            'displayed':{dim:{'label':'Low'} for dim in ['security','privacy','network']},
            'inputs':{'networkActivity':{'available':True,'totalRequests':5,'trackerDomainCount':domains,'trackerRequests':requests},
                'webSecurity':{'available':True,'headers':{key:{'present':presence} for key in HEADERS.values()},
                               'https':{'enabled':True},'mixedContent':{'requestCount':0}}},'errors':[]},
        'independent':{'totalRequests':4,'droppedRequests':0,
            'requests':[{'type':'Document','url':url,'topFrame':True,'timestamp':1}],
            'responses':[{'type':'Document','url':url,'topFrame':True,'redirect':False,'headers':headers}]},
        'anomalies':[{'code':'access_restriction'}] if status=='blocked' else []}


def write_fixture(root, rows, *, categories=True):
    root.mkdir(parents=True,exist_ok=True)
    (root/'dataset.json').write_text(json.dumps(rows))
    if categories:
        (root/'provenance.json').write_text(json.dumps([{'id':r['id'],'category':'Synthetic category'} for r in rows]))
    return root


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
    def tearDown(self):
        self.temp.cleanup()
    def load(self,rows,**kwargs):
        return load_benchmark(write_fixture(self.root/'input',rows,**kwargs))
    def test_loading_and_population_separation(self):
        normal=record('normal',domains=2);blocked=record('blocked','blocked',domains=99);partial=record('partial','partial',domains=0)
        benchmark=self.load([normal,blocked,partial]);tables=compute(benchmark)
        totals=tables['reliability_summary'].set_index('metric').value
        self.assertEqual(totals['total_urls'],3);self.assertEqual(totals['assessments_captured'],3)
        self.assertEqual(totals['successful'],2);self.assertEqual(totals['restricted'],1);self.assertEqual(totals['partial_assessments'],1)
        tracking=tables['tracking_statistics'];selected=tracking[(tracking.population=='successful')&(tracking.category=='All categories')&(tracking.metric=='tracker_domains')].iloc[0]
        self.assertEqual(selected['mean'],1);self.assertEqual(selected['max'],2)
    def test_missing_is_not_zero_and_unavailable_is_not_missing(self):
        a=record('one',domains=None,requests=None);a['extension']['displayed']['network']['label']='—'
        b=record('two',domains=0);del b['extension']['displayed']['network']
        benchmark=self.load([a,b]);tables=compute(benchmark)
        stats=tables['tracking_statistics'];stats=stats[(stats.population=='successful')&(stats.category=='All categories')&(stats.metric=='tracker_domains')].iloc[0]
        self.assertEqual(stats['n'],1);self.assertEqual(stats['missing'],1);self.assertEqual(stats['mean'],0)
        dist=tables['assessment_distribution'];dist=dist[(dist.population=='successful')&(dist.dimension=='network')].set_index('level')
        self.assertEqual(dist.loc['Unavailable','count'],1);self.assertEqual(dist.loc['Missing','count'],1)
        self.assertEqual(dist.loc['Unavailable','percent'],50)
    def test_header_denominators_and_unknown_flags(self):
        a=record('present',presence=True);b=record('absent',presence=False);c=record('unknown')
        c['extension']['inputs']['webSecurity']['headers']['csp']['present']=None
        tables=compute(self.load([a,b,c]));h=tables['header_presence'];h=h[(h.population=='successful')&(h.header=='Content-Security-Policy')].iloc[0]
        self.assertEqual((h.present,h.absent,h.not_evaluable,h.valid_denominator),(1,1,1,2));self.assertEqual(h.presence_pct_valid,50)
    def test_no_matching_http_response_is_not_header_absence(self):
        a=record('moved');a['navigation']['finalUrl']='https://moved.test/new-route'
        b=record('error','navigation-error');b['navigation']={'error':'net::ERR_HTTP2_PROTOCOL_ERROR','finalUrl':'chrome-error://chromewebdata/'}
        tables=compute(self.load([a,b]));h=tables['header_presence'];h=h[(h.population=='all')&(h.header=='Strict-Transport-Security')].iloc[0]
        self.assertEqual(h.valid_denominator,0);self.assertEqual(h.not_evaluable,2);self.assertTrue(pd.isna(h.presence_pct_valid))
        self.assertEqual(tables['cdp_agreement'].eligible.sum(),0)
    def test_precise_percentages_and_sample_percentiles(self):
        tables=compute(self.load([record('a'),record('b'),record('c','blocked')]))
        self.assertAlmostEqual(tables['reliability_by_category'].iloc[0].success_pct,100*2/3)
        stats=describe([1,2,3,4],4)
        self.assertEqual(stats['median'],2.5);self.assertEqual(stats['q1'],1.75)
        self.assertAlmostEqual(stats['p90'],3.7);self.assertAlmostEqual(stats['p95'],3.85)
        self.assertAlmostEqual(stats['std_sample'],(5/3)**.5)
        self.assertIsNone(describe([1],1)['std_sample'])
    def test_schema_validation_and_duplicate_ids(self):
        with self.assertRaises(SchemaError):self.load([record('same'),record('same')])
        bad=record('invalid',domains=-1)
        with self.assertRaises(SchemaError):self.load([bad])
        with self.assertRaises(SchemaError):load_benchmark(write_fixture(self.root/'malformed',[{'status':'ok'}],categories=False))
    def test_raw_records_directory_and_future_corpus_sizes(self):
        source=self.root/'future';(source/'records').mkdir(parents=True)
        for i in range(13):(source/'records'/f'{i:03}.json').write_text(json.dumps(record(f'future-{i}')))
        benchmark=load_benchmark(source);self.assertEqual(len(benchmark.attempts),13)
        self.assertEqual(benchmark.attempts.category.unique().tolist(),['Uncategorized'])
        self.assertTrue(benchmark.notices);self.assertEqual(int(compute(benchmark)['reliability_summary'].set_index('metric').loc['successful','value']),13)
    def test_category_mapping_and_no_assumption_of_confirmed_bugs(self):
        root=write_fixture(self.root/'mapped',[record('mapped')],categories=False)
        mapping=self.root/'mapping.csv';mapping.write_text('id,category,label\nmapped,education,Education\n')
        benchmark=load_benchmark(root,mapping);self.assertEqual(benchmark.attempts.iloc[0].category,'Education')
        summary=compute(benchmark)['reliability_summary'].set_index('metric')
        self.assertTrue(pd.isna(summary.loc['documented_extension_bugs','value']))
    def test_review_annotations_checked_against_original_events(self):
        root=write_fixture(self.root/'review',[record('restricted','blocked')])
        (root/'reviewed-anomalies.json').write_text(json.dumps([{'websiteId':'restricted','code':'access_restriction'}]))
        (root/'validator-false-positives.json').write_text('[]')
        tables=compute(load_benchmark(root));self.assertEqual(tables['anomaly_summary'].iloc[0].reviewed_events,1)
        (root/'reviewed-anomalies.json').write_text(json.dumps([{'websiteId':'restricted','code':'invented'}]))
        with self.assertRaises(SchemaError):load_benchmark(root)
    def test_capped_mixed_content_does_not_claim_concordance(self):
        a=record('capped');a['independent']['droppedRequests']=4
        tables=compute(self.load([a]));s=tables['cdp_agreement'];mixed=s[(s.population=='all')&(s.measurement=='mixed_content')].iloc[0]
        self.assertEqual(mixed.eligible,0)
    def test_generation_is_offline_deterministic_and_publishable(self):
        rows=[record('one',domains=1,requests=2),record('two','blocked',domains=80),record('three','partial',domains=None)]
        rows[0]['url']='https://private.test/?token=SECRET_TOKEN';rows[0]['extension']['errors']=['secret local error SECRET_TOKEN']
        source=write_fixture(self.root/'raw',rows);original=(source/'dataset.json').read_bytes()
        first,second=self.root/'publication-one',self.root/'publication-two'
        with patch.object(socket,'socket',side_effect=AssertionError('Network forbidden')):
            analyze(source,first);analyze(source,second)
        self.assertEqual(original,(source/'dataset.json').read_bytes())
        for name in ['assessment_distribution','benchmark_reliability','tracking_activity','security_headers','cdp_comparison','benchmark_performance']:
            for ext in ['png','svg']:
                file=first/'figures'/f'{name}.{ext}'
                self.assertTrue(file.exists());self.assertEqual(file.read_bytes(),(second/'figures'/file.name).read_bytes())
                if ext=='png':
                    with Image.open(file) as img:self.assertAlmostEqual(img.info['dpi'][0],300,delta=1)
                else:ET.parse(file)
        for file in first.rglob('*'):
            if file.is_file():
                self.assertIn(file.suffix,{'.md','.csv','.png','.svg'})
                if file.suffix in {'.md','.csv','.svg'}:
                    text=file.read_text();self.assertNotIn('SECRET_TOKEN',text);self.assertNotIn('private.test',text)
                    self.assertNotIn(str(self.root),text)
        report=first/'BENCHMARK_ANALYSIS.md';text=report.read_text()
        self.assertNotIn('runs/',text.replace('`runs/`',''))
        for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',text):self.assertTrue((report.parent/link).exists(),link)
        self.assertEqual(report.read_bytes(),(second/report.name).read_bytes())
    def test_zero_success_and_all_missing_durations_generate_honest_placeholders(self):
        a=record('failed','collection-error',duration=None);a['extension']=None;a['collectionError']='Timeout'
        source=write_fixture(self.root/'no-success',[a]);benchmark,tables=analyze(source,self.root/'empty-publication')
        self.assertEqual(int(benchmark.attempts.successful.sum()),0)
        self.assertTrue((self.root/'empty-publication/figures/cdp_comparison.png').exists())
        self.assertIn('— s',(self.root/'empty-publication/BENCHMARK_ANALYSIS.md').read_text())
    def test_output_cannot_overlap_original_data(self):
        source=write_fixture(self.root/'input',[record('one')])
        with self.assertRaises(SchemaError):analyze(source,source/'publication')

if __name__=='__main__':
    unittest.main()
