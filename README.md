# BrowserGuard

BrowserGuard is a Chrome Manifest V3 extension for local, privacy-preserving
analysis of web page security and network activity.

## Implemented Modules

- URL Analysis: parses the active tab URL and shows protocol, hostname, length,
  subdomain count, IP hostname detection, Punycode detection, HTTPS, long URL,
  `@` usage, and URL encoding indicators.
- Page Analysis: uses a content script to inspect forms, password fields,
  external forms, insecure password form actions, links, mismatched visible
  links, iframes, hidden iframes, and external scripts.
- Network Activity: uses a Manifest V3 background service worker and
  `chrome.webRequest.onBeforeRequest` to observe requests per tab without
  blocking or modifying them.
- Tracker Detection: classifies some third-party network requests as known
  trackers by matching hostnames against a local dataset.
- Runtime Privacy: observes selected runtime API usage associated with browser
  fingerprinting indicators, without collecting fingerprint values.
- Web Security Configuration: observes selected main document security headers,
  mixed content, and iframe security configuration.
- Assessment Engine: combines existing URL, DOM, network, runtime privacy, and
  web security snapshots into separate Security, Privacy, and Network
  assessments.

## Network Activity

Network Activity describes what the page communicates with. It keeps state per
tab and records:

- total observed requests;
- first-party requests;
- third-party requests;
- distinct third-party hostnames;
- request counts by Chrome resource type;
- request counts per third-party hostname.

First-party vs third-party classification uses a centralized registrable-domain
heuristic so that hosts such as `www.example.com` and `static.example.com` are
normally treated as the same site. This is not a complete Public Suffix List
implementation, so uncommon multi-label public suffixes may still be grouped
incorrectly.

## Tracker Detection

Tracker Detection is separate from Network Activity:

- Network Activity observes requests.
- Tracker Detection classifies some third-party requests using a knowledge
  base.

A third-party domain is not automatically a tracker. BrowserGuard only labels a
domain as a `Known Tracker` when the request hostname matches an entry in the
local tracker dataset.

The matching runs locally inside the extension. BrowserGuard does not send
visited URLs, hostnames, request data, history, cookies, request bodies,
Authorization headers, or POST data to external services.

## Tracker Dataset

The current dataset is a small local prototype subset in `data/tracker-data.js`.

- Source basis: DuckDuckGo Tracker Radar
- Source repository: https://github.com/duckduckgo/tracker-radar
- Source license: Creative Commons Attribution-NonCommercial-ShareAlike 4.0
  International
- BrowserGuard subset review date: 2026-09-28
- Current subset size: 15 domains
- Structure: each entry contains a domain and category

Categories currently used:

- Analytics
- Advertising
- Social

The subset is intentionally small for a university prototype. It demonstrates
the architecture and local matching behavior without bundling a large external
dataset.

## Domain Matching

Tracker matching is domain-bound:

- `example.com` matches `example.com`;
- `tracker.example.com` matches `example.com`;
- `notexample.com` does not match `example.com`;
- `example.com.evil.test` does not match `example.com`.

The matcher uses suffix lookup over hostname labels and a `Map` of known tracker
domains. It avoids substring matching such as `hostname.includes(domain)`.

## Limitations

- BrowserGuard detects only trackers present in the local dataset.
- No match does not prove that a page has no tracking.
- A known tracker does not imply malware, phishing, or that the website is
  unsafe.
- Third-party does not mean tracker.
- Tracker Detection is currently applied to third-party requests.
- CNAME uncloaking and DNS resolution are not implemented.
- First-party tracking and first-party-hosted tracker infrastructure may not be
  detected.
- Runtime fingerprinting indicators cover selected APIs only; cookie analysis,
  permission monitoring, WHOIS, DNS intelligence, domain reputation,
  malware/phishing blacklists, and request blocking are not implemented.

## Runtime Privacy / Fingerprinting Indicators

Runtime Privacy observes selected privacy-sensitive APIs from page scripts.
Because Chrome content scripts normally run in an isolated world, BrowserGuard
installs `content/runtime-monitor.js` in the page `MAIN` world at
`document_start`. That monitor wraps selected APIs and emits schema-limited
`CustomEvent` messages to `content/runtime-bridge.js`, which runs as a normal
isolated content script.

The bridge validates each event and forwards only accepted event metadata to the
background service worker. The page can potentially dispatch fake events, so the
bridge and background treat this channel as untrusted. Events cannot request
privileged actions and cannot access `chrome.*`; they only describe an observed
category and API/property name.

Monitored categories:

- Canvas: `HTMLCanvasElement.toDataURL`, `HTMLCanvasElement.toBlob`,
  `CanvasRenderingContext2D.getImageData`
- WebGL: `WebGLRenderingContext.getParameter`,
  `WebGL2RenderingContext.getParameter`, `getExtension`, including observation
  of `WEBGL_debug_renderer_info` access and unmasked vendor/renderer parameter
  requests
- Audio: `AudioContext`, `OfflineAudioContext`
- Device Information: `navigator.hardwareConcurrency`,
  `navigator.deviceMemory`, `navigator.languages`, `navigator.platform`,
  `navigator.userAgent`, `navigator.maxTouchPoints`
- Screen Information: `screen.width`, `screen.height`, `screen.availWidth`,
  `screen.availHeight`, `screen.colorDepth`, `screen.pixelDepth`

Runtime Privacy stores only that an API/property was accessed. It does not store
canvas output, images, audio output, GPU renderer/vendor strings, user agent
values, screen resolution, CPU count, device memory, or other fingerprint values.

The popup shows `Multiple fingerprinting indicators detected` only when at least
three runtime categories are observed in the current tab. This is a descriptive
indicator, not a global risk score and not proof of malicious behavior.

Runtime monitor limitations:

- Existing tabs may need a refresh after extension load for the `document_start`
  MAIN-world monitor to be installed early.
- Pages can spoof bridge events, so this signal is observational rather than
  authoritative.
- Browser APIs that are non-configurable or absent are skipped safely.
- Legitimate graphics, audio, feature detection, or responsive design code can
  trigger API usage indicators.
- BrowserGuard does not block, spoof, randomize, or modify fingerprint-related
  APIs.

## Web Security Configuration

Web Security Configuration analyzes the main document response and related page
configuration. It is an observation module, not a vulnerability scanner and not
a risk score.

BrowserGuard currently checks:

- HTTPS connection status
- `Content-Security-Policy`
- `Content-Security-Policy-Report-Only`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- anti-framing configuration through CSP `frame-ancestors` and
  `X-Frame-Options`
- mixed content requests observed by the existing Network Activity collector
- iframe security metrics from Page Analysis

CSP parsing is intentionally lightweight. It reports technical observations such
as wildcard sources, `'unsafe-inline'`, and `'unsafe-eval'`, but these
observations do not automatically imply that the page is vulnerable.

HSTS parsing extracts `max-age`, `includeSubDomains`, and `preload`. A `max-age`
below 180 days is shown as a configuration observation. Lack of `preload` is not
treated as a problem.

Mixed content detection counts HTTP subresource requests observed from an HTTPS
main page. It uses the request URL seen by `webRequest.onBeforeRequest`; redirect
chains and final post-redirect URLs are not fully reconstructed in this version.

Iframe security distinguishes total iframes, third-party iframes, sandboxed
iframes, third-party iframes without sandbox, sandbox tokens, and HTTP iframes
inside HTTPS pages. An unsandboxed iframe is reported as evidence only; it is
not automatically labeled as a vulnerability.

BrowserGuard deliberately does not store cookies, `Set-Cookie`, Authorization
headers, response bodies, request bodies, POST data, or unrelated HTTP headers.
Absence of a security header does not automatically mean that the site has a
vulnerability.

## Assessment Engine

The Assessment Engine is implemented in
`modules/assessment/assessment-engine.js`. It is a deterministic, UI-independent
module with no DOM or Chrome API dependency. The popup passes the snapshots that
BrowserGuard already collects and renders the returned summaries in a temporary
Assessment card.

Input snapshot:

- `urlAnalysis`: structured URL indicators from the popup URL parser.
- `pageAnalysis`: DOM/form/link/iframe metrics from the content script.
- `networkActivity`: request counters, third-party domains, and tracker counts.
- `runtimePrivacy`: selected fingerprinting-related runtime API indicators.
- `webSecurity`: HTTPS, selected security headers, mixed content, and iframe
  configuration.

Output shape:

- `dataStatus`: `complete` or `partial`.
- `missingSources`: ordered list of unavailable input sources.
- `security`, `privacy`, `network`: independent dimension objects with
  `level`, `summary`, `reasons`, and `positiveSignals`.

BrowserGuard intentionally does not calculate a global numeric score. The three
dimensions are separate so that security hardening, privacy-related activity,
and third-party network volume are not collapsed into one ambiguous number.

Security levels:

- `no-major-issues`
- `observations`
- `attention`

Security combines strong, moderate, and weak observations. Strong observations
such as an HTTP main page, mixed content, or insecure password forms produce
`attention`. Two moderate observations or four weak observations also produce
`attention`. A smaller number of observations produces `observations`. When CSP
is completely absent and no `X-Frame-Options` header is observed,
anti-framing absence is kept as informational evidence instead of adding a
second weak signal for escalation.

Privacy levels:

- `low-activity`
- `moderate-activity`
- `elevated-activity`

Tracker activity becomes moderate at 2 tracker domains or 10 tracker requests,
and elevated at 5 tracker domains, or at 30 tracker requests when at least 2
tracker domains are involved. Tracker categories such as Analytics,
Advertising, and Social are descriptive evidence only; they are not weighted.
Runtime privacy activity is considered multiple when at least 3 monitored
categories are observed. WebGL hardware information alone does not create a
significant escalation, but WebGL hardware information combined with Canvas or
Device Information is treated as combined fingerprinting-related indicators.
Moderate tracker activity combined with multiple runtime categories is treated
as elevated privacy-related activity.

Network levels:

- `low-third-party-activity`
- `moderate-third-party-activity`
- `high-third-party-activity`

Third-party network activity becomes moderate at a 25% third-party request
ratio, 5 third-party domains, or 20 third-party requests. It becomes high at a
50% third-party request ratio only when at least 10 third-party requests were
observed. It also becomes high at 15 third-party domains when either at least
15 third-party requests or at least 30 total requests were observed, or at 75
third-party requests when the ratio is also at least 25%.

`high-third-party-activity` means elevated network activity toward third-party
origins. It does not mean high security risk, a dangerous website, or an unsafe
website.

The engine avoids double counting by keeping related URL heuristics in one
reason, keeping tracker classification in Privacy, and keeping third-party
volume in Network. Missing data is reported through `dataStatus` and
`missingSources`; unavailable data is never treated as a positive signal.
Missing Network Activity or Runtime Privacy data also adds a
`privacy-data-incomplete` informational reason so incomplete privacy assessment
does not look like observed zero activity.

Each non-baseline assessment includes structured reasons such as:

```json
{
  "id": "known-trackers",
  "severity": "medium",
  "message": "Known tracker activity was observed",
  "evidence": {
    "trackerDomainCount": 2,
    "trackerRequests": 12,
    "categories": ["Analytics"]
  }
}
```

Assessment limitations:

- It is heuristic and observational, not a vulnerability scanner.
- It does not certify that a site is safe or unsafe.
- It uses only BrowserGuard's existing local snapshots.
- Incomplete snapshots reduce confidence and are surfaced explicitly.
- The popup card is temporary and intentionally compact.

## Project Structure

```text
browserguard/
├── manifest.json
├── README.md
├── background/
│   └── service-worker.js
├── content/
│   ├── page-analysis.js
│   ├── runtime-bridge.js
│   └── runtime-monitor.js
├── data/
│   └── tracker-data.js
├── modules/
│   ├── assessment/
│   │   └── assessment-engine.js
│   ├── security/
│   │   └── web-security-analyzer.js
│   └── trackers/
│       └── tracker-matcher.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── test-pages/
│   ├── dom-analysis-test.html
│   ├── runtime-privacy-test.html
│   └── web-security-test.html
└── tests/
    ├── assessment-engine.test.js
    ├── background-network.test.js
    ├── background-runtime.test.js
    ├── background-web-security.test.js
    ├── manifest-paths.test.js
    ├── page-analysis-iframe.test.js
    ├── runtime-monitor.test.js
    ├── tracker-matcher.test.js
    └── web-security-analyzer.test.js
```

`background/` contains the Manifest V3 service worker. `content/` contains both
isolated-world content scripts and the MAIN-world runtime monitor. `popup/`
contains the extension UI. `data/` contains local datasets, while `modules/`
contains reusable analysis/matching logic. Manual HTML fixtures live in
`test-pages/`, separate from automated tests in `tests/`.

## Tests

Run the local tests with:

```bash
node tests/tracker-matcher.test.js
node tests/assessment-engine.test.js
node tests/background-network.test.js
node tests/runtime-monitor.test.js
node tests/background-runtime.test.js
node tests/web-security-analyzer.test.js
node tests/background-web-security.test.js
node tests/page-analysis-iframe.test.js
node tests/manifest-paths.test.js
node --check background/service-worker.js
node --check popup/popup.js
node --check content/page-analysis.js
node --check content/runtime-monitor.js
node --check content/runtime-bridge.js
node --check modules/security/web-security-analyzer.js
node --check modules/assessment/assessment-engine.js
python3 -m json.tool manifest.json
```
