"""Read-only normalization of real runner records and optional offline review files."""
from __future__ import annotations
from collections import Counter
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import re
import pandas as pd

DIMENSIONS = ('security', 'privacy', 'network')
LEVELS = ('Low', 'Moderate', 'High', 'Unavailable', 'Missing')
HEADERS = {
    'Content-Security-Policy': 'csp', 'Strict-Transport-Security': 'hsts',
    'X-Content-Type-Options': 'contentTypeOptions', 'Referrer-Policy': 'referrerPolicy',
    'Permissions-Policy': 'permissionsPolicy',
}

class SchemaError(ValueError):
    pass

@dataclass
class Benchmark:
    attempts: pd.DataFrame
    headers: pd.DataFrame
    comparisons: pd.DataFrame
    anomalies: pd.DataFrame
    review: dict
    metadata: dict
    integrity: list[dict]
    notices: list[str]


def obj(value):
    return value if isinstance(value, dict) else {}


def number(value, field, *, count=True):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or (count and not float(value).is_integer()):
        raise SchemaError(f'{field}: expected a finite nonnegative {"integer" if count else "number"}')
    return int(value) if count else float(value)


def level(value):
    if value in (None, ''):
        return 'Missing'
    if value in ('—', '-', 'Unavailable'):
        return 'Unavailable'
    if value not in LEVELS:
        raise SchemaError('Unknown displayed assessment label')
    return value


def read_json(path, integrity, *, required=False):
    if not path.exists():
        if required:
            raise SchemaError(f'Missing required file: {path.name}')
        return None
    content = path.read_bytes()
    integrity.append({'source': path.name, 'sha256': hashlib.sha256(content).hexdigest()})
    try:
        return json.loads(content)
    except (ValueError, UnicodeError) as exc:
        raise SchemaError(f'Invalid JSON: {path.name}') from exc


def category_map(root, integrity, explicit=None):
    mapping, labels = {}, {}
    provenance = read_json(root / 'provenance.json', integrity)
    if provenance is not None:
        if not isinstance(provenance, list):
            raise SchemaError('provenance.json must be an array')
        for item in provenance:
            if not isinstance(item, dict) or not isinstance(item.get('id'), str):
                raise SchemaError('Malformed provenance entry')
            mapping[item['id']] = item.get('category') or 'Uncategorized'
    summary_file = root / 'categories.csv'
    if summary_file.exists():
        raw = summary_file.read_bytes()
        integrity.append({'source': summary_file.name, 'sha256': hashlib.sha256(raw).hexdigest()})
        table = pd.read_csv(summary_file, keep_default_na=False)
        if {'category', 'label'} <= set(table.columns):
            labels.update(zip(table['category'], table['label']))
    if explicit:
        explicit = Path(explicit)
        if explicit.suffix.lower() == '.csv':
            entries = pd.read_csv(explicit, keep_default_na=False).to_dict('records')
            integrity.append({'source': 'category_mapping.csv', 'sha256': hashlib.sha256(explicit.read_bytes()).hexdigest()})
        else:
            value = read_json(explicit, integrity, required=True)
            entries = value.get('sites') if isinstance(value, dict) else value
        if not isinstance(entries, list):
            raise SchemaError('Category mapping must contain an array of sites')
        for item in entries:
            if not isinstance(item, dict) or not item.get('category') or not (item.get('id') or item.get('url')):
                raise SchemaError('Category mapping needs category and id or url')
            key = item.get('id') or item['url']
            mapping[key] = item['category']
            labels[item['category']] = item.get('categoryLabel') or item.get('label') or item['category']
    for key, value in list(labels.items()):
        if not isinstance(value, str) or len(value) > 100 or any(c in value for c in ('\n', '\r', '://')):
            raise SchemaError('Category labels must be short public labels')
    return mapping, labels


def records(root, integrity):
    files = sorted((root / 'records').glob('*.json')) if (root / 'records').is_dir() else []
    if files:
        digest = hashlib.sha256()
        for file in files:
            raw = file.read_bytes()
            digest.update(file.name.encode() + b'\0' + hashlib.sha256(raw).digest())
            try:
                yield json.loads(raw)
            except ValueError as exc:
                raise SchemaError('Invalid JSON record') from exc
        integrity.append({'source': 'records/ (combined digest)', 'sha256': digest.hexdigest()})
    else:
        values = read_json(root / 'dataset.json', integrity, required=True)
        if not isinstance(values, list):
            raise SchemaError('dataset.json must be an array')
        yield from values


def final_response(record, comparison):
    """Only a recorded, final top-frame HTTP(S) document response is comparable."""
    final = obj(record.get('navigation')).get('finalUrl')
    if not isinstance(final, str) or not final.startswith(('http://', 'https://')):
        return None
    candidates = []
    if isinstance(comparison.get('finalResponseEvidence'), dict):
        candidates.append(comparison['finalResponseEvidence'])
    candidates += list(reversed(obj(record.get('independent')).get('responses') or []))
    for response in candidates:
        if isinstance(response, dict) and response.get('url') == final and response.get('topFrame') is True and response.get('type') == 'Document' and not response.get('redirect') and isinstance(response.get('headers'), dict):
            return response
    return None


def load_benchmark(root, categories=None):
    root = Path(root)
    integrity, notices = [], []
    mapping, labels = category_map(root, integrity, categories)
    enriched = read_json(root / 'cdp-comparisons.json', integrity)
    comparison_map = {}
    if enriched is not None:
        if not isinstance(enriched, list):
            raise SchemaError('cdp-comparisons.json must be an array')
        for entry in enriched:
            if not isinstance(entry, dict) or not isinstance(entry.get('websiteId'), str) or entry['websiteId'] in comparison_map:
                raise SchemaError('Invalid or duplicate CDP comparison ID')
            comparison_map[entry['websiteId']] = entry
    rows, header_rows, comparison_rows, anomaly_rows = [], [], [], []
    seen = set()
    for record in records(root, integrity):
        if not isinstance(record, dict) or not isinstance(record.get('id'), str) or not isinstance(record.get('status'), str):
            raise SchemaError('Each record needs string id and status fields')
        identifier = record['id']
        if identifier in seen:
            raise SchemaError('Duplicate record ID')
        seen.add(identifier)
        ext, nav, independent = obj(record.get('extension')), obj(record.get('navigation')), obj(record.get('independent'))
        inputs, assessment = obj(ext.get('inputs')), ext.get('assessment')
        captured = isinstance(assessment, dict)
        success = record['status'] in ('ok', 'partial')
        if success and (not captured or nav.get('error') or nav.get('blocked') or record.get('collectionError')):
            raise SchemaError('Successful status conflicts with captured outcome')
        category = mapping.get(identifier, mapping.get(record.get('url'), 'Uncategorized'))
        category = labels.get(category, category)
        if not isinstance(category, str) or len(category) > 100 or any(c in category for c in ('\n', '\r', '://')):
            raise SchemaError('Invalid category')
        network, security = obj(inputs.get('networkActivity')), obj(inputs.get('webSecurity'))
        network_available = bool(network) and network.get('available') is not False
        security_available = bool(security) and security.get('available') is not False
        errors = ext.get('errors') or []
        if not isinstance(errors, list):
            raise SchemaError('extension.errors must be an array')
        anomaly_list = record.get('anomalies') or []
        if not isinstance(anomaly_list, list):
            raise SchemaError('anomalies must be an array')
        for a in anomaly_list:
            if not isinstance(a, dict) or not re.fullmatch(r'[a-z][a-z0-9_]{0,79}', str(a.get('code', ''))):
                raise SchemaError('Malformed anomaly code')
            anomaly_rows.append({'id': identifier, 'code': a['code']})
        assessment = obj(assessment)
        missing_sources = assessment.get('missingSources') or []
        if not isinstance(missing_sources, list):
            raise SchemaError('missingSources must be an array')
        row = {'id': identifier, 'category': category, 'status': record['status'], 'successful': success,
               'captured': captured, 'restricted': bool(nav.get('blocked')) or record['status'] == 'blocked',
               'navigation_error': bool(nav.get('error')) or record['status'] == 'navigation-error',
               'collection_failure': bool(record.get('collectionError')) or record['status'] in ('collection-error', 'validation-error'),
               'timeout': any('timeout' in str(v).lower() for v in [nav.get('error'), record.get('collectionError'), *errors] if v),
               'http_status': number(nav.get('httpStatus'), 'HTTP status'),
               'partial': assessment.get('dataStatus') == 'partial', 'missing_source_count': len(missing_sources),
               'started_at': record.get('startedAt'), 'ended_at': record.get('endedAt'),
               'duration_s': None if record.get('durationMs') is None else number(record['durationMs'], 'durationMs', count=False) / 1000,
               'tracker_domains': number(network.get('trackerDomainCount'), 'trackerDomainCount') if network_available else None,
               'tracker_requests': number(network.get('trackerRequests'), 'trackerRequests') if network_available else None,
               'extension_requests': number(network.get('totalRequests'), 'totalRequests') if network_available else None}
        for dimension in DIMENSIONS:
            row[dimension] = level(obj(obj(ext.get('displayed')).get(dimension)).get('label'))
        rows.append(row)
        comparison = comparison_map.get(identifier, {})
        response = final_response(record, comparison)
        for name, key in HEADERS.items():
            presence = obj(obj(security.get('headers')).get(key)).get('present')
            eligible = bool(response) and security_available and type(presence) is bool
            cdp_presence = bool({str(k).lower():v for k,v in response['headers'].items()}.get(name.lower())) if response else None
            header_rows.append({'id': identifier, 'category': category, 'successful': success, 'header': name,
                                'eligible': eligible, 'present': presence if eligible else None,
                                'cdp_present': cdp_presence if eligible else None,
                                'agrees': presence == cdp_presence if eligible else None})
        cdp_count = number(comparison.get('cdpTotalRequests', independent.get('totalRequests')), 'CDP requests')
        ext_count = row['extension_requests']
        final = nav.get('finalUrl')
        raw_doc = any(isinstance(q, dict) and q.get('url') == final and q.get('topFrame') is True and q.get('type') == 'Document'
                      for q in (independent.get('requests') or []))
        comparable_doc = comparison.get('comparableFinalNavigation') is True or raw_doc
        request_eligible = comparable_doc and cdp_count is not None and ext_count is not None
        protocol = obj(security.get('https')).get('enabled')
        protocol_eligible = bool(response) and security_available and type(protocol) is bool
        cdp_mixed = obj(comparison.get('mixedContent')).get('cdpAttemptCount')
        ext_mixed = obj(security.get('mixedContent')).get('requestCount') if security_available else None
        retained_complete = independent.get('droppedRequests', comparison.get('droppedRequestDetails')) == 0
        if cdp_mixed is None and raw_doc and response and retained_complete:
            docs = [q for q in independent.get('requests', []) if q.get('url') == final and q.get('topFrame') is True and q.get('type') == 'Document']
            stamp = docs[-1].get('timestamp')
            if isinstance(stamp, (int, float)):
                cdp_mixed = sum(q.get('timestamp', -1) >= stamp and str(q.get('url', '')).startswith('http:') and not (q.get('topFrame') and q.get('type') == 'Document') for q in independent.get('requests', [])) if str(final).startswith('https:') else 0
        cdp_mixed, ext_mixed = number(cdp_mixed, 'CDP mixed content'), number(ext_mixed, 'extension mixed content')
        mixed_eligible = comparable_doc and retained_complete and cdp_mixed is not None and ext_mixed is not None
        comparison_rows.append({'id': identifier, 'category': category, 'successful': success,
            'request_eligible': request_eligible, 'cdp_requests': cdp_count, 'extension_requests': ext_count,
            'protocol_eligible': protocol_eligible, 'cdp_https': str(response.get('url')).startswith('https:') if protocol_eligible else None,
            'extension_https': protocol if protocol_eligible else None, 'protocol_agrees': protocol == str(response.get('url')).startswith('https:') if protocol_eligible else None,
            'mixed_eligible': mixed_eligible, 'cdp_mixed': cdp_mixed, 'extension_mixed': ext_mixed,
            'mixed_agrees': cdp_mixed == ext_mixed if mixed_eligible else None})
    if not rows:
        raise SchemaError('No completed records found')
    if set(comparison_map) - seen:
        raise SchemaError('CDP comparisons reference unknown records')
    attempts = pd.DataFrame(rows).sort_values('id').reset_index(drop=True)
    if (attempts['category'] == 'Uncategorized').any():
        notices.append('Categorie mancanti: le osservazioni prive di mappatura sono raggruppate come Uncategorized.')
    review = {}
    for file, key in [('reviewed-anomalies.json','reviewed'), ('validator-false-positives.json','false_positives')]:
        value = read_json(root / file, integrity)
        if value is not None:
            if not isinstance(value, list) or any(not isinstance(a, dict) or a.get('websiteId') not in seen for a in value):
                raise SchemaError('Malformed review annotations')
            review[key] = value
    original_keys=Counter((a['id'],a['code']) for a in anomaly_rows)
    for key,items in review.items():
        keys=[]
        for item in items:
            code=item.get('code') if key=='reviewed' else obj(item.get('original')).get('code')
            if not isinstance(code,str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,79}',code):
                raise SchemaError('Invalid review anomaly code')
            keys.append((item['websiteId'],code))
        if Counter(keys)-original_keys:
            raise SchemaError('Review annotations do not match original anomaly events')
    metadata = obj(read_json(root / 'benchmark-statistics.json', integrity))
    if metadata.get('confirmedBugs') is not None and (not isinstance(metadata['confirmedBugs'],list) or any(not isinstance(v,dict) for v in metadata['confirmedBugs'])):
        raise SchemaError('confirmedBugs must contain review objects')
    manifest = obj(read_json(root / 'manifest.json', integrity))
    metadata = {k:metadata[k] for k in ('confirmedBrowserGuardBugs','confirmedBugs') if k in metadata} | {'manifest': manifest}
    return Benchmark(attempts, pd.DataFrame(header_rows), pd.DataFrame(comparison_rows),
                     pd.DataFrame(anomaly_rows, columns=['id','code']), review, metadata, integrity, notices)
