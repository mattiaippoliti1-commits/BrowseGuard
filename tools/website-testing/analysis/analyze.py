#!/usr/bin/env python3
"""Analyze a completed benchmark locally; never launches browsers or uses the network."""
from __future__ import annotations
import argparse
import importlib.metadata
import platform
from pathlib import Path
import sys
if sys.version_info < (3,11):
    raise SystemExit('Python 3.11+ is required')
import pandas as pd
from data import SchemaError, load_benchmark
from metrics import compute
from charts import generate
from reporting import write_report


def analyze(input_dir, output_dir, categories=None):
    source, output = Path(input_dir).resolve(), Path(output_dir).resolve()
    if source == output or output.is_relative_to(source) or source.is_relative_to(output):
        raise SchemaError('Input and publication output directories must not overlap')
    benchmark=load_benchmark(source,categories)
    tables=compute(benchmark)
    tables['analysis_environment']=pd.DataFrame([{'package':'Python','version':platform.python_version()}, *[{'package':name,'version':importlib.metadata.version(name)} for name in ('pandas','numpy','matplotlib')]])
    for folder in ('tables','figures'):
        (output/folder).mkdir(parents=True,exist_ok=True)
    for name,table in tables.items():
        table.to_csv(output/'tables'/f'{name}.csv',index=False,lineterminator='\n',float_format='%.6f',na_rep='')
    generate(benchmark,tables,output/'figures')
    write_report(benchmark,tables,output)
    return benchmark,tables


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path,help='Completed benchmark directory (read only)')
    parser.add_argument('--output',required=True,type=Path,help='Separate publication artifact directory')
    parser.add_argument('--categories',type=Path,help='Optional id/url-to-category CSV or corpus JSON for future runs')
    args=parser.parse_args()
    try:
        benchmark,tables=analyze(args.input,args.output,args.categories)
    except (SchemaError,OSError,ValueError) as exc:
        parser.exit(2,f'Analysis failed: {exc}\n')
    print(f'Analyzed {len(benchmark.attempts)} attempts; successful={int(benchmark.attempts.successful.sum())}.')
    print(f'Report: {args.output / "BENCHMARK_ANALYSIS.md"}')
    print('Six PNG/SVG figure pairs and aggregate CSV tables generated. No network calls or source changes.')

if __name__=='__main__':
    main()
