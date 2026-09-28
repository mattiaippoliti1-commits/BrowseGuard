const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.join(__dirname, "..");
const listeners = {};
let sessionStorage = {};

const context = vm.createContext({
    console: console,
    URL: URL,
    Map: Map,
    Set: Set,
    Promise: Promise,
    String: String,
    Number: Number,
    Object: Object,
    RegExp: RegExp,
    importScripts: function (...scriptPaths) {
        scriptPaths.forEach(function (scriptPath) {
            const absolutePath = path.normalize(
                path.join(projectRoot, "background", scriptPath)
            );
            const source = fs.readFileSync(absolutePath, "utf8");
            vm.runInContext(source, context, {
                filename: scriptPath
            });
        });
    },
    chrome: {
        webRequest: {
            onBeforeRequest: {
                addListener: function (listener) {
                    listeners.beforeRequest = listener;
                }
            },
            onHeadersReceived: {
                addListener: function (listener) {
                    listeners.headersReceived = listener;
                }
            }
        },
        tabs: {
            onRemoved: {
                addListener: function (listener) {
                    listeners.tabRemoved = listener;
                }
            }
        },
        runtime: {
            onMessage: {
                addListener: function (listener) {
                    listeners.message = listener;
                }
            }
        },
        storage: {
            session: {
                get: async function (key) {
                    return {
                        [key]: sessionStorage[key]
                    };
                },
                set: async function (value) {
                    sessionStorage = {
                        ...sessionStorage,
                        ...value
                    };
                }
            }
        }
    }
});

vm.runInContext(
    fs.readFileSync(
        path.join(projectRoot, "background", "service-worker.js"),
        "utf8"
    ),
    context,
    {
        filename: "background/service-worker.js"
    }
);

async function observeRequest(details) {
    await listeners.beforeRequest(details);
}

async function observeHeaders(details) {
    await listeners.headersReceived(details);
}

function getWebSecuritySnapshot(tabId) {
    return new Promise(function (resolve) {
        listeners.message(
            {
                type: "GET_WEB_SECURITY",
                tabId: tabId
            },
            {},
            function (response) {
                resolve(response.data);
            }
        );
    });
}

(async function run() {
    await observeRequest({
        tabId: 11,
        type: "main_frame",
        url: "https://secure.test/"
    });

    await observeHeaders({
        tabId: 11,
        type: "main_frame",
        url: "https://secure.test/",
        responseHeaders: [
            {
                name: "Content-Security-Policy",
                value: "default-src 'self'; frame-ancestors 'self'"
            },
            {
                name: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains"
            },
            {
                name: "X-Content-Type-Options",
                value: "nosniff"
            },
            {
                name: "Referrer-Policy",
                value: "strict-origin"
            }
        ]
    });

    await observeRequest({
        tabId: 11,
        type: "image",
        url: "https://cdn.secure.test/image.png"
    });

    await observeRequest({
        tabId: 11,
        type: "script",
        url: "http://mixed.test/app.js"
    });

    await observeRequest({
        tabId: 11,
        type: "image",
        url: "http://mixed.test/pixel.png"
    });

    let snapshot = await getWebSecuritySnapshot(11);

    assert.strictEqual(snapshot.https.enabled, true);
    assert.strictEqual(snapshot.headers.csp.status, "Present");
    assert.strictEqual(snapshot.headers.hsts.maxAge, 31536000);
    assert.strictEqual(snapshot.headers.hsts.includeSubDomains, true);
    assert.strictEqual(snapshot.headers.contentTypeOptions.status, "nosniff");
    assert.strictEqual(snapshot.headers.referrerPolicy.value, "strict-origin");
    assert.strictEqual(snapshot.headers.antiFraming.status, "CSP frame-ancestors");
    assert.strictEqual(snapshot.mixedContent.requestCount, 2);
    assert.strictEqual(snapshot.mixedContent.types.script, 1);
    assert.strictEqual(snapshot.mixedContent.types.image, 1);

    await observeRequest({
        tabId: 12,
        type: "main_frame",
        url: "http://plain.test/"
    });

    await observeRequest({
        tabId: 12,
        type: "image",
        url: "http://plain.test/image.png"
    });

    const httpSnapshot = await getWebSecuritySnapshot(12);
    assert.strictEqual(httpSnapshot.https.enabled, false);
    assert.strictEqual(httpSnapshot.mixedContent.requestCount, 0);

    await observeRequest({
        tabId: 11,
        type: "main_frame",
        url: "https://after-reset.test/"
    });

    snapshot = await getWebSecuritySnapshot(11);
    assert.strictEqual(snapshot.mixedContent.requestCount, 0);
    assert.strictEqual(snapshot.headers.csp.status, "Missing");

    await listeners.tabRemoved(12);
    const removedSnapshot = await getWebSecuritySnapshot(12);
    assert.strictEqual(removedSnapshot.pageUrl, "");

    console.log("Background web security tests passed");
})();
