# Validation record

Validated on 2026-10-19 on macOS arm64, using Node.js 25.2.1,
Playwright 1.58.2, and its bundled Chromium 145.0.7632.6.
No production files or existing test suites were changed for the framework.

## Public ten-site proof of concept

The supplied `websites.txt` corpus was visited once at concurrency 1. No challenge,
authentication, consent, or retry interaction was performed.

| Outcome | Result |
| --- | --- |
| Websites attempted | 10 |
| Actual extension assessments captured | 10 |
| Unrestricted successful analyses | 8 |
| Restricted responses | 2 |
| Partial-source assessments | 0 |
| Count / engine / presentation / matched-header anomalies | 0 flagged |
| Mean full attempt duration | 4,124 ms |
| Mean extension request count | 34.8 |
| Mean tracking-associated domain count | 0.8 |

The means include all ten available extension snapshots, including restricted
responses; they are not estimates for an unrestricted web corpus. The displayed
Security distribution was Low 10; Privacy was Low 8 / Moderate 2; Network was
Low 7 / Moderate 2 / unavailable 1. These are categories of the observed responses,
not safety verdicts for the intended sites.

`www.w3.org` returned HTTP 403 and `www.gnu.org` returned HTTP 429. Both were
recorded as access restrictions and were not retried. Blocked-response assessments
remain available for diagnosis but are not counted as successful site analyses.

CDP and extension request counts differed on several websites. These were not
flagged as bugs: their windows and visibility differ. For example, the observed
BBC visit had 112 CDP requests versus 124 extension requests. No equality assertion
is applied across these sources.

Local ignored artifacts are under `runs/poc/`: complete records, dataset,
statistics, CSV, HTML, restrictions/failures and investigation suggestions.
The initial field run preceded the final harness-fingerprint hardening; its
manifest records the extension source fingerprint but no harness fingerprint.
It remains readable and reportable; current resume logic intentionally requires
a new run directory after harness changes. All ten saved records were revalidated
with the final validators and produced no additional anomaly codes.

This is a small proof of concept, **not a 1,000-site field validation**. No 100-site
or 1,000-site public run was executed. The bundled list contains ten sites; larger
runs require a reviewed input corpus.

## Automated checks

- Existing production suite: 68 passing tests.
- Framework suite: 11 passing tests, including malformed counters, mismatched
  engine/UI results, missing sources, header comparability, safe popup capture,
  URL redaction, corpus-size validation, escaped reporting, and refusal of
  unauthorized external AI transmission.
- Synthetic capacity check: 1,000 distinct input URLs accepted; 1,000 records
  retained in dataset/report aggregation with correct success/failure totals and
  missing-data denominators. Synthetic `.test` domains are not represented as
  real website visits.
- Real local extension checks: known HTTP/CSP/password-field fixture, independent
  CDP requests, actual popup extraction, query-token redaction, two concurrent
  isolated profiles, and resume without rewriting completed records.

The local integration check uncovered a harness startup race: the worker handle
could appear before collection listeners were ready. The launcher now waits for
`allStatesReady` and confirms both request/header listeners before navigation.
Playwright’s default `--disable-extensions` argument is omitted explicitly.
Neither change alters BrowserGuard files or rules.

## Remaining limits

The checks did not establish the absence of BrowserGuard bugs. Toolbar popup
focus behavior, complete cross-frame/worker visibility, geographically different
responses, long-run memory use, hard-kill cleanup, and a sustained 1,000-site run
remain outside this proof of concept. AI model quality was not evaluated and no
external AI service received browsing data. See `README.md` for reproduction,
resource guidance, reporting semantics, and measurement limitations.
