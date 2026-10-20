"""Deterministic descriptive statistics; no detector accuracy or risk scoring."""
from __future__ import annotations
from collections import Counter
from datetime import datetime
import pandas as pd
from data import Benchmark, DIMENSIONS, LEVELS, HEADERS


def percent(count, denominator):
    return 100.0 * count / denominator if denominator else None


def describe(values, population):
    s = pd.to_numeric(pd.Series(values, dtype='object'), errors='raise').dropna().astype(float)
    n = len(s)
    return {'n': n, 'missing': population - n,
            'mean': float(s.mean()) if n else None, 'median': float(s.median()) if n else None,
            'min': float(s.min()) if n else None, 'max': float(s.max()) if n else None,
            'std_sample': float(s.std(ddof=1)) if n > 1 else None,
            'q1': float(s.quantile(.25, interpolation='linear')) if n else None,
            'q3': float(s.quantile(.75, interpolation='linear')) if n else None,
            'p90': float(s.quantile(.90, interpolation='linear')) if n else None,
            'p95': float(s.quantile(.95, interpolation='linear')) if n else None}


def execution_times(benchmark):
    manifest = benchmark.metadata.get('manifest') or {}
    def stamp(value):
        try:
            date = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return date.timestamp() if date.tzinfo else None
        except (ValueError, AttributeError, TypeError):
            return None
    phases = manifest.get('phases') or []
    if not phases:
        start=stamp(manifest.get('startedAt'))
        ends=[stamp(value) for value in benchmark.attempts.ended_at]
        if start is not None and ends and all(v is not None for v in ends) and max(ends)>=start:
            return max(ends)-start, max(ends)-start
        return None, None
    windows = [(stamp(p.get('manifest', {}).get('startedAt')), stamp(p.get('lastRecordAt'))) for p in phases]
    if any(a is None or b is None or b < a for a, b in windows):
        return None, None
    return sum(b-a for a, b in windows), max(b for _, b in windows)-min(a for a, _ in windows)


def compute(benchmark: Benchmark):
    attempts, headers, comparisons = benchmark.attempts, benchmark.headers, benchmark.comparisons
    categories = sorted(attempts.category.unique())
    populations = {'successful': attempts[attempts.successful], 'all': attempts}
    n = len(attempts)
    counts = {'total_urls': n, 'assessments_captured': int(attempts.captured.sum()),
              'successful': int(attempts.successful.sum()), 'restricted': int(attempts.restricted.sum()),
              'navigation_errors': int(attempts.navigation_error.sum()), 'timeouts': int(attempts.timeout.sum()),
              'collection_failures': int(attempts.collection_failure.sum()), 'partial_assessments': int(attempts.partial.sum()),
              'http_error_sites': int((attempts.http_status.fillna(0) >= 400).sum()),
              'http_202_sites': int((attempts.http_status == 202).sum()),
              'anomaly_events_original': len(benchmark.anomalies), 'anomalous_sites_original': benchmark.anomalies.id.nunique()}
    summary = [{'metric': key, 'value': value, 'denominator': n if 'anomaly_events' not in key else None,
                'percent': percent(value, n) if key not in ('anomaly_events_original',) else None, 'unit': 'attempts' if key != 'anomaly_events_original' else 'events'} for key, value in counts.items()]
    reviewed, false_positives = benchmark.review.get('reviewed'), benchmark.review.get('false_positives')
    annotations = {
        'reviewed_anomaly_events': None if reviewed is None else len(reviewed),
        'verified_validator_false_positives': None if false_positives is None else len(false_positives),
        'documented_extension_bugs': benchmark.metadata.get('confirmedBrowserGuardBugs'),
        'documented_framework_bugs': None if not isinstance(benchmark.metadata.get('confirmedBugs'), list) else sum(b.get('component') == 'test framework' for b in benchmark.metadata['confirmedBugs'])}
    for key, value in annotations.items():
        summary.append({'metric': key, 'value': value, 'denominator': None, 'percent': None, 'unit': 'documented annotations'})
    windows, elapsed = execution_times(benchmark)
    for key, value in [('execution_windows_s', windows), ('elapsed_including_phase_review_s', elapsed),
                       ('sum_attempt_duration_s', float(attempts.duration_s.dropna().sum()) if attempts.duration_s.notna().any() else None)]:
        summary.append({'metric': key, 'value': value, 'denominator': None, 'percent': None, 'unit': 'seconds'})
    reliability = []
    for category in categories:
        g = attempts[attempts.category == category]
        # Mutually exclusive plotting outcomes; raw restriction/error flags remain separate above.
        succeeded = g.successful
        nav_failed = ~succeeded & g.navigation_error
        restricted = ~succeeded & ~nav_failed & g.restricted
        other = ~succeeded & ~nav_failed & ~restricted
        reliability.append({'category': category, 'n': len(g), 'successful': int(succeeded.sum()),
            'restricted': int(restricted.sum()), 'navigation_error': int(nav_failed.sum()), 'other_failure': int(other.sum()),
            'success_pct': percent(int(succeeded.sum()), len(g))})
    distribution, category_distribution, tracking, performance, header_table, agreement, differences = [], [], [], [], [], [], []
    for population, subset in populations.items():
        for dimension in DIMENSIONS:
            for category, group in [('All categories', subset), *[(c, subset[subset.category == c]) for c in categories]]:
                for lev in LEVELS:
                    row = {'population': population, 'dimension': dimension, 'category': category, 'level': lev,
                           'count': int((group[dimension] == lev).sum()), 'denominator': len(group)}
                    row['percent'] = percent(row['count'], len(group))
                    (distribution if category == 'All categories' else category_distribution).append(row)
        for category, group in [('All categories', subset), *[(c, subset[subset.category == c]) for c in categories]]:
            for metric in ('tracker_domains', 'tracker_requests'):
                tracking.append({'population': population, 'category': category, 'metric': metric,
                                 **describe(group[metric], len(group))})
        for header in HEADERS:
            g = headers[headers.header == header]
            if population == 'successful':
                g = g[g.successful]
            valid = g[g.eligible]
            present = int(valid.present.sum()) if len(valid) else 0
            header_table.append({'population': population, 'header': header, 'population_n': len(g),
                'present': present, 'absent': len(valid)-present, 'not_evaluable': len(g)-len(valid),
                'valid_denominator': len(valid), 'presence_pct_valid': percent(present, len(valid)),
                'agreement_n': int(valid.agrees.sum()) if len(valid) else 0,
                'agreement_pct_valid': percent(int(valid.agrees.sum()), len(valid)) if len(valid) else None})
        comp = comparisons[comparisons.successful] if population == 'successful' else comparisons
        pairs = comp[comp.request_eligible]
        delta = pairs.extension_requests - pairs.cdp_requests
        differences.append({'population': population, **describe(delta, len(comp)),
                            'different_counts': int((delta != 0).sum()),
                            'mean_absolute_delta': float(delta.abs().mean()) if len(delta) else None,
                            'max_absolute_delta': float(delta.abs().max()) if len(delta) else None})
        for metric, eligible, agreement_key in [('protocol', 'protocol_eligible', 'protocol_agrees'),
                                               ('mixed_content', 'mixed_eligible', 'mixed_agrees')]:
            valid = comp[comp[eligible]]
            agree = int(valid[agreement_key].sum()) if len(valid) else 0
            agreement.append({'population': population, 'measurement': metric, 'eligible': len(valid),
                              'not_evaluable': len(comp)-len(valid), 'agree': agree, 'disagree': len(valid)-agree,
                              'agreement_pct': percent(agree, len(valid)),
                              'positive_cdp': int((valid.cdp_mixed>0).sum()) if metric=='mixed_content' else int(valid.cdp_https.sum()),
                              'positive_extension': int((valid.extension_mixed>0).sum()) if metric=='mixed_content' else int(valid.extension_https.sum()),
                              'unit': 'document pairs'})
        h = headers[headers.successful] if population == 'successful' else headers
        valid_h = h[h.eligible]
        agree_h = int(valid_h.agrees.sum()) if len(valid_h) else 0
        agreement.append({'population': population, 'measurement': 'header_presence', 'eligible': len(valid_h),
                          'not_evaluable': len(h)-len(valid_h), 'agree': agree_h, 'disagree': len(valid_h)-agree_h,
                          'agreement_pct': percent(agree_h, len(valid_h)), 'unit': 'header pairs'})
    for category, group in [('All categories', attempts), *[(c, attempts[attempts.category == c]) for c in categories]]:
        performance.append({'category': category, **describe(group.duration_s, len(group))})
    original_counts = Counter(benchmark.anomalies.code)
    reviewed_counts = Counter(a['code'] for a in reviewed) if reviewed is not None else None
    fp_counts = Counter(a.get('original', {}).get('code', 'unspecified') for a in false_positives) if false_positives is not None else None
    if reviewed is not None and false_positives is not None and len(reviewed)+len(false_positives) != len(benchmark.anomalies):
        benchmark.notices.append('La revisione non copre esattamente tutti gli eventi originali; non si assume che gli eventi mancanti siano risolti.')
    anomalies = [{'code': key, 'original_events': original_counts[key],
                  'reviewed_events': reviewed_counts[key] if reviewed_counts is not None else None,
                  'verified_false_positives': fp_counts[key] if fp_counts is not None else None} for key in sorted(original_counts)]
    tables = {'reliability_summary': pd.DataFrame(summary), 'reliability_by_category': pd.DataFrame(reliability),
              'assessment_distribution': pd.DataFrame(distribution), 'assessments_by_category': pd.DataFrame(category_distribution),
              'tracking_statistics': pd.DataFrame(tracking), 'header_presence': pd.DataFrame(header_table),
              'cdp_agreement': pd.DataFrame(agreement), 'request_differences': pd.DataFrame(differences),
              'performance_statistics': pd.DataFrame(performance), 'anomaly_summary': pd.DataFrame(anomalies, columns=['code','original_events','reviewed_events','verified_false_positives']),
              'source_integrity': pd.DataFrame(benchmark.integrity)}
    return tables
