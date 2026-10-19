# BrowserGuard website testing

A test-only Playwright harness for the **unmodified** Chrome Manifest V3 extension.
It can process 1,000 or more distinct HTTP/HTTPS URLs, with one local JSON record
per attempted website, checkpoints, independent CDP observations, deterministic
validation, and offline JSON/CSV/HTML reports. It does not establish that a website
is safe or that an anomaly is a confirmed BrowserGuard bug.

## Architecture and inspected interfaces

The extension has no public automation/export endpoint. Inspection verified:

- `background/service-worker.js` observes `webRequest.onBeforeRequest` and main
  document `onHeadersReceived`, matches tracking-associated cross-origin domains,
  resolves ownership with bundled data, and persists per-tab aggregates in
  `chrome.storage.session`. `GET_NETWORK_ACTIVITY`, `GET_RUNTIME_PRIVACY`, and
  `GET_WEB_SECURITY` return snapshots through extension messaging.
- `content/runtime-monitor.js` runs in the page MAIN world at `document_start`.
  Its limited events pass through `runtime-bridge.js` validation to the worker;
  page scripts can spoof this observational channel.
- `content/page-analysis.js` answers `PAGE_ANALYSIS` with DOM/form/link/iframe
  metrics. The popup can inject that script when its listener is absent.
- `popup/popup.js` parses the active URL, requests the three worker snapshots
  and DOM analysis, checks active-tab identity again, invokes
  `BrowserGuardAssessmentEngine.assessBrowserState`, and renders the output.
- `modules/assessment/assessment-engine.js` is a pure rule-based module.
  `popup/presentation.js` maps its output to labels and availability caveats.
  The production repository had no npm dependencies; existing tests use Node
  assertions/VM fixtures and a separate mocked Chrome layout checker.

```text
Worker profile 1                       Worker profile N
  website → CDP event listener            website → CDP event listener
     ↓ real extension collectors             ↓ real extension collectors
  real popup → captured engine call      real popup → captured engine call
               ↓                                      ↓
           per-site atomic JSON records / resume checkpoints
                              ↓
             validators → dataset / CSV / HTML / investigations
                              ↓ optional, separately invoked
                        AI anomaly analysis
```

Each worker has its own temporary persistent Chromium context, browser window,
profile, and extension state. A worker visits one website at a time. This avoids
races between the popup’s `active: true, currentWindow: true` queries. Profiles
are recycled after 25 websites by default and removed on ordinary exit. Browser
cache/origin storage may persist between sites within a worker until recycling;
this is not equivalent to a new visitor on every URL.

The harness opens the real popup HTML in a **background extension tab**, keeping
the website active. A popup-only init script wraps the original engine method,
copies its exact input/output, and returns the original result unchanged. It
also reads the actual rendered assessment and card labels. No Chrome APIs are
mocked and no test hooks are added to production files. The toolbar flyout’s
focus/closing behavior is not tested. The harness does not inject scripts into
websites, change their DOM, rewrite responses, bypass TLS errors, or use stealth
flags; BrowserGuard’s existing content scripts still operate normally.

The measured ten-site results and remaining verification limits are recorded in
[VALIDATION.md](VALIDATION.md).

## Installation

Use Node.js 22 or newer. From this directory:

```bash
npm ci
npx playwright install chromium
npm test
node local-smoke.cjs
```

Playwright is the only runtime dependency of this **test package**, pinned in
`package-lock.json`. No extension build is required. Use Playwright’s bundled
Chromium with `channel: 'chromium'`; ordinary Chrome/Edge builds no longer provide
the same unpacked-extension command-line support.
[Playwright extension documentation](https://playwright.dev/docs/chrome-extensions).

The live local smoke check serves an HTTP fixture with known headers and a
password field, loads the real extension, and asserts the captured DOM/header
results, the HTTP Security assessment, independent request collection, and URL
query redaction. It requires a working Chromium installation and a localhost
listening socket. It prints the temporary report directory.

## Run 10, then 100, then 1,000 websites

From this directory:

```bash
# Bundled ten-site public proof of concept; no authentication or clicks.
node run.cjs --urls websites.txt --limit 10 --output runs/poc

# Inspect statistics.json, failed-tests.json, anomalies.json and report.html first.
# Supply a reviewed corpus with >=100 / >=1000 distinct HTTP(S) URLs.
node run.cjs --urls corpus.txt --limit 100 --output runs/100
node run.cjs --urls corpus.txt --limit 1000 --output runs/1000
```

Only the ten-site sample is bundled. Supply your own reviewed corpus for larger
runs: one complete URL per line, optional blank lines and `#` comments. Duplicates
are removed; the runner **refuses** a limit larger than the number of distinct
input URLs. It does not manufacture extra sites, repeat ten sites as 1,000 tests,
or automatically download a third-party ranking. Keep the original corpus for
reproduction, especially for URLs with query parameters. Review the ten-site
proof of concept before launching the larger commands; those larger commands
are intentionally not executed automatically.

Navigation consists of one normal GET visit with its normal subresources. The
harness does not click consent dialogs, log in, solve CAPTCHAs, rotate identities,
retry rate limits, or bypass anti-bot protection. HTTP 401/403/429 and selected
challenge/login page-title indicators are recorded as restrictions. This title
heuristic is incomplete and can produce false positives. Blocked and failed
websites remain in the dataset; their assessments do not count as successful
analyses. No automatic same-site retry is performed.

## Configuration and resource use

```bash
node run.cjs --config config.example.json
node run.cjs --urls corpus.txt --limit 1000 --concurrency 2 --output runs/1000
node run.cjs --urls websites.txt --limit 10 --output runs/visible --headed
```

Paths are relative to the current working directory. CLI values override JSON.
Unknown flags/keys and invalid numeric values are rejected.

| Option (JSON key) | Default | Meaning |
| --- | --- | --- |
| `urlsFile` (`--urls`) | `websites.txt` | UTF-8 HTTP/HTTPS URL corpus; no embedded credentials. |
| `output` (`--output`) | `runs/poc` | New report/checkpoint directory. |
| `limit` (`--limit`) | 10 | Number of unique URL entries to test. |
| `concurrency` (`--concurrency`) | 1 | Independent Chromium processes/profiles, one active website each. |
| `navigationTimeoutMs` | 25000 | Navigation deadline, waiting for DOMContentLoaded. |
| `analysisTimeoutMs` | 15000 | Browser setup, popup loading and collection deadlines. |
| `minObserveMs` | 3000 | Minimum additional observation after navigation returns/fails. |
| `quietMs` | 1000 | Quiet interval since the last independent HTTP(S) request start. |
| `maxObserveMs` | 10000 | Maximum additional wait; long-lived/active pages cannot stall forever. |
| `delayMs` | 2000 | Pause between websites in each worker. |
| `maxRequests` | 5000 | Cap on retained request/response/failure details per site; aggregate request count continues. |
| `headless` (`--headed` disables) | true | Bundled Chromium headless mode with extension support. |
| `recycleEvery` | 25 | Recreate isolated worker profile to bound long-run browser state. |

For an Apple Silicon Mac with 8 GB RAM, start at **concurrency 1** with other heavy
applications closed. Test concurrency 2 only after observing memory pressure.
Complex pages may use hundreds of MB or more per browser; no fixed memory ceiling
is guaranteed. Browser downloads require several hundred MB. Report disk usage
depends on traffic and header sizes. A 1,000-site run may take several hours:
plan from the measured average attempt duration plus the per-site delay, rather
than assuming a fixed throughput. Website failures/timeouts increase runtime.

The observation wait is a bounded request-start quiet interval, **not guaranteed
network idle**, full page loading, or a minimum guaranteed request count. Counts
and the reason the wait ended are saved.

## Checkpointing, interruption and reproduction

```bash
# Ctrl+C finishes in-flight attempts, saves them, and stops scheduling new sites.
node run.cjs --urls websites.txt --limit 10 --output runs/poc --resume

# Regenerate reports without visiting sites again.
node report.cjs runs/poc
```

Use the same input order, configuration, extension source files, output directory,
and dependency lockfile when resuming. An atomic per-site record is the unit of
completion; failed/blocked attempts are also complete and skipped on resume.
In-flight sites without a completed record are visited again. `checkpoint.json`
is a progress summary; records are authoritative. `.lock` prevents simultaneous
writers. After a hard process kill, first confirm the old process has stopped,
then remove a stale `.lock` manually. Hard termination can also leave temporary
`browserguard-field-*` profiles in the OS temporary directory; delete those only
after confirming their browser has exited.

The manifest records the extension source/dataset SHA-256 hashes, Git commit,
configuration, harness fingerprint, browser/Playwright/Node versions, and platform. Resume rejects
configuration, corpus, extension source, or harness changes. Restore the recorded source revision
and dependency lockfile to reproduce an anomaly; do not silently replay with
new rules. Copy the original URL to a one-line `repro.txt` file and use a **new**
output directory:

```bash
node run.cjs --urls repro.txt --limit 1 --output runs/repro --headed
```

Live pages, advertisements, geography, cached state, redirects, and bot policies
can change. Repeated observations are not guaranteed to be identical. Inspect
saved evidence first; do not retry a 429/CAPTCHA as a way around a restriction.

## Measurements and validation

`extension.inputs` contains the five actual input snapshots; `extension.assessment`
is the captured engine output. `extension.renderedAssessment` and `displayed`
contain the actual popup result. `collectionWindow` bounds popup loading and its
sequential requests; engine-call timestamps are separate. `independent` contains
a separate CDP stream:
HTTP(S) request URL/hostname/type/timestamps, selected response security headers,
redirect evidence, response status/cache/service-worker metadata, and failures.
HTTPS usage and navigation outcomes are recorded separately. No request bodies,
response bodies, request headers, cookie values or fingerprint values are read.

Deterministic checks cover:

- Non-integer/negative counters, request/resource/domain sums, entity partitions,
  tracker subsets, domain-bound matches, and unexpected entity relationship enums.
- Missing input sources, popup exceptions, collection failures, wrong active tabs,
  and potentially mismatched page identities.
- Exact replay of captured inputs through the unchanged Node Assessment Engine,
  comparison to the rendered result and expected presentation mapping, Security
  severity contracts and HTTP behavior, and separate declarative Privacy/Network rule
  checks using the engine’s existing exported constants.
- Header-presence differences only when an independent final top-frame document
  response can be matched to the final page URL. No claim is made when that
  evidence is missing.

Engine replay shares the production implementation: it checks integration and
determinism, **not independent rule correctness**. The additional declarative checks cover
Privacy combinations and Network boundaries; existing assessment calibration
unit tests remain important for detailed rule semantics. Validators report code, priority, supporting evidence, a hypothesis
classification, and a recommended manual investigation. Invalid/malformed site
header values are not treated as impossible request counters.

The CDP stream starts before navigation and ends after popup extraction. Worker
state resets on observed main-frame requests, while snapshots are requested
sequentially and runtime events can still arrive. Redirects, caches, nested-frame
processes, worker targets, and navigation races can change visibility. CDP here
is attached to the page target, not every browser process/worker. Request totals
from the two sources are deliberately **not required to match**. Retention caps
and dropped request-detail counts are explicit. A request attempt does not prove
successful loading or execution.

## Reports

| File | Contents |
| --- | --- |
| `manifest.json`, `checkpoint.json` | Reproducibility metadata and progress. |
| `records/<sha256>.json` | One result per unique URL entry, including errors and evidence. |
| `dataset.json` | Complete array assembled from all completed records, streamed from disk. |
| `summary.csv` | Website status, duration, displayed categories, counts and anomaly count. |
| `statistics.json` | Success/failure/partial totals, assessment distributions, average attempt duration, request and tracker means with sample count, anomaly groups. |
| `report.html` | Offline overview, escaped evidence, and links to full records. |
| `failed-tests.json` | Navigation, restriction, or extraction failures. |
| `anomalies.json` | Potential anomalies with supporting evidence. |
| `manual-investigations.json` | Grouped codes, website IDs and investigation guidance. |
| `ai-packet.json` | Offline grouped statistics plus one anomaly example per code. |

Statistics count successfully captured but partial assessments separately. The
request/tracker averages include only available extension snapshots; missing
snapshots do not become zeros. Duration means the whole site attempt. Errors and
anomalies remain separate: a captured assessment may still have consistency
anomalies that need review. HTML is static and escapes untrusted strings; CSV
cells guard against spreadsheet formula injection. Reports are local and ignored
by Git. The HTML report does not make remote requests.

## Optional AI analysis

The runner and report generator never invoke an AI service. Offline grouping,
priorities and manual recommendations work without AI. To use a separately
installed local Ollama-compatible server explicitly:

```bash
node ai.cjs --run runs/poc --model YOUR_INSTALLED_MODEL
```

This sends only `ai-packet.json` to `http://127.0.0.1:11434/api/generate` and saves
`ai-analysis.json`. It does not download a model or start an AI server. Use a local
model in a separate step rather than keeping it resident during browser testing
on an 8 GB Mac. Model choice/availability is your responsibility.

A remote Ollama-compatible endpoint requires **both** explicit configuration and
explicit authorization:

```bash
node ai.cjs --run runs/poc --model YOUR_MODEL \
  --endpoint https://YOUR_AUTHORIZED_HOST/api/generate --authorize-external-ai
```

Review the packet first. It may contain website/domain/path and observation
evidence even though URL queries, fragments and credentials are redacted. No
external provider is configured by default; redirects are refused to avoid
silently forwarding data to another endpoint. A loopback service’s own upstream
behavior is outside the harness: ensure your local service really runs locally.
Model output is unverified text, never executed and never used to override test
results. It can suggest explanations, debugging priorities, groups and summaries;
manual confirmation is still required.

## Privacy and operational limits

No production permissions, telemetry, detectors, thresholds, storage behavior or
popup UI are changed. Test profiles and reports are separate from your everyday
Chrome profile. Reports redact URL credentials, query strings and fragments;
paths, hostnames and selected policy headers can still be sensitive. Saved URL
redaction also limits exact replay of query-dependent navigation: retain the
original corpus securely. Profiles can temporarily contain normal website
cookies/cache until cleanup. No personal browser profile or authenticated state
is imported. Websites still receive ordinary browser traffic and may record it.

## Categorized 100-site benchmark

The reviewed corpus and exact two-phase commands are documented in
[datasets/README.md](datasets/README.md). The ten-site smoke phase and disjoint
ninety-site main phase use the existing runner at concurrency 1. After both
complete, `node analyze-benchmark100.cjs` combines unchanged records, preserves
phase manifests, and adds category statistics and CDP comparisons locally. It
performs no browser navigation, AI calls, or external transmission. The resulting
report is `runs/benchmark100/benchmark.html`; the interpretation and limitations
are written to `BENCHMARK_100.md`.

The 100-site run exposed and fixed a test-only validator defect: runtime details
are serialized as `API:detail`, while the independent Privacy oracle had compared
bare API/detail names by exact array membership. The minimal fix matches tokens
within each detail string; production engine rules remain unchanged. A new
`benchmark100-regression.test.cjs` test demonstrates the defect and correction.
The original records and phase fingerprints are preserved; reviewed anomalies
and false positives are reported separately. After this harness change, start
new execution directories rather than resuming old manifests with a new validator.
