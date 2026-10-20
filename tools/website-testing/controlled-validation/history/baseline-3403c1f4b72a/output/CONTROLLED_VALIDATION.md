# BrowserGuard controlled validation

## Objective and environment

Validate observable signals and the current deterministic rules using local, configured fixtures. No production code, dataset, thresholds, permissions or popup was changed.

Run: 2026-10-19T19:11:32.640Z. Node v25.2.1; darwin/arm64; Playwright 1.58.2; Chromium 145.0.7632.6.

Production fingerprint before: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`; after: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`. Unchanged: **true**.

## Architecture and methodology

Node HTTP/HTTPS servers bind ephemeral loopback ports. Each scenario gets a fresh temporary profile; S18 alone intentionally reuses its tab. All profiles and servers close in finally blocks. Real popup engine calls are captured using the existing collector, without synthetic detector outputs. Server receipts establish actual requests; fixture completion markers establish selected API calls, without storing output values. CDP records requests, selected headers and blocked reasons; its window is independent of extension aggregation. A browser-local routing guard rejects non-fixture HTTP(S) hosts. No public scenario or external service is used.

TLS verification stays enabled. A generated ephemeral self-signed certificate is deliberately not trusted. TLS errors are retained, and dependent scenarios are SKIPPED. Optional --cert/--key accept an already trusted localhost certificate without changing system/browser trust. No CA was installed. The negative TLS control uses a separate self-signed certificate and must still fail. This run does not establish profile-only CA trust.

Origin is scheme+hostname+port; hostname excludes port. BrowserGuard network groups approximate registrable domains, whereas DOM compares hostnames. 127.0.0.1 and assets.controlled.test are different domain groups; they resolve locally but have no confirmed external entity. Different ports alone would not establish third-party ownership. No local resource is labeled a tracker.

## Status definitions and results

PASS: configured condition established and all applicable extension assertions agree. FAIL: established observation contradicts an explicit check; requires investigation before attribution to the extension. NOT_OBSERVABLE: configured phenomenon independently established but unavailable through the relevant browser/extension surface. INCONCLUSIVE: setup, navigation, collection or ground-truth verification insufficient. SKIPPED: prerequisite absent before scenario execution. NOT_OBSERVABLE and INCONCLUSIVE never count as PASS.

Implemented 18; recorded 18; executed 11. PASS 11; FAIL 0; NOT_OBSERVABLE 0; INCONCLUSIVE 0; SKIPPED 7.

PASS / all recorded: 11/18; PASS / executed: 11/11. These are test outcomes, not accuracy, precision, recall or F1.

| ID | Scenario | Status | Expectation | Observation / limitation |
|---|---|---|---|---|
| S01 | HTTPS complete headers | SKIPPED | HTTPS and six protective header groups; Security Low | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S02 | HTTP without TLS | PASS | HTTP observed; Security High | Applicable checks passed |
| S03 | HTTPS without CSP | SKIPPED | CSP absent, other headers present; Security Low | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S04 | HTTPS without HSTS | SKIPPED | HSTS absent, other headers present; Security Low | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S05 | HTTPS without protective headers | SKIPPED | All six header groups absent; Security Low | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S06 | Active mixed content | SKIPPED | Loopback HTTP script received and executed; visible script attempt gives Security High | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S07 | Browser-blocked mixed content | SKIPPED | Non-trustworthy HTTP script attempted; CDP blocked evidence, no server receipt; extension visibility conditional | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S08 | HTTP password form | PASS | One explicit HTTP password action; insecurePasswordForms=1; Security High | Applicable checks passed |
| S09 | HTTPS form with HTTP action | SKIPPED | One explicit HTTP password action; insecurePasswordForms=1; Security High | Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used. |
| S10 | Cross-site local request | PASS | One cross-site script, unknown entity; Network engine Low | Applicable checks passed |
| S11 | 24 cross-site local requests | PASS | 24 unique cross-site scripts, unknown entity; Network engine Low | Applicable checks passed |
| S12 | External resource and iframe | PASS | One external script and one third-party iframe; Security High from HTTP | Applicable checks passed |
| S13 | Hidden iframe | PASS | One hidden iframe; hidden status informational | Applicable checks passed |
| S14 | Canvas API | PASS | Canvas export observed; Privacy Low | Applicable checks passed |
| S15 | WebGL API | PASS | WebGL hardware query observed if available; Privacy Low | Applicable checks passed |
| S16 | Multiple sensitive APIs | PASS | Canvas export and OfflineAudioContext observed; Privacy Moderate | Applicable checks passed |
| S17 | Unavailable page inputs | PASS | Unsupported about:blank: partial inputs, Privacy/Network unavailable; inspect Security protocol limitation | Applicable checks passed |
| S18 | Sequential navigation A to B | PASS | A signals observed; after full navigation B has no A forms/runtime/cross-site requests | Applicable checks passed |

## Detected, unavailable and failed signals

Passed: S02, S08, S10, S11, S12, S13, S14, S15, S16, S17, S18. See results.json for each assertion, actual inputs, assessment, server evidence and CDP records.

Not observable: none recorded (this does not establish universal observability).

Failures: none.

## Assessment Engine

Separate synthetic fixtures: 71; PASS 71; FAIL 0. Expected literals derive from PLAN.md and do not call the engine to construct expected output. These cover Low/Moderate/High, exact/below/above boundaries, combined sensitive surfaces, missing/null/unavailable sources, and immutable inputs. Tracker/entity thresholds are synthetic input tests, not end-to-end detector validation.

## Bugs, limitations and recommendations

Confirmed extension bugs: none attributed automatically. Any failed check is evidence for manual investigation, not automatic proof of a production defect. Review S17: URL analysis treats a non-HTTPS unsupported protocol as usesHTTPS=false, so about:blank may produce a Security High/main-page-http finding despite no HTTP transport. This is a potential protocol-classification issue; a separate production fix would restrict that finding to actual HTTP or mark unsupported URL analysis unavailable.

TLS-dependent cases were not validated where SKIPPED. Never substitute agreeing CDP values for positive mixed-content detector ground truth. S06 uses the browser’s natural trustworthy-loopback exception and does not generalize to arbitrary HTTP origins. S07 depends on browser policy/event visibility and may be NOT_OBSERVABLE. Canvas/WebGL use does not establish fingerprinting intent. MAIN-world events can be spoofed; top-frame hooks, API availability, asynchronous delivery and bounded observation windows limit coverage. S18 covers full navigation only, not SPA, redirects, BFCache, crash recovery or service-worker restarts. Production Tracker Radar matching is not exercised by local fixtures.

Before claiming complete controlled validation, provision a trusted localhost certificate through an independently approved mechanism and rerun HTTPS cases. Investigate failed checks by reproducing their scenario ID, comparing configured fixture, server receipts, raw popup inputs, reason evidence and CDP. Do not change thresholds to make a test pass. Consider an explicit-action-free password form regression in a separate investigation (the DOM detector only counts insecure actions when an action attribute is present).

The existing framework can run 1,000 URLs, but this suite alone does not establish readiness or full detector accuracy. Resolve fundamental skipped/unobservable coverage and review the unsupported-protocol finding first. A 1,000-site benchmark measures field reliability and distribution, not controlled detector correctness.

## Cleanup and audit

Fatal error: none. Pre-existing checks: {"preExistingTests":{"nodeExtension":{"passed":68,"command":"node --test tests/*.test.js"},"nodeFramework":{"passed":12,"command":"node --test tools/website-testing/*.test.cjs"},"pythonAnalysis":{"passed":13,"command":"analysis/.venv/bin/python -m unittest discover -s analysis -p 'test_*.py' -v"}},"newTests":{"node":77,"python":4,"engineFixtures":71},"productionFingerprintUnchanged":true,"productionGitDiff":[],"controlledOrphanProcesses":[],"temporaryProfilesOrCertificatesRemaining":[],"fixturePortsClosed":{"65406":true,"65407":true},"sensitiveOutputFiles":[],"notes":"Post-run audit. No certificate exceptions or system trust changes. No commit/push."}.

Cleanup: {"profilesRemoved":true,"contextsClosed":true,"serversClosed":true}. TLS controls: [{"name":"independent untrusted leaf rejected","pass":true,"error":"page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://localhost:65409/scenario/S01\nCall log:\n\u001b[2m  - navigating to \"https://localhost:65409/scenario/S01\", waiting until \"load\"\u001b[22m\n"}]. Keys/certificates are excluded from saved evidence; temporary generated material is removed. Output contains only synthetic local URLs, selected headers, structural counters and API names.

## Reproduction

See [README.md](../README.md) and [PLAN.md](../PLAN.md) in the parent directory. Run all scenarios with npm run test:controlled from tools/website-testing. Use --scenario S18 (or another ID) and a new --output directory to reproduce. The runner returns nonzero for FAIL, INCONCLUSIVE or source mutation; --require-complete also rejects SKIPPED and NOT_OBSERVABLE. Check statistics rather than interpreting process success as full validation.
