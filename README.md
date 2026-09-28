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

The current dataset is a small local prototype subset in `tracker-data.js`.

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
- Fingerprinting runtime detection, Canvas/WebGL/AudioContext monitoring,
  cookie analysis, permission monitoring, WHOIS, DNS intelligence, domain
  reputation, malware/phishing blacklists, and request blocking are not
  implemented.

## Tests

Run the local tests with:

```bash
node tests/tracker-matcher.test.js
node tests/background-network.test.js
node --check background.js
node --check popup.js
python3 -m json.tool manifest.json
```
