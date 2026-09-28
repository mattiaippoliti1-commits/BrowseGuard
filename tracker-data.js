/**
 * BrowserGuard local tracker dataset.
 *
 * Source: reduced prototype subset derived from DuckDuckGo Tracker Radar.
 * License of source dataset: Creative Commons Attribution-NonCommercial-
 * ShareAlike 4.0 International.
 * Source repository: https://github.com/duckduckgo/tracker-radar
 * Dataset review date for this prototype: 2026-09-28.
 *
 * This small subset is intentionally local and transparent. It is not a
 * complete tracker list.
 */

const BROWSERGUARD_TRACKER_DATA = {
    source: "DuckDuckGo Tracker Radar reduced prototype subset",
    sourceUrl: "https://github.com/duckduckgo/tracker-radar",
    license: "CC BY-NC-SA 4.0",
    reviewedAt: "2026-09-28",
    trackers: [
        {
            domain: "google-analytics.com",
            category: "Analytics"
        },
        {
            domain: "googletagmanager.com",
            category: "Analytics"
        },
        {
            domain: "doubleclick.net",
            category: "Advertising"
        },
        {
            domain: "googlesyndication.com",
            category: "Advertising"
        },
        {
            domain: "facebook.net",
            category: "Social"
        },
        {
            domain: "facebook.com",
            category: "Social"
        },
        {
            domain: "connect.facebook.net",
            category: "Social"
        },
        {
            domain: "scorecardresearch.com",
            category: "Analytics"
        },
        {
            domain: "hotjar.com",
            category: "Analytics"
        },
        {
            domain: "fullstory.com",
            category: "Analytics"
        },
        {
            domain: "segment.io",
            category: "Analytics"
        },
        {
            domain: "mathtag.com",
            category: "Advertising"
        },
        {
            domain: "criteo.com",
            category: "Advertising"
        },
        {
            domain: "quantserve.com",
            category: "Advertising"
        },
        {
            domain: "newrelic.com",
            category: "Analytics"
        }
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = BROWSERGUARD_TRACKER_DATA;
} else {
    globalThis.BROWSERGUARD_TRACKER_DATA = BROWSERGUARD_TRACKER_DATA;
}
