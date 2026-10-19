# BrowserGuard statistical analysis

Offline descriptive analysis of completed website benchmarks. This module reads
existing records and structured CDP/review artifacts; it never starts Chromium,
revisits websites, calls an AI service, or changes extension/collector code.

The generated [100-site analysis](output/benchmark100/BENCHMARK_ANALYSIS.md) and its
PNG/SVG figures and aggregate CSV tables are ready for GitHub. Raw input files
remain local under the separately ignored `runs/` directory.

## Requirements and installation

Use **Python 3.11+**. Direct dependencies are **Pandas** and **Matplotlib**.
NumPy, Pillow, and the plotting/date/font support packages are transitive
dependencies; Seaborn, SciPy, pytest and tabulate are not needed.
`requirements.txt` pins the direct packages and `requirements-lock.txt` pins the
complete environment used for the published artifacts.

An existing environment with these packages can run the analysis immediately.
For a new environment, an offline installation uses local wheels compatible with
your Python version and platform. From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --no-index --find-links /path/to/local/wheelhouse -r requirements-lock.txt
```

The wheelhouse is supplied locally and is not included in the publication tree.
For this validation, all packages were installed from already cached local wheels
with `--no-index`; no network access was used. Dependencies must be installed
before running the module; the module does not download or install anything.

## Generate an analysis

From `tools/website-testing`, using the environment above:

```bash
analysis/.venv/bin/python analysis/analyze.py \
  --input runs/benchmark100 \
  --output analysis/output/benchmark100
```

Or, from this directory with an activated environment:

```bash
python analyze.py --input ../runs/benchmark100 --output output/benchmark100
```

The CLI requires separate, non-overlapping input and output directories. It
accepts any number of completed attempts, not a hardcoded sample of 100. It
reads `records/*.json` one at a time and keeps only normalized measurement rows,
which is suitable for 1,000+ attempts. If individual records are unavailable, it
can load the existing `dataset.json` array; that fallback temporarily requires
memory for the entire raw array. No input file is written or reformatted.

For a future run with no per-site category mapping:

```bash
python analyze.py --input ../runs/future --output output/future \
  --categories ../datasets/future-corpus.csv
```

The optional mapping accepts CSV rows with `id` or `url`, `category`, and optional
`label`, or a corpus JSON object with a `sites` array containing the same fields
(`categoryLabel` is also accepted). A bare JSON array is supported. URLs are used
only for the local join and are never exported. Without a mapping, unmatched
records appear under `Uncategorized` with a notice. Counts and statistics are
always recomputed from record data, not copied from benchmark prose or totals.

## Source contracts

- A record needs string `id` and `status`; IDs must be unique. Observations use
  the existing `navigation`, `extension.inputs`, `extension.assessment`,
  `extension.displayed`, `independent`, `anomalies`, and `durationMs` fields.
  Missing optional metrics stay missing; malformed counts and contradictory
  successful outcomes fail validation rather than silently becoming zeros.
- `provenance.json` optionally maps IDs to categories. `categories.csv` provides
  category labels, not trusted totals. `--categories` can supply a future corpus.
- `cdp-comparisons.json` is reused when available. If it is absent, the module
  derives only the measurements needed for the figures from recorded CDP
  requests/responses. It does not recreate tracker/entity classification.
- `reviewed-anomalies.json` and `validator-false-positives.json` are optional
  review annotations. Their IDs/codes must refer to original events. Missing
  review files mean **unknown review coverage**, not zero residual anomalies.
- `benchmark-statistics.json` supplies only documented bug annotations;
  reliability, assessment, timing and tracking aggregates are recomputed.
  A missing documented bug count stays unknown. Statistics do not confirm bugs.
- `manifest.json` supplies reconstructible execution-window metadata. Per-phase
  windows are summed for an aggregate run. For a single-phase manifest, a start
  and complete record end timestamps can bound the observed execution window.
  A missing bound stays unknown, not a fabricated total run time.

The loader checks required shapes, enums, numeric values and duplicate IDs. It
never maps an unknown assessment level to a favorable one. Displayed `—` and
`Unavailable` normalize to `Unavailable`; absent labels normalize to `Missing`.
An unavailable Network card can occur even with complete source snapshots.

## Statistical populations and denominators

| Analysis | Population / denominator |
| --- | --- |
| Reliability | All completed attempts; plot outcomes are disjoint. |
| Main assessment distribution | Successful `ok`/`partial` visits with no contradictory navigation, restriction or collection error; unavailable/missing labels are explicit. |
| Main tracking activity | Successful visits; each metric uses its nonmissing sample count. |
| Main security-header figure | Successful visits with a matching final top-frame HTTP(S) document response, recorded CDP headers, and a boolean extension presence flag. Presence percentage uses only evaluable pairs. |
| Request scatter | Successful visits with identifiable final document navigation and two available request counters. Observation windows still differ. |
| Performance | All attempts with an available full-attempt duration; seconds, not extension-only latency. |

The CSVs include both successful and all-attempt populations where relevant.
Percentages always carry their denominator. Standard deviation is sample SD
(`ddof=1`); quartiles and P90/P95 use linear interpolation. Fewer than two values
produce no SD. Zero observations produce no percentage/mean, not a zero estimate.
Boxplot outliers use the standard 1.5×IQR convention and are not bug labels.

The protocol comparison uses the **actual matched CDP response URL**, rather than
assuming a field called `cdpUsesHTTPS` originated from a network response. The
previous benchmark enrichment derived that field from Playwright's final URL.
For mixed-content count agreement, retained CDP details must be complete; capped
or unknown-retention windows cannot establish exact agreement. Empty counters
and the absence of positive cases do not demonstrate detection sensitivity.

The request scatter is explicitly descriptive. Different timing, redirects,
cache, workers, nested frames and process visibility affect observation windows.
The three largest absolute differences are highlighted by rank only. There are
no new risk thresholds, regressions treated as ground truth, detector accuracy,
precision, recall or F1 scores. If paired data are insufficient, the figure is an
explanatory placeholder rather than a misleading numeric plot.

## Files and publication

```text
analysis/
├── analyze.py                  # CLI and orchestration
├── data.py                     # Read-only schema normalization
├── metrics.py                  # Descriptive statistics and denominators
├── charts.py                   # Six white-background PNG/SVG figures
├── reporting.py                # GitHub Markdown report
├── test_analysis.py            # Synthetic offline tests (unittest)
├── requirements.txt
├── requirements-lock.txt
├── README.md
└── output/benchmark100/
    ├── BENCHMARK_ANALYSIS.md
    ├── figures/                # Six PNGs at 300 DPI and six matching SVGs
    └── tables/                 # Aggregate-only CSVs and input/environment digests
```

Figures: `assessment_distribution`, `benchmark_reliability`, `tracking_activity`,
`security_headers`, `cdp_comparison`, `benchmark_performance`. Counts, hatches,
text and distinct point shapes supplement the palette for color accessibility.
Matplotlib uses the noninteractive Agg backend and bundled DejaVu Sans fonts;
SVG glyphs are embedded as vector paths to avoid depending on installed fonts
when viewed on GitHub; font-cache files are temporary and outside publication
outputs.

The publication tree contains scripts, dependency files, documentation, aggregate
CSVs, Markdown and PNG/SVG figures. It does **not** copy raw JSON records,
request URLs, individual identifiers, policy text, logs, tokens, profiles or
caches. `output/benchmark100` is self-contained for reading; every required link
in its report points to a published figure/table. Detailed per-site evidence is
explicitly described as available only in the local input. `.venv/` and
`__pycache__/` are ignored; the framework's `runs/` remains ignored.

Do not publish an existing output directory that contains unrelated personal
files. The generator writes only its known artifact names; it does not clean up
arbitrary files already present there. Publication should start in a dedicated
output directory. No commit or push is performed by these scripts.

PNG/SVG/Markdown/CSV generation is deterministic for the same input and library
versions. SVG IDs use a fixed hash salt and timestamps are suppressed; PNG DPI
and creator metadata are fixed. Rendering can differ across library/font
versions, so the lockfile and `analysis_environment.csv` should accompany results.
`source_integrity.csv` records hashes without exporting individual record IDs.

## Tests

From this directory:

```bash
.venv/bin/python -m unittest discover -s . -p 'test_*.py' -v
```

Tests use small synthetic datasets: missing metrics, zero-success runs, nullable
header flags, correct denominators/percentages, sample SD and percentiles,
category mapping, non-100 corpus sizes, capped measurements and review matching.
They generate and validate six PNG/SVG pairs and the Markdown, verify 300 DPI,
identical repeated outputs and valid relative links, forbid socket creation,
check that sensitive fixture strings are not published, and confirm original
input bytes remain unchanged. No existing production/framework test is changed.

Repository checks from the repository root (no browser navigation):

```bash
node --test tests/*.test.js
node --test tools/website-testing/*.test.cjs
```

Live browser/layout checks are intentionally not part of this offline analysis.
Before a future 1,000-site collection, validate the corpus and resume separately,
keep concurrency conservative, monitor RAM/disk, and distinguish restriction
coverage from intended-page visibility. This analysis adds no new website visits.
