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
const popupCss = fs.readFileSync(
    path.join(repoRoot, "popup", "popup.css"),
    "utf8"
);

assert.match(
    popupHtml,
    /<span class="assessment-label">Network<\/span>/,
    "Network assessment heading should be concise"
);
assert.doesNotMatch(
    popupHtml,
    /<span class="assessment-label">External Exposure<\/span>/,
    "External Exposure should not be used as the assessment heading"
);

assert.doesNotMatch(
    popupHtml,
    /network-composition|network-segment/,
    "Network composition bar should not be rendered"
);
assert.doesNotMatch(
    popupCss,
    /network-composition|network-segment/,
    "Deleted network composition bar CSS should not remain"
);
assert.doesNotMatch(
    popupJs,
    /updateNetworkComposition/,
    "Deleted network composition bar renderer should not remain"
);

assert.match(
    popupHtml,
    /Tracking-associated Activity/,
    "Tracking section should use activity heading"
);
assert.match(
    popupHtml,
    /id="tracker-domain-count-detail"/,
    "Tracking-associated domain metric should remain"
);
assert.match(
    popupHtml,
    /id="tracker-request-count"/,
    "Tracking-associated request metric should remain"
);
assert.doesNotMatch(
    popupHtml,
    /id="tracker-domain-count"/,
    "Standalone tracking counter should not remain"
);

console.log("Popup UI tests passed");
