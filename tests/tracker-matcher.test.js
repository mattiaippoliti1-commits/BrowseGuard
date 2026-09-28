const assert = require("assert");

const trackerData = require("../data/tracker-data");
const {
    createTrackerMatcher
} = require("../modules/trackers/tracker-matcher");

const matcher = createTrackerMatcher({
    trackers: [
        {
            domain: "example.com",
            category: "Analytics"
        },
        ...trackerData.trackers
    ]
});

assert.deepStrictEqual(
    matcher.findTrackerMatch("example.com"),
    {
        matchedDomain: "example.com",
        category: "Analytics"
    },
    "exact tracker domain should match"
);

assert.deepStrictEqual(
    matcher.findTrackerMatch("tracker.example.com"),
    {
        matchedDomain: "example.com",
        category: "Analytics"
    },
    "tracker subdomain should match parent tracker domain"
);

assert.strictEqual(
    matcher.findTrackerMatch("notexample.com"),
    null,
    "similar domain must not match"
);

assert.strictEqual(
    matcher.findTrackerMatch("example.com.evil.test"),
    null,
    "tracker domain embedded as a prefix must not match"
);

assert.strictEqual(
    matcher.findTrackerMatch("not-in-dataset.test"),
    null,
    "unknown domain should not match"
);

assert.deepStrictEqual(
    matcher.findTrackerMatch("ad.doubleclick.net"),
    {
        matchedDomain: "doubleclick.net",
        category: "Advertising"
    },
    "known tracker subdomain should match"
);

console.log("Tracker matcher tests passed");
