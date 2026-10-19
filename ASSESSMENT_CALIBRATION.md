BrowserGuard assessment calibration — 2026-10-16

The popup again presents three compact Security, Privacy, and Network cards with
Low / Moderate / High levels. The layout follows the checked-in popup at
`0f159b1`: dark green surfaces, mint accents, three columns, and collapsible
technical evidence. The overall summary banner is removed. Context explanations,
keyboard disclosures, glossary, help, theme preference, and technical metrics
from the local redesign are retained. Missing category inputs display Unavailable
instead of implying a complete Low result. Strong known findings remain visible
when other inputs are unavailable. No numeric score is added.

Files changed by this task:

- `modules/assessment/assessment-engine.js`
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js`
- `popup/presentation.js`, `popup/experience.js`
- `tests/assessment-engine.test.js`, `tests/assessment-calibration.test.js`
- `tests/fixtures/governo-historical.json`
- `tests/presentation.test.js`, `tests/popup-experience.test.js`, `tests/popup-ui.test.js`
- `README.md`, `ASSESSMENT_CALIBRATION.md`

The working tree already contained UI/documentation changes and untracked
presentation assets/tests. Those were preserved; this task did not change
`.gitignore`, the `presentation/` directory, collectors, matcher, entity resolver,
datasets, manifest, permissions, or external dependencies/services.

| Rule | Previous behavior | Revised behavior and rationale |
| --- | --- | --- |
| Missing CSP/HSTS/nosniff, report-only/permissive CSP, HSTS observations | Weak signals produced Security observations, rendered as Attention recommended; permissive CSP was moderate | Informational recommendations, retained in details. Missing defense in depth does not demonstrate exploitation or insecure behavior. |
| Missing anti-framing | Informational when CSP also absent; otherwise weak | Always informational. Missing Referrer-Policy and Permissions-Policy now also appear as explicit recommendations when collected. |
| Main-page HTTP; password form targeting HTTP | High | High retained, regardless of positive headers. Form markup is evidence of a target, not proof that a password was submitted. |
| Mixed content | Every observed request made Security High | Script, stylesheet, subframe, XHR/fetch, object, and WebSocket request types remain High; other/unknown types become Moderate. Evidence explicitly says attempts and does not claim successful insecure loading/execution. |
| Two moderate Security signals | High at count >= 2 | Moderate. External password destinations and HTTP iframe markup merit review; their co-occurrence alone does not establish an independently High condition. |
| Broad URL heuristics and ordinary link mismatches | Weak observations could produce Moderate | Informational. Explicit suspicious link mismatches become Moderate. Reporting minimums remain 3 mismatches or 25% of links, or any explicitly suspicious mismatch. |
| Tracker-associated domains/requests | Moderate at >=2 domains OR >=10 requests; High at >=5 domains OR >=30 requests with >=2 domains | Numeric thresholds retained. One domain/7 requests remains informational. Categories remain descriptive, matcher/data unchanged. These are domain-associated request counts, not verified tracking actions. |
| Runtime API categories | >=3 categories, OR unmasked WebGL plus Canvas/Navigator, produced correlated indicators; Navigator hardware properties were stronger than Screen/basic device access | Require >=2 specific sensitive surfaces: Canvas export/readback, unmasked WebGL hardware query, OfflineAudioContext construction. Navigator/Screen, generic WebGL, ordinary AudioContext and any single sensitive surface remain informational. Page-level co-occurrence does not establish a common script or fingerprinting purpose. |
| Limited tracker + limited runtime | Moderate | Low. Two ambiguous observations do not supply defensible independent tracking evidence. |
| Moderate tracker + correlated runtime | High | Retained using the more specific correlation rule. |
| Network attribution | External plus unknown, with raw cross-origin fallback | Only confirmed external attribution contributes. Same-entity and unknown counts remain separate and visible; legacy counts without attribution are unresolved. Unknown attribution is never claimed as confirmed first-party or external. |
| Moderate Network | >=25% ratio OR >=5 domains OR >=20 requests | >=25% ratio with >=5 external requests; OR >=5 domains with >=5 external requests; OR >=20 external requests with >=10% ratio. Avoids tiny-sample ratios and absolute-volume-only escalation. |
| High Network | >=50% ratio with >=10 requests; OR >=15 domains with >=15 requests or >=30 total; OR >=75 requests with >=25% ratio | Numeric thresholds unchanged, applied to confirmed external attribution. These measure exposure, not maliciousness. |
| Missing inputs | Global partial status could turn unrelated Security categories into observations | Source availability assessed per dimension; explicit missing evidence remains separate from findings. |

Engine compatibility is preserved: the internal level identifiers remain
`no-major-issues`/`observations`/`attention`, `low-activity`/`moderate-activity`/
`elevated-activity`, and the existing network identifiers. Presentation maps them
consistently to Low/Moderate/High. Each result exposes ordered reasons, contributing
findings, informational observations, positive signals, and uncertainties.
`countedForEscalation` identifies contributing evidence; positive signals never
subtract from significant findings. The default interface has no raw JSON;
structured evidence remains inside the Technical Details disclosure.

Historical governo.it comparison, evaluated against the pre-change engine from
Git and the revised engine (no live website fetch and no hostname exception):

| Category | Before: engine / local redesign label | After |
| --- | --- | --- |
| Security | observations / Attention recommended | Low |
| Privacy | low-activity / No major findings | Low |
| Network | low-third-party-activity / No major findings | Low, with 10 unresolved cross-origin requests explicitly disclosed |

The supplied observation specifies Navigator/Screen counts, not individual API
names. The fixture therefore leaves API-name evidence empty instead of inventing
it. With only those supplied facts, the previous Privacy engine was already Low.
A separately evaluated variant containing Navigator languages/hardwareConcurrency
plus userAgent produces Moderate before and Low after; this variant illustrates
the old sensitivity and is not asserted as the historical site's actual behavior.
The fixture retains 71 total requests, 61 first-party, 10 cross-origin across 4
domains (ratio rounded to 0.141), 0 confirmed external requests, 10 unknown,
1 tracking-associated domain/7 associated requests/Advertising, Navigator 3,
Screen 2, and no Canvas/WebGL/Audio indicators. Unspecified policy headers are
omitted. The observed anti-framing protection is represented without inventing
the mechanism or header value.

Validation:

- Baseline: `node --test tests/*.test.js`: 33 tests passed.
- Revised suite: 54 tests passed, zero failures. The new regression file adds 21
  cases covering all 14 requested scenarios plus mixed-content types, tiny samples,
  sparse external ratios, ordinary API combinations, same-entity traffic, and
  missing input handling. Existing collector, tracker matching, runtime bridge,
  network attribution, availability, popup interaction, asset, and manifest tests
  also pass. Some existing test files use multiple sequential assertions under
  one Node test-file result; the reported count is Node's runner count.
- Determinism and input immutability are verified using cloned fixtures. Strong
  negative findings survive positive hardening and multiple independent High
  findings remain visible.
- Browser rendering uses Chrome headless and an isolated temporary profile with
  local popup source and the historical fixture. DOM checks passed for all three Low labels, aligned card geometry, no horizontal
  overflow or summary banner, and contributor/observation disclosure rendering.
  The screenshot was visually inspected. This checks the restored layout;
  it is not a live-site or installed-extension end-to-end run.
- `git diff --check` passes. Manifest/permissions and collectors are unchanged.

Sensitivity reductions and remaining limitations:

- Missing/permissive headers and broad URL heuristics no longer escalate. They
  may accompany real vulnerabilities, but the extension has no exploit evidence.
- Standalone sensitive APIs and broad API-category combinations no longer
  escalate; fingerprinting using only one surface or unmonitored APIs may remain
  Low. Co-occurrence can still arise from unrelated legitimate scripts.
- Unknown entity attribution does not escalate Network. Real external exposure
  absent from the local entity dataset can therefore receive Low; the visible
  uncertainty and raw counters are essential to interpreting that level.
- Other/unknown mixed-content types become Moderate; successful insecure loading
  is not established by onBeforeRequest. Collection can miss browser-blocked
  attempts; DOM iframe evidence also does not prove a load.
- Tiny or sparse external traffic and two moderate Security findings no longer
  escalate as far. Network thresholds remain heuristic exposure cutoffs, rather
  than empirically validated maliciousness boundaries.
- Tracker Radar associations can include broad multifunctional domains. The
  retained tracker thresholds still measure associated activity, not request-path
  intent, consent, data exfiltration, or confirmed tracking/fingerprinting.
- Collectors observe a limited window and runtime API names, without values,
  script attribution, timing correlation, or network completion outcomes. Header
  presence does not validate every directive or application behavior; policy
  observations are recommendations, and an explicit policy is not a safety claim.
- A manual loaded-extension run remains needed for live MV3 integration, real
  assistive-technology behavior and native-dialog focus containment. The
  historical fixture is not a claim about governo.it's current behavior.
- This calibration is supported by deterministic regressions, not a labeled
  real-world accuracy benchmark; false positives have not been proven eliminated.

Technical references informing the interpretation (the thresholds are project
policy, not prescriptions from these sources):

- [MDN mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content): request types differ in potential impact and browser handling.
- [Chrome webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest#event-onBeforeRequest): onBeforeRequest precedes completion and cannot establish successful loading.
- [MDN hardwareConcurrency](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency): ordinary applications can use hardware capability information.
