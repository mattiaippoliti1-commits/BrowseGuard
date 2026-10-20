# Controlled detection validation

Read [PLAN.md](PLAN.md) for the pre-implementation inspection, scenario matrix and
current rule specification. This suite never modifies production thresholds or installs
trust material outside disposable test profiles. The two reproduced production
defects and their targeted fixes are documented in [FINAL_FIXES.md](FINAL_FIXES.md). It reuses the actual popup collector; synthetic engine fixtures
are deliberately separate from browser scenarios.

From the repository root:

```sh
cd tools/website-testing
npm ci
npm run install-browser
npm run test:controlled
npm run test:controlled:engine
node --test controlled-validation/*.test.cjs
```

If Chromium is already installed at a custom location, set
`PLAYWRIGHT_BROWSERS_PATH` consistently for installation and execution. This machine's
existing installation uses `/tmp/browserguard-playwright-browsers`. Node >=22,
OpenSSL with `req -addext` support, and the existing Playwright dependency are needed.
No new package dependency is introduced. Python 3 with its standard-library sqlite3
module is required for isolated profile trust provisioning. Concurrency is fixed at 1, appropriate for
an Apple Silicon Mac with 8 GB RAM. Allow roughly 1–3 minutes and a few hundred MB
for the isolated browser, plus existing Chromium installation space. The existing
benchmark's 1,000-URL runner remains independent.

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/browserguard-playwright-browsers npm run test:controlled
# Reproduce one scenario without overwriting previous evidence:
npm run test:controlled -- --scenario S18 --output controlled-validation/output-reproduce
# Enforce complete positive outcomes (also rejects SKIPPED / NOT_OBSERVABLE):
npm run test:controlled -- --require-complete --output controlled-validation/output-strict
# Optional: use a genuinely browser-trusted LOCAL localhost leaf/key:
npm run test:controlled -- --cert /path/to/localhost.crt --key /path/to/localhost.key --output controlled-validation/output-tls
```

Options: `--scenario S01..S18`, `--output DIR` (default: unique `output-TIMESTAMP`),
`--tls-mode profile|untrusted|provided` (default profile), `--timeout MS` (default 15000),
`--observe MS` (default 1500), `--cert FILE --key FILE`, `--require-complete`.
Default runs use new directories excluded from Git. The reviewed final report is
preserved in `output/`; it is never silently overwritten by later runs.
Explicit output directories are exclusive: previous results are never silently overwritten.
Scenarios are deterministic, profiles are fresh for each case; S18 intentionally
keeps the same tab across two full navigations. Servers bind only loopback with
OS-assigned ports. Non-fixture HTTP(S) browser requests are rejected. SIGINT/SIGTERM
stop after the current bounded case and retain evidence; finally blocks close
browser contexts and servers and remove generated certificates and profiles.
SIGKILL/power loss cannot run cleanup; verify no process is using an abandoned
`.lock` before manually removing it. Results are checkpointed after every case;
resume is not implemented because each controlled run is short and deterministic.

## HTTPS prerequisite

The default **profile** mode creates a two-day ephemeral CA and a localhost leaf
with SANs `DNS:localhost` and `IP:127.0.0.1`. The root certificate and profile trust
metadata constrain issuance to localhost and 127.0.0.1/32. Before browser startup,
`profile_trust.py` provisions one root into the empty temporary profile's
`Default/ServerCertificate` SQLite database. It refuses existing/non-disposable
profiles and unverified browser major versions. The schema/protobuf are verified
for **Chromium 145.0.7632.6**, pinned by existing Playwright 1.58.2.

This configures the ordinary profile user trust anchor consumed by Chromium's real
certificate verifier. It does not set a certificate exception or disable chain,
validity, name, TLS or mixed-content checks. No macOS security/Keychain command is
executed, no system trust is installed, and no permission to change the OS trust
store is needed. Each scenario receives a newly provisioned temporary profile;
closing it and deleting its directory removes that trust. All CA/leaf keys and
certificates stay in a separate private temporary directory, removed after the run.

The implementation was verified against versioned Chromium sources:
[profile-keyed service](https://raw.githubusercontent.com/chromium/chromium/145.0.7632.6/chrome/browser/net/server_certificate_database_service_factory.cc),
[schema v1 and verifier trust mapping](https://raw.githubusercontent.com/chromium/chromium/145.0.7632.6/components/server_certificate_database/server_certificate_database.cc),
[trust metadata protobuf](https://raw.githubusercontent.com/chromium/chromium/145.0.7632.6/components/server_certificate_database/server_certificate_database.proto).
The certificate manager UI exposes trusted-certificate import, but its native
file picker is not intercepted by Playwright's HTML file chooser. Provisioning
its equivalent database before startup avoids native-dialog automation and OS
trust changes. Future browser versions must be explicitly reverified before use;
the helper fails closed for major versions other than 145.

Three real browser controls run before scenarios: an unseeded profile rejects the
generated CA, a seeded profile accepts the localhost leaf, and that same seeded
profile rejects an independent self-signed leaf. A failed positive/default or
negative control aborts the run. `--tls-mode untrusted` deliberately reproduces
the old seven TLS skips without provisioning a CA. `--cert FILE --key FILE`
selects provided mode and leaves trust configuration to the caller; the independent
negative control remains mandatory. Do not install a system CA automatically.

```sh
# Extra live password-form matrix (HTTP and HTTPS, no submit):
PLAYWRIGHT_BROWSERS_PATH=/tmp/browserguard-playwright-browsers node controlled-validation/password-live.cjs /tmp/browserguard-password-live.json
```


## Evidence and interpretation

`results.json` holds actual captured inputs, engine outputs, displayed labels,
configured expectation, per-assertion evidence, CDP and server receipts. No response
body, cookie, authorization header, password value, pixel data, rendered GPU
identifier or audio data is recorded. Page flags report only successful API calls.
The HTTPS certificate and private key are never serialized. `results.csv` is a
compact summary with evidence; `scenario-matrix.csv` is the configured matrix;
`CONTROLLED_VALIDATION.md` is generated alongside them.

PASS means applicable assertions agree with established conditions. FAIL requires
manual attribution; it is not an automatic confirmed extension bug. INCONCLUSIVE
means setup/collection/ground truth insufficient. NOT_OBSERVABLE means established
behavior is unavailable through the relevant surface. SKIPPED means a prerequisite
was absent. Run without `--require-complete` can exit zero despite coverage gaps;
review status counts and the report. FAIL, INCONCLUSIVE, fatal errors, interruption,
engine failure or changed production fingerprint always return nonzero.

Headers missing do not escalate Security. HTTP does. Local cross-site resources
have unresolved entities: Network engine can stay Low while the popup displays
unavailable attribution. Local servers are not Tracker Radar matches; tracker
threshold fixtures do not validate real tracker detection. S06 uses natural
loopback trustworthiness if supported; S07 uses a non-trustworthy `.test` host
resolved to loopback, allowing ordinary Chrome mixed-content policy to operate.
Blocked attempts may be visible only to CDP, not extension webRequest. API usage
has no asserted malicious intent. The unsupported `about:blank` case requires all cards unavailable and no HTTP
finding. The historical 11-PASS/7-SKIPPED output remains under `history/`; it has
its original production fingerprint. S07 remains NOT_OBSERVABLE where Chrome
blocks before webRequest, and is never included in the PASS numerator.

## Offline Python adapter

The public benchmark module does not share this status schema. A small separate
standard-library adapter preserves all five statuses and explicit denominators:

```sh
python3 controlled-validation/summarize.py --input controlled-validation/output/results.json --output controlled-validation/output/statistics
python3 -m unittest discover -s controlled-validation -p 'test_*.py' -v
```

It emits overall PASS percentages and per-category outcome coverage; it does not
compute accuracy, precision, recall or F1. No network or AI service is used.
