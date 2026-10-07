const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const {
    assessBrowserState
} = require("../modules/assessment/assessment-engine");

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

function sendMessage(message, tabId, tabUrl) {
    return new Promise(function (resolve) {
        listeners.message(
            message,
            {
                tab: {
                    id: tabId,
                    url: tabUrl
                }
            },
            function (response) {
                resolve(response);
            }
        );
    });
}

async function getNetworkSnapshot(tabId) {
    const response = await sendMessage({
        type: "GET_NETWORK_ACTIVITY",
        tabId: tabId
    }, tabId, "https://availability.test/");

    return response.data;
}

async function getRuntimeSnapshot(tabId) {
    const response = await sendMessage({
        type: "GET_RUNTIME_PRIVACY",
        tabId: tabId
    }, tabId, "https://availability.test/");

    return response.data;
}

async function observeMainFrame(tabId) {
    await listeners.beforeRequest({
        tabId: tabId,
        type: "main_frame",
        url: "https://availability.test/"
    });
}

(async function run() {
    let network = await getNetworkSnapshot(50);
    let runtime = await getRuntimeSnapshot(50);

    assert.strictEqual(network.available, false);
    assert.strictEqual(runtime.available, false);

    let assessment = assessBrowserState({
        urlAnalysis: {
            usesHTTPS: true
        },
        pageAnalysis: {},
        networkActivity: network,
        runtimePrivacy: runtime,
        webSecurity: {
            available: false
        }
    });

    assert.strictEqual(assessment.dataStatus, "partial");
    assert.deepStrictEqual(assessment.missingSources, [
        "networkActivity",
        "runtimePrivacy",
        "webSecurity"
    ]);
    assert.ok(!assessment.security.positiveSignals.some(function (signal) {
        return signal.id === "no-mixed-content-observed";
    }));
    assert.ok(assessment.privacy.reasons.some(function (reason) {
        return reason.id === "privacy-data-incomplete";
    }));

    await observeMainFrame(50);

    network = await getNetworkSnapshot(50);
    runtime = await getRuntimeSnapshot(50);

    assert.strictEqual(network.available, true);
    assert.strictEqual(network.trackerRequests, 0);
    assert.strictEqual(network.trackerDomainCount, 0);
    assert.strictEqual(network.externalThirdPartyRequests, 0);
    assert.strictEqual(runtime.available, true);
    assert.strictEqual(runtime.detectedCategoryCount, 0);

    assessment = assessBrowserState({
        urlAnalysis: {
            usesHTTPS: true
        },
        pageAnalysis: {},
        networkActivity: network,
        runtimePrivacy: runtime,
        webSecurity: {
            available: true,
            https: {
                enabled: true
            },
            headers: {},
            mixedContent: {
                requestCount: 0,
                types: {}
            }
        }
    });

    assert.strictEqual(assessment.dataStatus, "complete");
    assert.deepStrictEqual(assessment.missingSources, []);

    console.log("Snapshot availability tests passed");
})();
