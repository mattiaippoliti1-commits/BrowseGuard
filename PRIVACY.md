# BrowserGuard Privacy Policy

Effective date: [DATE TO BE ADDED BEFORE PUBLICATION]

BrowserGuard is a Chrome extension that analyzes technical security, privacy, tracking, and network signals from webpages locally inside the user's browser.

BrowserGuard observes and processes browsing-related signals so it can show local assessments. It does not transmit those analyzed browsing signals to the BrowserGuard developer, BrowserGuard-operated servers, advertising services, analytics services, telemetry services, remote logging services, or external analysis APIs.

## Information BrowserGuard Processes Locally

BrowserGuard may process the following information locally in the browser:

- The active page URL, hostname, domain, and HTTP or HTTPS status.
- Aggregate DOM and page characteristics, including forms, password-field presence and counts, links, scripts, iframes, sandbox attributes, and security-related page characteristics.
- Network request metadata, including request domains, first-party or third-party classification, resource types, tracker matches, request counts, and entity/domain relationships.
- Selected security-relevant response headers for the main page, including Content Security Policy, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and X-Frame-Options.
- Mixed-content observations.
- Runtime browser API usage indicators, including selected Canvas, WebGL, audio, navigator/device/browser property, and screen property API usage indicators.
- Locally generated BrowserGuard assessment results.

BrowserGuard analyzes signals and metadata relevant to its security, privacy, tracking, and network analysis. It is not designed to collect arbitrary page content.

## Sensitive Information BrowserGuard Does Not Intentionally Collect or Store

BrowserGuard does not intentionally collect or store:

- Passwords.
- Form field values.
- Authentication credentials.
- Cookies.
- Request bodies.
- Response bodies.
- Authorization headers.

For example, BrowserGuard may detect that a password field exists on a page, but it does not read the password entered into that field.

## Local Processing

BrowserGuard performs its analysis locally in the browser.

The current BrowserGuard runtime does not send analyzed browsing signals to BrowserGuard-operated servers, analytics services, telemetry services, remote logging services, or external analysis APIs.

BrowserGuard observes network requests initiated by webpages in order to analyze network activity and security signals. Observing a webpage's request does not mean BrowserGuard sends that request itself.

## Data Storage

BrowserGuard uses Chrome extension storage only for local extension functionality.

### `chrome.storage.session`

BrowserGuard stores temporary per-tab analysis state in `chrome.storage.session`, including aggregate network, security, and runtime privacy information. This allows BrowserGuard to maintain analysis state when the Manifest V3 service worker is suspended and later restarted by Chrome.

This session state is local to the browser and is not transmitted to BrowserGuard servers. BrowserGuard removes per-tab state when Chrome reports that the corresponding tab has been closed.

### `chrome.storage.local`

BrowserGuard stores the user's appearance/theme preference in `chrome.storage.local`. This preference may persist across browser restarts.

BrowserGuard does not use `chrome.storage.sync` in the current implementation.

## Network Activity

BrowserGuard requires access to webpage network activity so it can provide network activity analysis, same-site and third-party classification, same-entity and external third-party classification, tracker detection, mixed-content observations, and selected security-header analysis.

BrowserGuard observes request URLs/domains, Chrome resource types, request counts, and selected security-relevant response headers. It does not inspect request bodies or response bodies, and it is not a network proxy.

## Browser Permissions

BrowserGuard uses the following Chrome permissions:

- `tabs`: to identify the active tab and analyze the page the user is currently viewing.
- `scripting`: to inject the page-analysis content script when needed.
- `storage`: to store temporary per-tab analysis state and the local appearance/theme preference.
- `webRequest`: to observe webpage network requests and selected response headers for local analysis.
- Host access to `http://*/*` and `https://*/*`: to analyze websites the user visits across HTTP and HTTPS, rather than only a predetermined list of domains.

BrowserGuard uses broad HTTP and HTTPS host access because its purpose is to analyze visited websites locally.

## Tracking and Analytics

BrowserGuard itself does not contain advertising, behavioral analytics, user tracking, telemetry, or remote logging.

BrowserGuard's tracker detection feature identifies tracking-associated network activity on analyzed webpages. That feature does not mean BrowserGuard itself tracks the user.

## Third-Party Tracker Dataset

BrowserGuard uses a locally bundled tracker-classification dataset derived from DuckDuckGo Tracker Radar. Matching against this dataset is performed locally inside the extension.

BrowserGuard does not contact DuckDuckGo when analyzing a webpage, and DuckDuckGo does not receive BrowserGuard analysis data through this functionality.

DuckDuckGo does not endorse BrowserGuard. Licensing and attribution details are provided in `THIRD_PARTY_NOTICES.md`.

## Data Sharing and Sale

Based on the current BrowserGuard implementation:

- BrowserGuard does not sell user data.
- BrowserGuard does not transmit analyzed browsing data to the BrowserGuard developer.
- BrowserGuard does not share analyzed browsing data with advertisers.
- BrowserGuard does not send analysis results to third-party analytics services.

## Children

BrowserGuard is a general-purpose technical browser extension. It is not specifically directed at children.

## Security

BrowserGuard is designed to keep its analysis local, which reduces external data exposure. However, no software or local browser storage mechanism can be guaranteed to be absolutely secure.

## Limitations

BrowserGuard analyzes observable technical signals and provides informational assessments. Its assessments may contain false positives or false negatives, and they do not guarantee that a website is safe, legitimate, trustworthy, or free from malicious behavior.

Some runtime API-usage signals can be influenced or spoofed by webpage behavior. They should be interpreted as observations, not definitive proof of intent.

## Changes to This Privacy Policy

This Privacy Policy may be updated if BrowserGuard's functionality or data practices change. Material changes should be reflected by updating the effective date above.

## Contact

[CONTACT INFORMATION TO BE ADDED BEFORE PUBLICATION]
