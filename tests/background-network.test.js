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
                    listeners.webRequest = listener;
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

async function observe(details) {
    await listeners.webRequest(details);
}

function getSnapshot(tabId) {
    return new Promise(function (resolve) {
        listeners.message(
            {
                type: "GET_NETWORK_ACTIVITY",
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
    await observe({
        tabId: 1,
        type: "main_frame",
        url: "https://www.example.test/"
    });

    await observe({
        tabId: 1,
        type: "script",
        url: "https://static.example.test/app.js"
    });

    await observe({
        tabId: 1,
        type: "script",
        url: "https://ssl.google-analytics.com/analytics.js"
    });

    await observe({
        tabId: 1,
        type: "image",
        url: "https://ssl.google-analytics.com/pixel.gif"
    });

    await observe({
        tabId: 1,
        type: "xmlhttprequest",
        url: "https://connect.facebook.net/event"
    });

    await observe({
        tabId: 1,
        type: "script",
        url: "https://notgoogle-analytics.com/app.js"
    });

    let snapshot = await getSnapshot(1);

    assert.strictEqual(snapshot.totalRequests, 6);
    assert.strictEqual(snapshot.firstPartyRequests, 2);
    assert.strictEqual(snapshot.thirdPartyRequests, 4);
    assert.strictEqual(snapshot.thirdPartyDomainCount, 3);
    assert.strictEqual(snapshot.sameEntityThirdPartyRequests, 0);
    assert.strictEqual(snapshot.externalThirdPartyRequests, 0);
    assert.strictEqual(snapshot.unknownThirdPartyRequests, 4);
    assert.strictEqual(
        snapshot.sameEntityThirdPartyRequests +
            snapshot.externalThirdPartyRequests +
            snapshot.unknownThirdPartyRequests,
        snapshot.thirdPartyRequests
    );
    assert.strictEqual(snapshot.trackerRequests, 3);
    assert.strictEqual(snapshot.trackerDomainCount, 2);
    assert.strictEqual(snapshot.resourceTypes.script, 3);
    assert.strictEqual(snapshot.resourceTypes.image, 1);
    assert.strictEqual(snapshot.resourceTypes.xhr, 1);

    const googleAnalytics = snapshot.trackerDomains.find(function (tracker) {
        return tracker.matchedDomain === "google-analytics.com";
    });

    assert.ok(googleAnalytics);
    assert.strictEqual(googleAnalytics.requestCount, 2);
    assert.strictEqual(googleAnalytics.category, "Advertising");
    assert.strictEqual(googleAnalytics.types.script, 1);
    assert.strictEqual(googleAnalytics.types.image, 1);

    assert.ok(!snapshot.trackerDomains.some(function (tracker) {
        return tracker.matchedDomain === "notgoogle-analytics.com";
    }));

    await observe({
        tabId: 2,
        type: "main_frame",
        url: "https://separate.test/"
    });

    await observe({
        tabId: 2,
        type: "script",
        url: "https://www.googletagmanager.com/gtm.js"
    });

    const tabTwoSnapshot = await getSnapshot(2);
    assert.strictEqual(tabTwoSnapshot.trackerRequests, 1);
    assert.strictEqual(tabTwoSnapshot.trackerDomainCount, 1);
    assert.strictEqual(tabTwoSnapshot.unknownThirdPartyRequests, 1);

    snapshot = await getSnapshot(1);
    assert.strictEqual(snapshot.trackerRequests, 3);
    assert.strictEqual(snapshot.trackerDomainCount, 2);

    await observe({
        tabId: 1,
        type: "main_frame",
        url: "https://www.after-navigation.test/"
    });

    snapshot = await getSnapshot(1);
    assert.strictEqual(snapshot.totalRequests, 1);
    assert.strictEqual(snapshot.firstPartyRequests, 1);
    assert.strictEqual(snapshot.thirdPartyRequests, 0);
    assert.strictEqual(snapshot.sameEntityThirdPartyRequests, 0);
    assert.strictEqual(snapshot.externalThirdPartyRequests, 0);
    assert.strictEqual(snapshot.unknownThirdPartyRequests, 0);
    assert.strictEqual(snapshot.trackerRequests, 0);
    assert.strictEqual(snapshot.trackerDomainCount, 0);

    await listeners.tabRemoved(2);
    const removedSnapshot = await getSnapshot(2);
    assert.strictEqual(removedSnapshot.totalRequests, 0);

    await observe({
        tabId: 3,
        type: "main_frame",
        url: "https://it.wikipedia.org/"
    });

    for (let index = 0; index < 13; index++) {
        await observe({
            tabId: 3,
            type: "image",
            url: "https://it.wikipedia.org/static/" + index + ".png"
        });
    }

    for (let index = 0; index < 17; index++) {
        await observe({
            tabId: 3,
            type: "image",
            url: "https://thumb.wikimedia.org/image-" + index + ".jpg"
        });
    }

    await observe({
        tabId: 3,
        type: "image",
        url: "https://upload.wikimedia.org/file.jpg"
    });

    await observe({
        tabId: 3,
        type: "script",
        url: "https://www.google.com/script.js"
    });

    await observe({
        tabId: 3,
        type: "sub_frame",
        url: "https://www.youtube.com/embed/example"
    });

    const wikipediaSnapshot = await getSnapshot(3);
    assert.strictEqual(wikipediaSnapshot.totalRequests, 34);
    assert.strictEqual(wikipediaSnapshot.firstPartyRequests, 14);
    assert.strictEqual(wikipediaSnapshot.thirdPartyRequests, 20);
    assert.strictEqual(wikipediaSnapshot.sameEntityThirdPartyRequests, 18);
    assert.strictEqual(wikipediaSnapshot.externalThirdPartyRequests, 2);
    assert.strictEqual(wikipediaSnapshot.unknownThirdPartyRequests, 0);
    assert.strictEqual(wikipediaSnapshot.assessmentThirdPartyRequests, 2);
    assert.strictEqual(wikipediaSnapshot.sameEntityThirdPartyDomainCount, 2);
    assert.strictEqual(wikipediaSnapshot.externalThirdPartyDomainCount, 2);
    assert.strictEqual(wikipediaSnapshot.unknownThirdPartyDomainCount, 0);
    assert.strictEqual(
        wikipediaSnapshot.sameEntityThirdPartyRequests +
            wikipediaSnapshot.externalThirdPartyRequests +
            wikipediaSnapshot.unknownThirdPartyRequests,
        wikipediaSnapshot.thirdPartyRequests
    );

    console.log("Background network/tracker tests passed");
})();
