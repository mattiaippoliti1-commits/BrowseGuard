"""Regenerate the dependency-free, self-contained README architecture SVG.

Run from any directory: python3 docs/generate-architecture.py
"""
from html import escape
from pathlib import Path

parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title description">
<title id="title">BrowserGuard architecture</title>
<desc id="description">A Chrome Manifest V3 extension with local analysis. Requests and main-document response headers feed a background service worker with tracker matching and entity resolution. A MAIN-world runtime monitor sends limited events through a validating isolated-world bridge to that worker. On opening, the popup requests worker snapshots, requests DOM analysis directly from a content script, parses the active URL, and invokes the rule-based Assessment Engine. A presentation layer displays independent Security, Privacy, and Network results. Worker state uses session storage. Signals may be partial; requests are not blocked and results do not certify safety.</desc>
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#6CF7D8"/></marker>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; fill: #EAF6F1; }
    .title { font-size: 38px; font-weight: 650; }
    .subtitle { font-size: 22px; fill: #AAC6BC; }
    .stage { font-size: 23px; font-weight: 600; }
    .number { fill: #6CF7D8; font-size: 21px; font-weight: 600; }
    .heading { font-size: 23px; font-weight: 600; }
    .body { font-size: 21px; fill: #AAC6BC; }
    .small { font-size: 19px; fill: #AAC6BC; }
    .mint { fill: #6CF7D8; }
    .line { fill: none; stroke: #6CF7D8; stroke-width: 2; marker-end: url(#arrow); stroke-linejoin: round; }
  </style>
</defs>
<rect width="1600" height="900" fill="#03120E"/>
''']


def text(x, y, value, kind='body'):
    parts.append(f'<text x="{x}" y="{y}" class="{kind}">{escape(value)}</text>')


def box(x, y, w, h, fill='#071C16', stroke='#234237'):
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}"/>')


def line(d):
    parts.append(f'<path class="line" d="{d}"/>')


text(48, 65, 'BrowserGuard architecture', 'title')
text(48, 105, 'Chrome Manifest V3 · Local processing · No remote analysis backend', 'subtitle')
for x, number, label in [(48, '01', 'Web page'), (336, '02', 'Data collection'),
                         (930, '03', 'Analysis & assessment'), (1300, '04', 'Popup results')]:
    text(x, 170, number, 'number')
    text(x + 40, 170, label, 'stage')

# Page signals are independent sources, not a sequential scan.
box(48, 210, 230, 542)
text(70, 249, 'Visited website', 'heading')
text(70, 280, 'HTTP / HTTPS', 'body')
text(70, 338, 'Loaded resources', 'body')
text(70, 369, 'Requests + headers', 'small')
text(70, 558, 'Runtime activity', 'body')
text(70, 589, 'Selected API usage', 'small')
text(70, 687, 'Page structure', 'body')
text(70, 718, 'Forms, links, iframes', 'small')
line('M278 330 H336')
line('M278 550 H336')
line('M278 680 H336')

# Collection: two browser event streams into the worker; runtime via bridge;
# DOM is requested directly by the popup, never routed through the worker.
box(336, 210, 524, 275)
text(358, 247, 'Background service worker', 'heading')
text(358, 281, 'Network Request Monitoring', 'body')
text(358, 309, 'webRequest · counts, domains, resource types', 'small')
text(358, 347, 'Tracker Detection + entity resolution', 'body')
text(358, 375, 'Local Tracker Radar-derived dataset', 'small')
text(358, 413, 'Security Headers Analysis', 'body')
text(358, 441, 'Main-document headers + mixed-content attempts', 'small')
text(358, 470, 'Per-tab aggregates ↔ chrome.storage.session', 'small')
box(336, 521, 524, 99, '#09231B')
text(358, 556, 'Runtime Privacy Monitoring', 'heading')
text(358, 585, 'MAIN-world monitor → validating isolated bridge', 'small')
text(358, 610, 'API-access metadata only → worker', 'small')
line('M830 521 V485')
box(336, 653, 524, 99)
text(358, 690, 'DOM Analysis', 'heading')
text(358, 722, 'Isolated content script · on popup request', 'body')

# These operations live in the popup, including URL parsing and engine invocation.
box(930, 210, 306, 542)
text(950, 246, 'Runs inside the popup', 'small')
box(950, 266, 266, 70, '#09231B')
text(968, 295, 'Active URL analysis', 'heading')
text(968, 322, 'Parsed from tab URL', 'small')
line('M1083 336 V379')
box(950, 382, 266, 135, '#09231B', '#6CF7D8')
text(968, 418, 'Assessment Engine', 'heading')
text(968, 451, 'Deterministic rules', 'body')
text(968, 483, '5 input snapshots', 'body')
text(968, 508, 'Reasons + missing sources', 'small')
# Worker responses enter the engine separately from DOM responses.
line('M860 410 H950')
text(867, 375, 'Async', 'small')
text(867, 398, 'data', 'small')
line('M860 700 H902 V485 H950')
line('M1083 517 V558')
box(950, 561, 266, 145, '#09231B')
text(968, 597, 'Presentation layer', 'heading')
text(968, 630, 'Levels + explanations', 'body')
text(968, 661, 'Availability caveats', 'body')
text(968, 691, 'No global numeric score', 'small')

# Output is the actual extension UI, not a remote processing stage.
box(1300, 210, 252, 542)
text(1320, 249, 'BrowserGuard', 'heading')
text(1320, 280, 'Extension popup', 'body')
for y, label in [(326, 'Security'), (421, 'Privacy'), (516, 'Network')]:
    box(1320, y, 212, 71, '#09231B')
    parts.append(f'<circle cx="1340" cy="{y+35}" r="4" fill="#6CF7D8"/>')
    text(1355, y+43, label, 'heading')
text(1320, 636, 'Select a category', 'body')
text(1320, 667, 'to inspect evidence', 'body')
text(1320, 718, 'Partial / missing states', 'small')
line('M1216 615 H1300')

parts.append('<path d="M48 793 H1552" stroke="#234237"/>')
text(48, 831, 'Parallel observation paths · Snapshots requested when the popup opens · Coverage may be partial', 'body')
text(48, 868, 'Informational assessments only · No request blocking · No website safety certification', 'body')
parts.append('</svg>\n')
Path(__file__).with_name('images').joinpath('browserguard-architecture.svg').write_text('\n'.join(parts))
