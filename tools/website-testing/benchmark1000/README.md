# Sourced 1,000-site field benchmark

The frozen production identity is
`0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`.
The runner refuses another version. It does not modify BrowserGuard, thresholds,
permissions or tracker data. All collection uses one ordinary unpacked-extension
Chromium process/profile at a time, with no login, form submission, consent clicks,
CAPTCHA solving, stealth, retries of restrictions or external AI/analysis service.

See [the corpus](../datasets/DATASET_1000.md) for licensed sources, exact selection,
category interpretation, snapshot age and SHA-256. No hostname was generated or
silently substituted. The initial Wikidata extraction hit an outage; the separate
licensed Curlie export completed the corpus without bypassing those service limits.
`source-cache/` is ignored; never publish the full source dump by accident.

## Environment and methodology

`preflight.json` records Git commit/dirty status, production/corpus identity, Node,
Playwright, Chromium, Python, macOS/arm64, physical RAM, OS free-memory snapshot,
pressure level, available disk, the prefixed smoke selection, and historical hashes.
The free-memory snapshot is not a claim about all reclaimable/available memory.
The configured machine has 8 GiB physical RAM.

The existing `visit()` function, popup capture and CDP collector are reused.
Collection defaults match the 100-site run: navigation 25 s; analysis 15 s;
observation 3–10 s with a 1 s request-start quiet interval; delay 2 s; retained
request limit 5,000; profile recycling every 25 URLs. No TLS exceptions or test CA
is used for public sites. The controlled suite's local CA is not loaded here.

Added safeguards are methodological differences from the old run: hard production
and corpus identity guards before each batch, production guard after each visit,
resource monitoring/stops, verified record readback, 25-record checkpoints and a
mandatory actual signal/resume smoke proof. Sampling and file hashing add overhead.
Smoke interruption necessarily starts a fresh profile after its five-record prefix.
The main run is independent and includes all 1,000 URLs; smoke rows are not merged.

## Commands

From the repository root, with existing dependencies/browser installed:

```sh
export PLAYWRIGHT_BROWSERS_PATH=/tmp/browserguard-playwright-browsers
# Refuses partial/unbalanced corpus before opening a browser:
node -e 'console.log(require("./tools/website-testing/benchmark1000/core.cjs").loadCorpus().identity)'
# New smoke directory only: SIGTERM after 5 records, resume, prove no rewrite:
node tools/website-testing/benchmark1000/smoke-resume.cjs
# Main run requires that frozen smoke proof and unchanged source/corpus/config:
node tools/website-testing/benchmark1000/run.cjs --phase main
# After a graceful interruption:
node tools/website-testing/benchmark1000/run.cjs --phase main --resume
# Offline enrichment after the collection lock is gone:
node tools/website-testing/benchmark1000/analyze.cjs
# Offline Python analysis; raw inputs stay read-only:
tools/website-testing/analysis/.venv/bin/python tools/website-testing/analysis/analyze.py \
 --input tools/website-testing/runs/benchmark1000 \
 --output tools/website-testing/analysis/output/benchmark1000 \
 --categories tools/website-testing/datasets/benchmark1000.csv
# After all 1,000 records and browser cleanup: enrichment, figures, tests,
# integrity/privacy-structure audit, Markdown reports and publication checks:
node tools/website-testing/benchmark1000/finalize.cjs
```

Do not re-run `smoke-resume.cjs` into existing smoke evidence. The two-per-category
prefix is chosen before outcomes; blocked sites are retained, never replaced.
The interruption test sends an actual process SIGTERM, verifies an interrupted
checkpoint, hashes/mtimes every completed record, resumes, and verifies 20 unique
real assessments without modifying those initial files. Browser navigation failures
are operational results; collection failures block main admission for investigation.

The main command accepts `--phase main|smoke`, `--resume`, optional `--output`,
`--min-disk-gb` (5), `--max-browser-processes` (100),
`--process-growth-samples` (3), `--sample-interval-ms` (15000).
Limits must match the frozen smoke proof and manifest. Concurrency and observation
windows cannot change through this wrapper. To change methodology, prepare a new,
explicit experiment and smoke proof rather than mixing results into this run.

## Resources, stopping, records and resume

Samples record Node RSS, summed RSS of attributable Chromium descendants, ps CPU,
process count, macOS pressure level, available filesystem bytes and output size.
RSS is resident memory, not virtual memory. Summed process RSS may count shared
pages repeatedly and is not total physical RAM consumption. CPU percentages are
not normalized to one core. Detached/unattributable processes are excluded; short
peaks between 15 s samples are unknown. Sampling covers collection, not every
later plotting instruction.

Stops: available disk below configured minimum; macOS pressure critical (level 4);
persistent excess attributable browser process count; three monitoring failures;
browser launch failure; identity/config/harness drift; invalid checkpoint/record
persistence. Level 2 warning alone is recorded, not treated as critical. Only owned
browser contexts close; unrelated processes are never killed.

On SIGINT/SIGTERM or a stop, the in-flight visit finishes, an atomic record
is saved, Chromium closes, profiles are removed and a checkpoint/stop cause is
recorded. Each atomic per-site record is a completion unit, stronger than only
saving every 25 sites. Resume validates stable ID, URL, schema, source and required
fields, refuses corrupt records explicitly, and never silently overwrites them.
It rejects source/corpus/config/resource-limit/harness changes. Sites with failed
or blocked outcomes are completed attempts and are not retried on resume.
A hard kill can leave a lock/profile; confirm the recorded PID has exited before
manual lock cleanup. In-flight visits without a completed record may be retried.
Atomic rename protects ordinary interruption, not every filesystem/power failure.

The navigation timeout bounds `goto`, not the entire attempt. The reused harness
has no outer visit watchdog; title retrieval, protocol calls and cleanup can wait
longer. For example, the `kb.mk` attempt returned a 25 s navigation timeout but
took approximately 129 s overall. This is a collection limitation, not evidence
of a BrowserGuard detector defect. Timing/timeout settings were not changed in
response. A future watchdog requires a separately versioned experiment.

## Interpretation and publication

`benchmarkOutcome` distinguishes captured assessment, accepted navigation,
unrestricted HTTP visit, explicit status families, TLS/DNS/timeout errors,
collection failure, partial/unavailable data and unverified page identity. Intended
page identity is not semantically established from a 2xx or card capture.
The old generic status/analysis populations are retained for comparability;
`unrestrictedVisit` additionally excludes HTTP >=400 and is reported separately.

Reports do not equate sites with safe/malicious labels, or calculate detector
accuracy/precision/recall/F1. CDP header/protocol pairs require final matching
main-document evidence. Missing observations are not absent headers. Request
windows and worker/frame visibility differ; blocked mixed attempts may never
reach extension webRequest. Tracker/entity labels derived with bundled data are
not independent truth. Anomalies are investigation hypotheses; production remains
frozen even when an anomaly is found.

Raw `runs/` are ignored by Git. Publish only reviewed corpus/provenance, scripts,
methodology, aggregate tables, six PNG/SVG pairs and Markdown. Do not copy profiles,
source dumps, cookies, credentials, response bodies, request headers, query tokens,
raw policy text or every raw record into the publication tree. URL queries and
credentials are redacted by the existing collector; useful structural evidence is
kept locally. An `ai-packet.json` created by the old local report is a file only;
no AI client is invoked or authorized in this experiment.

Historical 100-site raw/analysis outputs and controlled-validation outputs have
preflight hashes and must remain unchanged. The version difference makes the final
100-vs-1000 comparison descriptive, not a causal code-change or accuracy claim.
