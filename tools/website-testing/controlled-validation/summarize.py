#!/usr/bin/env python3
"""Offline controlled-result adapter. Public benchmark schema is deliberately untouched."""
import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

STATUSES = ('PASS', 'FAIL', 'NOT_OBSERVABLE', 'INCONCLUSIVE', 'SKIPPED')


def summarize(data):
    if data.get('kind') != 'controlled-validation':
        raise ValueError('Expected controlled-validation results, not public benchmark records')
    rows = data['scenarios']
    if len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Duplicate scenario IDs')
    if any(r['status'] not in STATUSES for r in rows):
        raise ValueError('Unknown controlled status')
    counts = Counter(r['status'] for r in rows)
    all_count = len(rows)
    executed = all_count - counts['SKIPPED']
    categories = defaultdict(Counter)
    for row in rows:
        categories[row['category']][row['status']] += 1
    return {
        'counts': {k: counts[k] for k in STATUSES},
        'denominators': {'all_recorded': all_count, 'executed': executed},
        'pass_percent_all': 100 * counts['PASS'] / all_count if all_count else None,
        'pass_percent_executed': 100 * counts['PASS'] / executed if executed else None,
        'categories': {key: {'total': sum(value.values()), **{k: value[k] for k in STATUSES}}
                       for key, value in sorted(categories.items())},
        'interpretation': 'Outcome coverage, not detector accuracy. NOT_OBSERVABLE is not PASS; INCONCLUSIVE is not FAIL.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = summarize(json.loads(args.input.read_text()))
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'controlled-statistics.json').write_text(json.dumps(result, indent=2) + '\n')
    with (args.output / 'signal-coverage.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['category', 'total', *STATUSES])
        writer.writeheader()
        for category, values in result['categories'].items():
            writer.writerow({'category': category, **values})
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
