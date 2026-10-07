const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(
    path.join(repoRoot, "popup", "popup.html"),
    "utf8"
);
const popupJs = fs.readFileSync(
    path.join(repoRoot, "popup", "popup.js"),
    "utf8"
);

assert.match(
    popupJs,
    /function loadFreshTabAnalysis\(\)/,
    "Popup should load analysis through a freshness guard"
);
assert.match(
    popupJs,
    /isSameTabIdentity\(identity, createTabIdentity\(latestTab\)\)/,
    "Popup should verify the active tab identity before rendering"
);
assert.match(
    popupJs,
    /return null;\s*\n\s*\n}/,
    "Popup should discard stale analysis when freshness cannot be verified"
);

assert.doesNotMatch(
    popupHtml,
    /class="info-dot"[^>]*title=/,
    "Info controls should not depend on title-only tooltips"
);
assert.match(
    popupHtml,
    /<button class="info-dot" type="button"/,
    "Info controls should be keyboard-focusable buttons"
);
assert.match(
    popupHtml,
    /aria-describedby="tip-/,
    "Info controls should expose tooltip content to assistive technology"
);
assert.match(
    popupHtml,
    /role="tooltip"/,
    "Info tooltip content should have tooltip semantics"
);

console.log("Popup freshness/accessibility tests passed");
