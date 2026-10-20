# BrowserGuard controlled validation

## Objective and environment

Validate observable signals and deterministic rules using local fixtures. Targeted production corrections are documented below; thresholds, permissions, tracker dataset and popup layout are unchanged.

Run: 2026-10-19T19:26:59.392Z. Node v25.2.1; darwin/arm64; Playwright 1.58.2; Chromium 145.0.7632.6.

Production fingerprint at run start: `0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`; at run end: `0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`. Unchanged: **true**.

## Architecture and methodology

Node HTTP/HTTPS servers bind ephemeral loopback ports. Each scenario gets a fresh temporary profile; S18 alone intentionally reuses its tab. All profiles and servers close in finally blocks. Real popup engine calls are captured using the existing collector, without synthetic detector outputs. Server receipts establish actual requests; fixture completion markers establish selected API calls, without storing output values. CDP records requests, selected headers and blocked reasons; its window is independent of extension aggregation. A browser-local routing guard rejects non-fixture HTTP(S) hosts. No public scenario or external service is used.

TLS verification stays enabled. Default mode creates an ephemeral CA and localhost leaf, then seeds only each fresh Chromium 145 profile’s Default/ServerCertificate database (verified schema v1). Trust metadata and the CA constrain names to localhost and 127.0.0.1/32. No Keychain, OS trust store, ordinary user profile or certificate-error exception is changed. A clean unseeded profile rejects the generated chain; the seeded profile accepts it; the same seeded profile must reject a separate untrusted leaf before any scenario. Keys and profiles are removed in cleanup. Provided-certificate and deliberately-untrusted modes are separately labeled in configuration.

Trust scope: Disposable profile Default/ServerCertificate, schema v1; localhost and 127.0.0.1/32 only. Public root fingerprint: `7B:DB:EF:04:5A:E0:25:03:6C:10:90:87:C0:08:D8:F5:84:31:AB:03:77:BE:35:99:74:9A:69:DA:30:41:5D:2B`.

| TLS control | Result | Evidence |
|---|---|---|
| generated CA rejected by clean profile | PASS | page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://localhost:49313/scenario/S01 |
| fixture certificate accepted | PASS | TLS 1.3 |
| independent untrusted leaf rejected | PASS | page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://localhost:49319/scenario/S01 |

Origin is scheme+hostname+port; hostname excludes port. BrowserGuard network groups approximate registrable domains, whereas DOM compares hostnames. 127.0.0.1 and assets.controlled.test are different domain groups; they resolve locally but have no confirmed external entity. Different ports alone would not establish third-party ownership. No local resource is labeled a tracker.

## Status definitions and results

PASS: configured condition established and all applicable extension assertions agree. FAIL: established observation contradicts an explicit check; requires investigation before attribution to the extension. NOT_OBSERVABLE: configured phenomenon independently established but unavailable through the relevant browser/extension surface. INCONCLUSIVE: setup, navigation, collection or ground-truth verification insufficient. SKIPPED: prerequisite absent before scenario execution. NOT_OBSERVABLE and INCONCLUSIVE never count as PASS.

Implemented 18; recorded 18; executed 18. PASS 17; FAIL 0; NOT_OBSERVABLE 1; INCONCLUSIVE 0; SKIPPED 0.

PASS / all recorded: 17/18; PASS / executed: 17/18. These are test outcomes, not accuracy, precision, recall or F1.

| ID | Scenario | Status | Expectation | Observation / limitation |
|---|---|---|---|---|
| S01 | HTTPS complete headers | PASS | HTTPS and six protective header groups; Security Low | security: Low; privacy: Low; network: Low; 19 assertions passed |
| S02 | HTTP without TLS | PASS | HTTP observed; Security High | security: High; privacy: Low; network: Low; 6 assertions passed |
| S03 | HTTPS without CSP | PASS | CSP absent, other headers present; Security Low | security: Low; privacy: Low; network: Low; 19 assertions passed |
| S04 | HTTPS without HSTS | PASS | HSTS absent, other headers present; Security Low | security: Low; privacy: Low; network: Low; 19 assertions passed |
| S05 | HTTPS without protective headers | PASS | All six header groups absent; Security Low | security: Low; privacy: Low; network: Low; 19 assertions passed |
| S06 | Active mixed content | PASS | Loopback HTTP script received and executed; visible script attempt gives Security High | security: High; privacy: Low; network: Low; 7 assertions passed |
| S07 | Browser-blocked mixed content | NOT_OBSERVABLE | Non-trustworthy HTTP script attempted; CDP blocked evidence, no server receipt; extension visibility conditional | CDP confirms a mixed-content block before any extension request observation; no server receipt. API observation limit, not a demonstrated detector false negative. |
| S08 | HTTP password form | PASS | One explicit HTTP password action; insecurePasswordForms=1; Security High | security: High; privacy: Low; network: Low; 7 assertions passed |
| S09 | HTTPS form with HTTP action | PASS | One explicit HTTP password action; insecurePasswordForms=1; Security High | security: High; privacy: Low; network: Low; 6 assertions passed |
| S10 | Cross-site local request | PASS | One cross-site script, unknown entity; Network engine Low | security: High; privacy: Low; network: Low; 8 assertions passed |
| S11 | 24 cross-site local requests | PASS | 24 unique cross-site scripts, unknown entity; Network engine Low | security: High; privacy: Low; network: —; 8 assertions passed |
| S12 | External resource and iframe | PASS | One external script and one third-party iframe; Security High from HTTP | security: High; privacy: Low; network: Low; 9 assertions passed |
| S13 | Hidden iframe | PASS | One hidden iframe; hidden status informational | security: High; privacy: Low; network: Low; 6 assertions passed |
| S14 | Canvas API | PASS | Canvas export observed; Privacy Low | security: High; privacy: Low; network: Low; 7 assertions passed |
| S15 | WebGL API | PASS | WebGL hardware query observed if available; Privacy Low | security: High; privacy: Low; network: Low; 7 assertions passed |
| S16 | Multiple sensitive APIs | PASS | Canvas export and OfflineAudioContext observed; Privacy Moderate | security: High; privacy: Moderate; network: Low; 8 assertions passed |
| S17 | Unavailable page inputs | PASS | Unsupported about:blank: all five inputs unavailable, all cards unavailable; no HTTP finding | security: —; privacy: —; network: —; 7 assertions passed |
| S18 | Sequential navigation A to B | PASS | A signals observed; after full navigation B has no A forms/runtime/cross-site requests | security: High; privacy: Low; network: Low; 10 assertions passed |

## Detected, unavailable and failed signals

Passed: S01, S02, S03, S04, S05, S06, S08, S09, S10, S11, S12, S13, S14, S15, S16, S17, S18. See results.json for each assertion, actual inputs, assessment, server evidence and CDP records.

Not observable: S07: CDP confirms a mixed-content block before any extension request observation; no server receipt. API observation limit, not a demonstrated detector false negative..

Failures: none.

## Assessment Engine

Separate synthetic fixtures: 71; PASS 71; FAIL 0. Expected literals derive from PLAN.md and do not call the engine to construct expected output. These cover Low/Moderate/High, exact/below/above boundaries, combined sensitive surfaces, missing/null/unavailable sources, and immutable inputs. Tracker/entity thresholds are synthetic input tests, not end-to-end detector validation.

## Bugs, limitations and recommendations

Confirmed defect families: 2. unsupported-protocol-security: about:blank and other non-HTTP schemes generated a main-page-http High finding from usesHTTPS=false. Correction: Explicit HTTP evidence only; unsupported URL input unavailable, preserving original scheme and independent findings. password-default-action: Missing/empty password-form action returned early and failed to count the default HTTP destination. Correction: Use document URL for absent/empty action; document base URI for explicit relative action.

Production before fixes: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`. Production after fixes: `0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`. Exact production files: content/page-analysis.js, modules/assessment/assessment-engine.js, popup/popup.js. Production stayed unchanged during this run.

Before fixes: 27/41 targeted checks passed; 14 failed. After fixes: 220 automatic checks passed. The 71 engine cases are included, not added a second time.

| Regression suite | Passed | Exit code |
|---|---:|---:|
| extension | 109/109 | 0 |
| framework | 14/14 | 0 |
| controlled-node | 77/77 | 0 |
| analysis-python | 13/13 | 0 |
| controlled-python | 7/7 | 0 |

Baseline: 11 PASS, 7 SKIPPED. Previous controlled output remains byte-for-byte in history/baseline-3403c1f4b72a/output. Public benchmark and analysis hashes were independently audited.

### Protocols

Confirmed before: about:blank had a main-page-http High finding. After: original scheme retained as unavailable URL input, no HTTP finding, all three cards unavailable (S17). HTTP/HTTPS remain explicit. Seven unsupported schemes and missing/null data are covered by parser/engine regressions; protected pages are not injected.

### Password forms

Confirmed before: missing/empty action skipped the default HTTP destination. After: fallback to document URL and correct relative-base resolution. The 10-cell action matrix, missing/empty actions, malformed/non-HTTP URLs, no-password forms and independent Security findings are covered by regressions.

| Additional live case | Expected insecure forms | Observed | Status |
|---|---:|---:|---|
| HTTP document | 4 | 4 | PASS |
| HTTPS document | 1 | 1 | PASS |

S17 now requires no HTTP finding and unavailable Security/Privacy/Network cards. Missing URL data cannot become an HTTP assertion or a favorable Low card; independent password or mixed-content findings still contribute. Missing/empty form action resolves to the document URL; explicit relative action follows the document base URI. No real submission is performed.

S06 uses the browser’s natural loopback exception, not general permission to load arbitrary HTTP content. S07 requires attempted URL, CDP mixed-content block, no server receipt and no script execution; absence from webRequest is NOT_OBSERVABLE rather than a detector bug. Missing protective headers remain informational. Tests compare configured server headers, actual CDP response and extension inputs; an unavailable response is not treated as an absent header.

Remaining limits: profile database provisioning is version-coupled to Chromium 145 schema v1 and refuses unverified major versions. Native WebUI import opens a desktop file dialog not controlled by Playwright’s HTML file chooser, so the suite seeds equivalent constrained user trust into an empty profile before startup; it does not bypass verification. MAIN-world runtime signals are page-spoofable and API use does not prove intent. DOM/runtime hooks are top-frame only; bounded windows are not complete coverage. Full navigation isolation does not cover SPA/BFCache or worker crashes. Submit-button formaction overrides are outside the existing form-level detector and were not added by this fix. Local tracker matching is not exercised; tracker threshold tests remain synthetic.

The framework supports 1,000 URLs. A larger field benchmark can assess operational reliability after these regressions pass, but cannot establish detector accuracy or recover browser-blocked signals unavailable to webRequest. Preserve production fingerprints and distinguish unknown entity ownership from confirmed external exposure.

## Cleanup and audit

Fatal error: none. Full audit: [audit.json](audit.json). Regression evidence: [regression-checks.json](regression-checks.json).

Audit: thresholds unchanged **true**; manifest/permissions unchanged **true**. Orphan processes 0; remaining temporary profiles/certificates 0; secret output files 0.

Verified unchanged: 121 public benchmark files and 25 public analysis files. Historical controlled mismatches: 0. Exact Git changes are listed in audit.json.

Cleanup: {"profilesRemoved":true,"contextsClosed":true,"serversClosed":true}. Keys/certificates are excluded from saved evidence; temporary generated material is removed. Output contains only synthetic local URLs, selected headers, structural counters and API names.

## Reproduction

See [README.md](../README.md) and [PLAN.md](../PLAN.md) in the parent directory. Run all scenarios with npm run test:controlled from tools/website-testing. Use --scenario S18 (or another ID) and a new --output directory to reproduce. The runner returns nonzero for FAIL, INCONCLUSIVE or source mutation; --require-complete also rejects SKIPPED and NOT_OBSERVABLE. Check statistics rather than interpreting process success as full validation.
