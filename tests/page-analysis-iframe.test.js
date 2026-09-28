const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createIframe(src, sandbox, display, width, height) {
    return {
        hidden: false,
        offsetWidth: width,
        offsetHeight: height,
        getAttribute: function (name) {
            if (name === "src") {
                return src;
            }

            if (name === "sandbox") {
                return sandbox;
            }

            return null;
        },
        hasAttribute: function (name) {
            return name === "sandbox" && sandbox !== null;
        },
        styleDisplay: display || "block"
    };
}

const iframes = [
    createIframe("https://www.example.test/frame", null, "block", 300, 160),
    createIframe("https://third-party.test/frame", null, "block", 300, 160),
    createIframe(
        "https://sandboxed-third.test/frame",
        "allow-scripts allow-forms",
        "block",
        300,
        160
    ),
    createIframe("http://mixed-frame.test/frame", null, "none", 0, 0)
];

const context = vm.createContext({
    console: {
        debug: function () {},
        log: function () {},
        error: function () {}
    },
    URL: URL,
    document: {
        querySelectorAll: function (selector) {
            if (selector === "iframe") {
                return iframes;
            }

            return [];
        }
    },
    window: {
        location: {
            href: "https://www.example.test/",
            hostname: "www.example.test",
            protocol: "https:"
        },
        getComputedStyle: function (iframe) {
            return {
                display: iframe.styleDisplay,
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

const analysis = vm.runInContext("analyzePage()", context);

assert.strictEqual(analysis.iframeCount, 4);
assert.strictEqual(analysis.hiddenIframeCount, 1);
assert.strictEqual(analysis.thirdPartyIframeCount, 3);
assert.strictEqual(analysis.sandboxedIframeCount, 1);
assert.strictEqual(analysis.thirdPartyUnsandboxedIframeCount, 2);
assert.strictEqual(analysis.httpsPageHttpIframeCount, 1);
assert.strictEqual(analysis.sandboxTokenCounts["allow-scripts"], 1);
assert.strictEqual(analysis.sandboxTokenCounts["allow-forms"], 1);

console.log("Page analysis iframe tests passed");
