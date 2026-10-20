> Archive companion restored during release preparation from the explicitly historical
> pre-implementation section of the maintained plan. This is documentation, not a
> new scenario execution. The original output and its integrity hashes are unchanged.

# Controlled validation: inspection and initial matrix

Inspection of the current manifest, service worker, content scripts, security analyzer,
assessment engine, presentation and existing tests preceded implementation. Production
sources remain the oracle under test, not a place for test hooks.

`webRequest.onBeforeRequest` counts attempts and resets per-tab network, runtime and
security state on main-frame navigation. `onHeadersReceived` selects security headers.
DOM analysis answers `PAGE_ANALYSIS`; MAIN-world wrappers send API-name-only events
through a schema-limited isolated bridge. These events are page-spoofable observations,
not proof of intent. No `all_frames` monitoring is configured. The popup retrieves
snapshots sequentially, checks tab identity, invokes the engine and renders presentation.

Reuse `collect.cjs` for CDP and actual popup capture, `run.cjs` production fingerprint,
`storage.cjs` atomic JSON, and `report.cjs` CSV escaping. Existing tests cover fake DOM,
VM Chrome APIs, calibration and local live smoke; new browser tests must add real
controlled pages rather than substitute those mocks for extension output.

| ID | Signal / component | Independent evidence | Expected input / assessment | Limit |
|---|---|---|---|---|
| S01 | HTTPS + headers / webRequest | server configuration, TLS, CDP headers | HTTPS, six protective header groups; Security Low | trusted local TLS required |
| S02 | HTTP / URL + webRequest | server HTTP URL | HTTPS false; Security High | transport classification, not exploitation |
| S03 | missing CSP / header analyzer | configured response | CSP absent; Security Low | informational only |
| S04 | missing HSTS / header analyzer | configured response | HSTS absent; Security Low | informational only |
| S05 | missing all headers / analyzer | configured response | headers absent; Security Low | no artificial escalation |
| S06 | active mixed request / webRequest | loopback HTTP script receipt and execution marker | mixed script attempt; Security High if visible | natural trustworthy loopback exception; no protection override |
| S07 | blocked mixed request / webRequest | attempted script URL, CDP blockedReason, no server receipt | observation depends on Chrome API window | NOT_OBSERVABLE if browser blocks before extension event |
| S08 | HTTP password form / DOM | explicit HTTP action, empty password input | insecurePasswordForms=1; Security High | never submit or read a value |
| S09 | HTTPS form to HTTP / DOM | explicit action | insecurePasswordForms=1; Security High | no submission needed |
| S10 | cross-site resource / network | unique server resource receipt | unknown third party >=1; Network engine Low | local entity unresolved, not a tracker |
| S11 | 24 cross-site resources / network | 24 unique server receipts | unknown third party=24, partition identity; engine Low | popup may show unavailable attribution |
| S12 | external script + iframe / DOM/network | configured markup and server receipts | externalScriptCount=1, thirdPartyIframeCount=1 | frames not recursively DOM-monitored |
| S13 | hidden iframe / DOM | hidden attribute + computed visibility | hiddenIframeCount=1 | Security remains High on HTTP because of HTTP |
| S14 | canvas export / runtime | fixture completion marker (no pixel output saved) | canvas detected, Privacy Low | API use is not fingerprinting intent |
| S15 | WebGL hardware query / runtime | API availability + call completion | webgl detected, Privacy Low | unavailable GPU => NOT_OBSERVABLE |
| S16 | Canvas + offline audio / runtime | both successful API calls | two sensitive surfaces; Privacy Moderate | no same-script attribution claim by engine |
| S17 | unavailable page / popup | about:blank unsupported URL | partial data, Privacy/Network unavailable; inspect unsupported Security protocol | unsupported page is not a failed detector |
| S18 | A to B / per-tab state | same tab, distinct documents | forms/runtime/network from A absent in B | ordinary full navigation, not SPA/BFCache coverage |

Engine specification: Security HTTP/insecure password/active mixed attempt = High;
external password target/suspicious link/passive mixed = Moderate. Missing headers
are informational. Privacy domains >=2 or requests >=10 = Moderate; domains >=5
or requests >=30 with >=2 domains = High. Two sensitive runtime surfaces = Moderate;
combined with Moderate tracker activity = High. Network uses confirmed external
entities only: Moderate (ratio>=.25 and requests>=5) OR (domains>=5 and requests>=5)
OR (requests>=20 and ratio>=.1); High (ratio>=.5 and requests>=10) OR
(domains>=15 and (requests>=15 or total>=30)) OR (requests>=75 and ratio>=.25).
Missing/null/available:false sources imply partial data; raw low engine levels do
not imply a favorable displayed label when sources are missing.

TLS policy: never use ignoreHTTPSErrors, certificate exceptions, global trust-store
changes, or mixed-content disabling flags. Accept an already trusted local leaf/key
via explicit CLI options. Without them, create an ephemeral self-signed HTTPS fixture
and record the browser's rejection; TLS-dependent scenarios are SKIPPED. On this Mac
there is no verified profile-only CA installation mechanism available in the existing
toolchain. Do not claim full validation or silently alter the system Keychain.


For the later trust investigation and fixes, see the [maintained plan](../../PLAN.md)
and [final fixes](../../FINAL_FIXES.md).
