# Targeted final validation: audit before production changes

Baseline production SHA-256: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`.
Git already contains uncommitted website-testing README/package changes and the
controlled-validation directory from the preceding task; retain them.

| Files / responsibility | Current behavior | Expected behavior | Missing regression / risk |
|---|---|---|---|
| `popup/popup.js`, `analyzeURL` | Preserves scheme, sets usesHTTPS=false for every other scheme, labels its indicator HTTP | Explicit HTTP/HTTPS; unsupported scheme retained as unavailable input; neutral protocol display | about/chrome/extension/data/blob/file and invalid/missing URL; no injection into protected pages |
| `modules/assessment/assessment-engine.js` | `usesHTTPS === false` suffices for main-page-http | Require an explicit HTTP protocol or valid HTTP webSecurity URL; unsupported input is partial; independent findings survive | No false High or favorable Low on unsupported pages; legacy synthetic HTTP fixtures need an explicit actual protocol |
| `content/page-analysis.js`, `analyzeForms` | Returns early for absent/empty action | Those cases use the document URL; explicit relative action still uses document base | HTTP/HTTPS x missing/empty/relative/absolute, malformed and non-HTTP schemes, no-password forms; preserve existing counters |
| `tools/website-testing/validate.cjs` | Independent HTTP check repeats usesHTTPS=false equivalence | Check explicit HTTP rather than retain a stale oracle | Avoid validator false positives after fixing engine |
| controlled runner, environment, evaluator, report | 7 TLS skips; separate untrusted leaf; source-mutation guard | Positive and negative TLS controls, server/response/extension header comparisons, missing data neutral, historical fingerprints retained | Local certificate trust must be scoped and verified, negative control stops execution on failure |

Hostname inventory: TLS fixture uses `localhost` (binds IPv4 loopback); HTTP page
uses `127.0.0.1`; cross-site HTTP uses `assets.controlled.test` resolved by a Chromium
host resolver rule to 127.0.0.1. A leaf SAN needs localhost for HTTPS; include
127.0.0.1 for explicit verification. No hosts file changes are needed. Ports alone
are not external ownership. mkcert and NSS certutil are absent; OpenSSL, macOS
security and Homebrew are present. Do not install a CA in macOS automatically.

Chromium version is 145.0.7632.6. Inspect its profile certificate UI and versioned
source before concluding a platform Keychain change is necessary. Chrome's root
verifier accepts platform-local anchors; the separate ServerCertificateDatabase
is profile keyed. Whether trusted roots can be imported through this build's UI
must be established, not assumed. No certificate-error bypass is permitted.

Reproduce defects with regression tests before changing production. Archive the
old controlled output and hash the public benchmark without rewriting it. Only
three production files are candidates for fixes; no manifest, permission, dataset,
threshold, presentation architecture or score change is authorized.

Submit-button `formaction` is outside the current form-level detector. Inspect and
record the limitation; adding a submission-path enumeration system is not required
for the absent/empty form action fix. Never submit a form or read password values.
