const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let anchors = [];

function createAnchor(href, text) {
    return {
        textContent: text,
        getAttribute: function (name) {
            return name === "href" ? href : null;
        }
    };
}

const context = vm.createContext({
    console: {
        debug: function () {},
        log: function () {},
        error: function () {}
    },
    URL: URL,
    document: {
        querySelectorAll: function (selector) {
            return selector === "a[href]" ? anchors : [];
        }
    },
    window: {
        location: {
            href: "https://www.example.test/",
            hostname: "www.example.test",
            protocol: "https:"
        },
        getComputedStyle: function () {
            return {
                display: "block",
                visibility: "visible"
            };
        }
    },
    chrome: {
        runtime: {
            onMessage: {
                addListener: function () {}
            }
        }
    },
    globalThis: {}
});

vm.runInContext(
    fs.readFileSync(
        path.join(__dirname, "..", "content", "page-analysis.js"),
        "utf8"
    ),
    context,
    {
        filename: "content/page-analysis.js"
    }
);

anchors = [
    createAnchor("https://www.example.test/account", "Account"),
    createAnchor("https://www.example.test/help", "https://www.example.test/help"),
    createAnchor("https://cdn.example.test/file", "cdn.example.test/file")
];

let analysis = vm.runInContext("analyzeLinks()", context);
assert.strictEqual(analysis.totalLinks, 3);
assert.strictEqual(analysis.externalLinks, 1);
assert.strictEqual(analysis.mismatchedLinks, 0);
assert.strictEqual(analysis.suspiciousMismatchedLinks, 0);

anchors = [
    createAnchor("https://destination.test/path", "displayed.test")
];

analysis = vm.runInContext("analyzeLinks()", context);
assert.strictEqual(analysis.mismatchedLinks, 1);
assert.strictEqual(analysis.suspiciousMismatchedLinks, 0);

anchors = [
    createAnchor("https://one-destination.test/", "one-display.test"),
    createAnchor("https://two-destination.test/", "two-display.test"),
    createAnchor("https://three-destination.test/", "three-display.test")
];

analysis = vm.runInContext("analyzeLinks()", context);
assert.strictEqual(analysis.mismatchedLinks, 3);
assert.strictEqual(analysis.suspiciousMismatchedLinks, 0);

anchors = [
    createAnchor("https://login-capture.test/", "https://bank.example.test/login")
];

analysis = vm.runInContext("analyzeLinks()", context);
assert.strictEqual(analysis.mismatchedLinks, 1);
assert.strictEqual(analysis.suspiciousMismatchedLinks, 1);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(analysis.mismatchedLinkDetails[0])),
    {
        displayedHostname: "bank.example.test",
        destinationHostname: "login-capture.test",
        externalDestination: true,
        explicitDisplayedUrl: true,
        suspicious: true
    }
);

console.log("Page analysis link tests passed");
