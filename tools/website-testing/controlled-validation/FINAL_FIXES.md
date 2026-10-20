# Final controlled validation and targeted fixes

The [pre-change audit](TARGETED_AUDIT.md) identified affected code before production
changes. Regression tests then reproduced both suspected defects: 41 cases ran,
27 passed and 14 failed on the original code. The failures included protocols,
source availability, absent/empty password actions and relative base resolution.
The transcript and original controlled output are archived in
`history/baseline-3403c1f4b72a/`; `integrity.json` records their SHA-256 hashes and
those of the existing public benchmark/analysis. These historic results describe
the original production fingerprint, not the corrected version.

## Confirmed defects and minimal corrections

1. **Unsupported protocol interpreted as HTTP.** `analyzeURL` preserved the scheme
   but set usesHTTPS=false for about/chrome/extension/data/blob/file. The engine
   treated that boolean as sufficient for `main-page-http`, and presentation
   described an unencrypted HTTP connection even on about:blank. `popup/popup.js`
   now preserves the scheme with available=false and usesHTTPS=null for unsupported
   protocols, and leaves their protocol badge neutral. In
   `modules/assessment/assessment-engine.js`, only explicit HTTP URL evidence or a
   valid HTTP web-security page URL produces that finding. Unknown/unsupported URL
   analysis contributes to missingSources/partial status. Independent password or
   mixed-content evidence still escalates as before. No score or threshold changed.
2. **Missing/empty password form action skipped.** `content/page-analysis.js`
   returned early for both cases and reported zero insecure password targets on
   HTTP. It now uses the document URL for absent/empty action and document.baseURI
   for explicit relative action. HTTP destinations count once per password form;
   HTTPS destinations do not count as insecure merely because the document is HTTP.
   Malformed URLs remain ignored; non-HTTP destinations do not count as HTTP.
   No submission occurs and no password value is read.

Only those three production files changed. Manifest, Chrome permissions, Tracker
Radar, all Assessment Engine thresholds and popup layout are unchanged.

`tests/targeted-security-regressions.test.js` adds 41 unit regressions covering HTTP,
HTTPS, seven unsupported schemes, missing/null/unavailable data, malformed inputs,
independent findings, the 10-cell password action matrix, no-password forms,
non-HTTP/malformed actions and `<base>` resolution. Protected Chrome pages use
parser/engine tests; extension injection is never forced there. about:srcdoc/blob
remain explicitly unsupported without guessing inherited context.

Two pre-existing test fixtures and the controlled engine HTTP fixture formerly
supplied usesHTTPS=false with either no scheme or an inherited HTTPS scheme. They
now explicitly supply HTTP to preserve their original intended HTTP/High checks;
no assertion was relaxed. The website validator's independent HTTP oracle was
updated to explicit protocol matching and has two dedicated regressions in
`targeted-protocol.test.cjs`. All 71 existing controlled engine cases still pass.
The additional live password matrix verifies the real browser-resolved actions
against the actual extension popup on HTTP and trusted HTTPS.

## TLS isolation and controls

mkcert and NSS certutil were not installed. OpenSSL and Python's built-in sqlite3
were sufficient. The Chromium 145 source and live certificate manager established
that `ServerCertificateDatabase` is profile keyed. The native import file picker
cannot be handled as an HTML file input by Playwright; the test helper therefore
seeds the same constrained root trust into an empty temporary profile before launch.
The helper refuses an existing user profile, non-temporary directory or unverified
browser major version. This is trust configuration, not a verifier bypass.

An ephemeral constrained CA issues a localhost/127.0.0.1 leaf. Normal Chromium
verification remains active. A clean profile rejects that chain; a seeded profile
accepts it using TLS; the same seeded profile rejects the independent untrusted
leaf. No macOS Keychain, OS CA list, system policy, hosts file or normal browser
profile changed. Keys never enter the repository or report and are removed with
temporary certificate material. No additional dependency or public certificate
service is used. See README.md for source links and exact reproduction commands.

## Interpretation and remaining limits

All 18 core scenarios execute. S07 can correctly be NOT_OBSERVABLE: its HTTP script
attempt is present in fixture/CDP evidence, Chrome reports mixed-content blocking,
server receipts and script execution are zero, and webRequest exposes no attempt.
That is an API observation limit, not a demonstrated detector false negative.
S06's naturally allowed loopback HTTP script is a positive controlled observation;
it does not represent general mixed-content policy for public hosts.

Submit-button formaction overrides are outside the current form-level detector.
Enumerating every submission path would be a separate feature and was not added.
Runtime events remain top-frame, bounded and page-spoofable; Canvas/WebGL usage is
not proof of fingerprinting intent. Local entity ownership remains unresolved and
tracker detection is not tested end to end. Schema provisioning is version coupled.

See `output/CONTROLLED_VALIDATION.md`, `output/results.json`, `output/audit.json`
and the regression log for actual counts, final fingerprints and cleanup evidence.
A 1,000-site field benchmark is operationally reasonable after these checks pass,
with fixed source/version/resource settings and explicit observation limitations.
It is not a detector accuracy experiment. Historical 100-site data was not rewritten.
