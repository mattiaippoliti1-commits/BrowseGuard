const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { assessBrowserState } = require('../../modules/assessment/assessment-engine');
const { present } = require('../../popup/presentation');
const { validate } = require('./validate.cjs');
const { readUrls, configFromArgs, idFor } = require('./config.cjs');
const { redact, atomicJson } = require('./storage.cjs');
const { report, csvCell } = require('./report.cjs');
const { capturePopupAssessment, selectedHeaders } = require('./collect.cjs');
function baseline() {
  const inputs = structuredClone(require('../../tests/fixtures/governo-historical.json'));
  inputs.networkActivity = { available:true,totalRequests:1,firstPartyRequests:1,thirdPartyRequests:0,thirdPartyDomainCount:0,
    sameEntityThirdPartyRequests:0,externalThirdPartyRequests:0,unknownThirdPartyRequests:0,
    sameEntityThirdPartyDomainCount:0,externalThirdPartyDomainCount:0,unknownThirdPartyDomainCount:0,
    trackerRequests:0,trackerDomainCount:0,resourceTypes:{main_frame:1},thirdPartyDomains:[],trackerDomains:[],
    sameEntityThirdPartyDomains:[],externalThirdPartyDomains:[],unknownThirdPartyDomains:[] };
  const assessment=assessBrowserState(inputs), view=present(assessment,inputs.networkActivity);
  return { id:idFor('https://example.com/'),url:'https://example.com/',status:'ok',durationMs:5, navigation:{},
    extension:{inputs,assessment,renderedAssessment:structuredClone(assessment),displayed:Object.fromEntries(
      ['security','privacy','network'].map(d=>[d,{label:view.cards[d].label,state:view.cards[d].state}]))}, independent:{responses:[]}, anomalies:[] };
}
const codes = r => validate(r).map(a=>a.code);
test('coherent snapshot passes without requiring CDP counts to equal extension counts',()=>{
  const r=baseline();r.independent.totalRequests=999;assert.deepEqual(validate(r),[]);
});
test('impossible metrics, request partitions and tracker boundary have evidence',()=>{
  const r=baseline(); r.extension.inputs.networkActivity.totalRequests=-1;
  r.extension.inputs.networkActivity.trackerDomains=[{hostname:'notexample.com',matchedDomain:'example.com',requestCount:1}];
  const anomalies=validate(r);for(const code of ['invalid_metric','request_partition','tracker_domain_boundary']) assert.ok(anomalies.some(a=>a.code===code&&a.evidence));
});
test('captured engine tampering and rendered/UI divergence are detected',()=>{
  const r=baseline();r.extension.assessment.security.level='attention';r.extension.displayed.privacy.label='High';
  for(const c of ['engine_replay_mismatch','rendered_assessment_mismatch','presentation_mismatch','security_rule_contract']) assert.ok(codes(r).includes(c));
});
test('missing analysis and blocked navigation are not labelled confirmed bugs',()=>{
  const r=baseline();r.extension=null;r.navigation.blocked={httpStatus:429};
  const a=validate(r); assert.ok(a.some(x=>x.code==='missing_analysis'));assert.ok(a.every(x=>x.classification==='potential-anomaly'));
});
test('header comparisons require final same-URL main-document evidence',()=>{
  const r=baseline(); r.navigation.finalUrl='https://example.com/';
  r.independent.responses=[{url:'https://other.test/',topFrame:true,type:'Document',headers:{'content-security-policy':"default-src 'self'"}}];
  assert.ok(!codes(r).includes('header_presence_difference'));
  r.independent.responses[0].url=r.navigation.finalUrl;
  assert.ok(codes(r).includes('header_presence_difference'));
});
test('capture wraps only the original popup engine call and preserves output identity',()=>{
  const sandbox={location:{protocol:'chrome-extension:'}, output:{a:1}};vm.createContext(sandbox);
  vm.runInContext('('+capturePopupAssessment.toString()+')()',sandbox);
  vm.runInContext('globalThis.BrowserGuardAssessmentEngine={assessBrowserState:()=>output}; globalThis.result=BrowserGuardAssessmentEngine.assessBrowserState({networkActivity:{totalRequests:2}})',sandbox);
  assert.equal(sandbox.result,sandbox.output);assert.equal(sandbox.__browserguardTestCapture.inputs.networkActivity.totalRequests,2);
  assert.equal(selectedHeaders({'Set-Cookie':'secret',Authorization:'secret','Content-Security-Policy':"default-src 'self'"})['set-cookie'],undefined);
});
test('redaction drops URL credentials, queries, fragments recursively without altering host evidence',()=>{
  assert.deepEqual(redact({url:'https://user:password@example.com/path?token=secret#fragment',other:['https://a.test/?secret=1']}),
    {url:'https://example.com/path',other:['https://a.test/']});
});
test('1000 unique URLs accepted, duplicate short corpora refused and unsupported URLs rejected',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg-config-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'urls.txt');fs.writeFileSync(file,Array.from({length:1000},(_,i)=>`https://site${i}.test/`).join('\n'));
  assert.equal(readUrls(file,1000).length,1000);assert.equal(new Set(readUrls(file,1000)).size,1000);
  assert.throws(()=>readUrls(file,1001),/only 1000/);
  assert.throws(()=>configFromArgs(['--urls',file,'--concurrency','0']),/positive integer/);
  fs.writeFileSync(file,'file:///etc/passwd');assert.throws(()=>readUrls(file,1),/HTTP/);
});
test('reports include all records, distributions, failures and escaped hostile evidence',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg-report-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'records'));atomicJson(path.join(dir,'manifest.json'),{startedAt:'test',sourceHash:'x'});
  const r=baseline();r.anomalies=[{code:'sample',evidence:'<script>alert(1)</script>',investigation:'Inspect locally'}];
  atomicJson(path.join(dir,'records',r.id+'.json'),r);
  const stats=await report(dir);assert.equal(stats.websitesTested,1);assert.equal(stats.successfulAnalyses,1);assert.equal(stats.networkAverageSampleCount,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'dataset.json'))).length,1);
  const html=fs.readFileSync(path.join(dir,'report.html'),'utf8');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.match(csvCell('=1+1'),/^"'/);
});
test('reports retain 1000 unique completed entries and correct success/failure denominators',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg-thousand-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'records'));atomicJson(path.join(dir,'manifest.json'),{startedAt:'synthetic-capacity-check',sourceHash:'x'});
  for(let i=0;i<1000;i++){
    const url=`https://capacity-${i}.test/`,id=idFor(url);
    atomicJson(path.join(dir,'records',id+'.json'),{id,url,status:i%10===0?'collection-error':'ok',durationMs:10,
      extension:i%10===0?null:{assessment:{},displayed:{security:{label:'Low'},privacy:{label:'Moderate'},network:{label:'—'}},
        inputs:{networkActivity:{available:true,totalRequests:5,trackerDomainCount:1}}},anomalies:[]});
  }
  const s=await report(dir);assert.equal(s.websitesTested,1000);assert.equal(s.successfulAnalyses,900);assert.equal(s.failedAnalyses,100);
  assert.equal(s.averageObservedRequests,5);assert.equal(s.networkAverageSampleCount,900);assert.equal(s.security.missing,100);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'dataset.json'))).length,1000);
});
test('AI CLI refuses a remote endpoint without explicit authorization before reading a packet',()=>{
  const {spawnSync}=require('node:child_process');
  const p=spawnSync(process.execPath,[path.join(__dirname,'ai.cjs'),'--run','does-not-exist','--model','test','--endpoint','https://example.com/api/generate'],{encoding:'utf8'});
  assert.equal(p.status,1);assert.match(p.stderr,/requires an explicit endpoint AND --authorize-external-ai/);
});
