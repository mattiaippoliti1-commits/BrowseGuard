const assert = require("assert");

const trackerData = require("../data/tracker-data");
const {
    createEntityResolver
} = require("../modules/network/entity-resolver");

function getRegistrableDomain(hostname) {
    const parts = String(hostname || "").toLowerCase().split(".");

    if (parts.length <= 2) {
        return parts.join(".");
    }

    return parts.slice(-2).join(".");
}

const resolver = createEntityResolver({
    entityDomains: [
        ...trackerData.entityDomains,
        ["browserguard-example.test", "Example Inc."],
        ["static-browserguard-example.test", "Example Inc."],
        ["other.test", "Other Ltd."],
    ]
}, {
    getRegistrableDomain: getRegistrableDomain
});

assert.strictEqual(
    resolver.resolveRelationship("www.example.com", "cdn.example.com")
        .relationship,
    "first-party"
);

assert.strictEqual(
    resolver.resolveRelationship(
        "www.browserguard-example.test",
        "static-browserguard-example.test"
    )
        .relationship,
    "same-entity-third-party"
);

assert.strictEqual(
    resolver.resolveRelationship("www.browserguard-example.test", "other.test")
        .relationship,
    "external-third-party"
);

assert.strictEqual(
    resolver.resolveRelationship("unknown-one.test", "unknown-two.test")
        .relationship,
    "unknown-third-party"
);

assert.strictEqual(
    resolver.resolveRelationship("www.browserguard-example.test", "unknown-two.test")
        .relationship,
    "unknown-third-party"
);

assert.strictEqual(
    resolver.resolveRelationship("unknown-one.test", "other.test")
        .relationship,
    "unknown-third-party"
);

const wikipediaToWikimedia =
    resolver.resolveRelationship("it.wikipedia.org", "thumb.wikimedia.org");
assert.strictEqual(wikipediaToWikimedia.relationship, "same-entity-third-party");
assert.strictEqual(wikipediaToWikimedia.pageEntity, "Wikimedia Foundation");
assert.strictEqual(wikipediaToWikimedia.requestEntity, "Wikimedia Foundation");

const wikipediaToGoogle =
    resolver.resolveRelationship("it.wikipedia.org", "www.google.com");
assert.strictEqual(wikipediaToGoogle.relationship, "external-third-party");
assert.strictEqual(wikipediaToGoogle.pageEntity, "Wikimedia Foundation");
assert.strictEqual(wikipediaToGoogle.requestEntity, "Google");

console.log("Entity resolver tests passed");
