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

async function recordRuntimeEvent(tabId, event) {
    return sendMessage(
        {
            type: "RUNTIME_PRIVACY_EVENT",
            event: event
        },
        tabId,
        "https://runtime.test/"
    );
}

async function getRuntimeSnapshot(tabId) {
    const response = await sendMessage(
        {
            type: "GET_RUNTIME_PRIVACY",
            tabId: tabId
        },
        tabId,
        "https://runtime.test/"
    );

    return response.data;
}

(async function run() {
    await observe({
        tabId: 7,
        type: "main_frame",
        url: "https://runtime.test/"
    });

    await recordRuntimeEvent(7, {
        category: "canvas",
        api: "toDataURL",
        detail: ""
    });
    await recordRuntimeEvent(7, {
        category: "webgl",
        api: "getParameter",
        detail: "UNMASKED_RENDERER_WEBGL"
    });
    await recordRuntimeEvent(7, {
        category: "navigator",
        api: "hardwareConcurrency",
        detail: ""
    });
    await recordRuntimeEvent(7, {
        category: "screen",
        api: "width",
        detail: ""
    });

    let snapshot = await getRuntimeSnapshot(7);

    assert.strictEqual(snapshot.categories.canvas.detected, true);
    assert.strictEqual(snapshot.categories.webgl.detected, true);
    assert.strictEqual(snapshot.categories.navigator.detected, true);
    assert.strictEqual(snapshot.categories.screen.detected, true);
    assert.strictEqual(snapshot.multipleIndicators, true);
    assert.ok(snapshot.categories.webgl.details.includes(
        "getParameter:UNMASKED_RENDERER_WEBGL"
    ));

    const invalidResponse = await recordRuntimeEvent(7, {
        category: "canvas",
        api: "unknownApi",
        detail: ""
    });

    assert.strictEqual(invalidResponse.success, false);

    await observe({
        tabId: 8,
        type: "main_frame",
        url: "https://separate-runtime.test/"
    });
    await recordRuntimeEvent(8, {
        category: "audio",
        api: "AudioContext",
        detail: ""
    });

    const secondTabSnapshot = await getRuntimeSnapshot(8);
    assert.strictEqual(secondTabSnapshot.categories.audio.detected, true);
    assert.strictEqual(secondTabSnapshot.multipleIndicators, false);

    snapshot = await getRuntimeSnapshot(7);
    assert.strictEqual(snapshot.categories.audio.detected, false);

    await observe({
        tabId: 7,
        type: "main_frame",
        url: "https://after-reset.test/"
    });

    snapshot = await getRuntimeSnapshot(7);
    assert.strictEqual(snapshot.detectedCategoryCount, 0);
    assert.strictEqual(snapshot.multipleIndicators, false);

    await listeners.tabRemoved(8);
    const removedSnapshot = await getRuntimeSnapshot(8);
    assert.strictEqual(removedSnapshot.detectedCategoryCount, 0);

    console.log("Background runtime privacy tests passed");
})();
