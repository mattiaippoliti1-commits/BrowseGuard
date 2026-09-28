/**
 * BrowserGuard Network Activity Collector
 *
 * This MV3 service worker observes network requests and keeps per-tab state.
 * It does not block, modify, classify reputation, or assign risk to traffic.
 */

importScripts(
    "../data/tracker-data.js",
    "../modules/trackers/tracker-matcher.js"
);

const tabNetworkStates = new Map();
const tabRuntimePrivacyStates = new Map();
const networkStateStorageKey = "browserGuardNetworkStates";
const runtimePrivacyStorageKey = "browserGuardRuntimePrivacyStates";
const networkStatesReady = restoreNetworkStates();
const runtimePrivacyStatesReady = restoreRuntimePrivacyStates();
const allStatesReady = Promise.all([
    networkStatesReady,
    runtimePrivacyStatesReady
]);
const trackerMatcher = BrowserGuardTrackerMatcher.createTrackerMatcher(
    BROWSERGUARD_TRACKER_DATA
);

const COMMON_COMPOUND_PUBLIC_SUFFIXES = new Set([
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "com.au",
    "net.au",
    "org.au",
    "co.jp",
    "ne.jp",
    "or.jp",
    "com.br",
    "com.mx",
    "com.tr",
    "co.in",
    "com.cn"
]);

chrome.webRequest.onBeforeRequest.addListener(
    handleBeforeRequest,
    {
        urls: [
            "http://*/*",
            "https://*/*"
        ]
    }
);

chrome.tabs.onRemoved.addListener(async function (tabId) {
    await allStatesReady;
    tabNetworkStates.delete(tabId);
    tabRuntimePrivacyStates.delete(tabId);
    await persistAllStates();
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (!message || !message.type) {
        return false;
    }

    if (message.type === "GET_NETWORK_ACTIVITY") {
        allStatesReady.then(function () {
            sendResponse({
                success: true,
                data: getNetworkActivitySnapshot(message.tabId)
            });
        });

        return true;
    }

    if (message.type === "GET_RUNTIME_PRIVACY") {
        allStatesReady.then(function () {
            sendResponse({
                success: true,
                data: getRuntimePrivacySnapshot(message.tabId)
            });
        });

        return true;
    }

    if (message.type === "RUNTIME_PRIVACY_EVENT") {
        allStatesReady.then(async function () {
            const tabId = sender.tab && sender.tab.id;
            const pageUrl = sender.tab && sender.tab.url;

            if (typeof tabId !== "number" || tabId < 0) {
                sendResponse({
                    success: false
                });
                return;
            }

            const recorded = recordRuntimePrivacyEvent(
                tabId,
                pageUrl,
                message.event
            );

            if (recorded) {
                await persistRuntimePrivacyStates();
            }

            sendResponse({
                success: recorded
            });
        });

        return true;
    }

    return false;

});

function persistAllStates() {

    return Promise.all([
        persistNetworkStates(),
        persistRuntimePrivacyStates()
    ]);

}

/**
 * Observe one Chrome network request and update the matching tab state.
 *
 * @param {object} details - chrome.webRequest request details.
 */
async function handleBeforeRequest(details) {

    if (!details || details.tabId < 0 || !details.url) {
        return;
    }

    await allStatesReady;

    if (details.type === "main_frame") {
        resetTabNetworkState(details.tabId, details.url);
        resetRuntimePrivacyState(details.tabId, details.url);
    }

    const state = getOrCreateTabNetworkState(details.tabId, details.url);
    recordNetworkRequest(state, details);
    await persistNetworkStates();

}

/**
 * Start a fresh runtime privacy state for a tab's current document.
 *
 * @param {number} tabId - Chrome tab ID.
 * @param {string} pageUrl - Main-frame URL.
 */
function resetRuntimePrivacyState(tabId, pageUrl) {

    tabRuntimePrivacyStates.set(tabId, createRuntimePrivacyState(pageUrl));

}

/**
 * Return an existing runtime privacy state, or create one if a document_start
 * runtime event arrives before the main-frame webRequest reset is available.
 *
 * @param {number} tabId - Chrome tab ID.
 * @param {string} pageUrl - Page URL.
 * @returns {object} Per-tab runtime privacy state.
 */
function getOrCreateRuntimePrivacyState(tabId, pageUrl) {

    if (!tabRuntimePrivacyStates.has(tabId)) {
        tabRuntimePrivacyStates.set(
            tabId,
            createRuntimePrivacyState(pageUrl || "")
        );
    }

    return tabRuntimePrivacyStates.get(tabId);

}

/**
 * @param {string} pageUrl - Current page URL.
 * @returns {object} Empty runtime privacy state.
 */
function createRuntimePrivacyState(pageUrl) {

    return {
        pageUrl: pageUrl || "",
        categories: {
            canvas: createRuntimePrivacyCategory(),
            webgl: createRuntimePrivacyCategory(),
            audio: createRuntimePrivacyCategory(),
            navigator: createRuntimePrivacyCategory(),
            screen: createRuntimePrivacyCategory()
        }
    };

}

/**
 * @returns {object} Empty category aggregate.
 */
function createRuntimePrivacyCategory() {

    return {
        detected: false,
        eventCount: 0,
        apis: {},
        details: {}
    };

}

/**
 * Validate and aggregate a runtime privacy event from the content script bridge.
 *
 * @param {number} tabId - Chrome tab ID.
 * @param {string} pageUrl - Current tab URL.
 * @param {object} event - Sanitized event from runtime-bridge.js.
 * @returns {boolean} True when the event was accepted.
 */
function recordRuntimePrivacyEvent(tabId, pageUrl, event) {

    if (!isValidRuntimePrivacyEvent(event)) {
        return false;
    }

    const state = getOrCreateRuntimePrivacyState(tabId, pageUrl);
    const category = state.categories[event.category];
    const eventKey = event.api + ":" + (event.detail || "");

    category.detected = true;
    category.eventCount++;
    incrementCounter(category.apis, event.api);
    incrementCounter(category.details, eventKey);

    return true;

}

/**
 * @param {object} event - Runtime privacy event candidate.
 * @returns {boolean} True for schema-approved events only.
 */
function isValidRuntimePrivacyEvent(event) {

    const allowedEvents = {
        canvas: new Set([
            "toDataURL",
            "toBlob",
            "getImageData"
        ]),
        webgl: new Set([
            "getParameter",
            "getExtension"
        ]),
        audio: new Set([
            "AudioContext",
            "OfflineAudioContext"
        ]),
        navigator: new Set([
            "hardwareConcurrency",
            "deviceMemory",
            "languages",
            "platform",
            "userAgent",
            "maxTouchPoints"
        ]),
        screen: new Set([
            "width",
            "height",
            "availWidth",
            "availHeight",
            "colorDepth",
            "pixelDepth"
        ])
    };

    if (!event || typeof event !== "object") {
        return false;
    }

    if (!allowedEvents[event.category]) {
        return false;
    }

    return allowedEvents[event.category].has(event.api);

}

/**
 * Build a serializable runtime privacy snapshot for the popup.
 *
 * @param {number} tabId - Chrome tab ID.
 * @returns {object} Runtime privacy snapshot.
 */
function getRuntimePrivacySnapshot(tabId) {

    const state = tabRuntimePrivacyStates.get(tabId);

    if (!state) {
        return createEmptyRuntimePrivacySnapshot();
    }

    const categories = {};

    Object.entries(state.categories).forEach(function ([name, category]) {
        categories[name] = {
            detected: category.detected,
            eventCount: category.eventCount,
            apis: Object.keys(category.apis).sort(),
            details: Object.keys(category.details).sort()
        };
    });

    const detectedCategoryCount = Object.values(categories)
        .filter(function (category) {
            return category.detected;
        }).length;

    return {
        pageUrl: state.pageUrl,
        categories: categories,
        detectedCategoryCount: detectedCategoryCount,
        multipleIndicators: detectedCategoryCount >= 3
    };

}

/**
 * @returns {object} Empty runtime privacy snapshot.
 */
function createEmptyRuntimePrivacySnapshot() {

    return {
        pageUrl: "",
        categories: {
            canvas: snapshotEmptyRuntimePrivacyCategory(),
            webgl: snapshotEmptyRuntimePrivacyCategory(),
            audio: snapshotEmptyRuntimePrivacyCategory(),
            navigator: snapshotEmptyRuntimePrivacyCategory(),
            screen: snapshotEmptyRuntimePrivacyCategory()
        },
        detectedCategoryCount: 0,
        multipleIndicators: false
    };

}

function snapshotEmptyRuntimePrivacyCategory() {

    return {
        detected: false,
        eventCount: 0,
        apis: [],
        details: []
    };

}

/**
 * Restore runtime privacy state after the MV3 service worker wakes up.
 *
 * @returns {Promise<void>}
 */
async function restoreRuntimePrivacyStates() {

    try {

        const storedData = await chrome.storage.session.get(
            runtimePrivacyStorageKey
        );

        const serializedStates =
            storedData[runtimePrivacyStorageKey] || {};

        Object.entries(serializedStates).forEach(function ([tabId, state]) {
            tabRuntimePrivacyStates.set(
                Number(tabId),
                normalizeRuntimePrivacyState(state)
            );
        });

    } catch (error) {

        console.error(
            "BrowserGuard: runtime privacy state restore failed",
            error
        );

    }

}

/**
 * Persist runtime privacy state for MV3 service worker suspension.
 *
 * @returns {Promise<void>}
 */
async function persistRuntimePrivacyStates() {

    const serializedStates = {};

    tabRuntimePrivacyStates.forEach(function (state, tabId) {
        serializedStates[tabId] = state;
    });

    try {

        await chrome.storage.session.set({
            [runtimePrivacyStorageKey]: serializedStates
        });

    } catch (error) {

        console.error(
            "BrowserGuard: runtime privacy state persist failed",
            error
        );

    }

}

/**
 * Fill fields added after earlier stored versions of the runtime privacy state.
 *
 * @param {object} state - Restored state.
 * @returns {object} Normalized state.
 */
function normalizeRuntimePrivacyState(state) {

    const normalizedState = createRuntimePrivacyState(state.pageUrl || "");

    Object.keys(normalizedState.categories).forEach(function (categoryName) {
        if (state.categories && state.categories[categoryName]) {
            normalizedState.categories[categoryName] = {
                ...createRuntimePrivacyCategory(),
                ...state.categories[categoryName],
                apis: state.categories[categoryName].apis || {},
                details: state.categories[categoryName].details || {}
            };
        }
    });

    return normalizedState;

}

/*
 * The runtime privacy functions above intentionally live beside the network
 * collector because both modules share the same per-tab lifecycle events.
 */

/**
 * Start a fresh state for a tab's current top-level document.
 *
 * @param {number} tabId - Chrome tab ID.
 * @param {string} pageUrl - Main-frame URL.
 */
function resetTabNetworkState(tabId, pageUrl) {

    tabNetworkStates.set(tabId, createNetworkState(pageUrl));

}

/**
 * Return the existing state, or create one when the service worker sees a
 * request before the main-frame event is available after startup.
 *
 * @param {number} tabId - Chrome tab ID.
 * @param {string} fallbackPageUrl - URL used when no state exists yet.
 * @returns {object} Per-tab network state.
 */
function getOrCreateTabNetworkState(tabId, fallbackPageUrl) {

    if (!tabNetworkStates.has(tabId)) {
        tabNetworkStates.set(tabId, createNetworkState(fallbackPageUrl));
    }

    return tabNetworkStates.get(tabId);

}

/**
 * Create an empty per-tab network state.
 *
 * @param {string} pageUrl - URL used to derive the first-party site.
 * @returns {object} Empty network state.
 */
function createNetworkState(pageUrl) {

    const pageHostname = extractHostname(pageUrl);

    return {
        pageUrl: pageUrl,
        pageHostname: pageHostname,
        pageSite: getRegistrableDomain(pageHostname),
        totalRequests: 0,
        firstPartyRequests: 0,
        thirdPartyRequests: 0,
        trackerRequests: 0,
        resourceTypes: {},
        thirdPartyDomains: {},
        trackerDomains: {}
    };

}

/**
 * Record one observed request in a tab's aggregate state.
 *
 * @param {object} state - Per-tab network state.
 * @param {object} details - chrome.webRequest request details.
 */
function recordNetworkRequest(state, details) {

    const requestHostname = extractHostname(details.url);

    if (!requestHostname) {
        return;
    }

    const resourceType = normalizeResourceType(details.type);
    const party = classifyRequestParty(state.pageHostname, requestHostname);

    state.totalRequests++;
    incrementCounter(state.resourceTypes, resourceType);

    if (party === "first-party") {
        state.firstPartyRequests++;
        return;
    }

    state.thirdPartyRequests++;
    recordThirdPartyDomain(state, requestHostname, resourceType);

    const trackerMatch = trackerMatcher.findTrackerMatch(requestHostname);

    if (trackerMatch) {
        recordTrackerDomain(state, requestHostname, resourceType, trackerMatch);
    }

}

/**
 * Add request counts for one third-party hostname.
 *
 * @param {object} state - Per-tab network state.
 * @param {string} hostname - Request hostname.
 * @param {string} resourceType - Chrome resource type.
 */
function recordThirdPartyDomain(state, hostname, resourceType) {

    if (!state.thirdPartyDomains[hostname]) {
        state.thirdPartyDomains[hostname] = {
            hostname: hostname,
            requestCount: 0,
            types: {}
        };
    }

    const domain = state.thirdPartyDomains[hostname];

    domain.requestCount++;
    incrementCounter(domain.types, resourceType);

}

/**
 * Add request counts for a known tracker observed as third-party traffic.
 *
 * @param {object} state - Per-tab network state.
 * @param {string} hostname - Request hostname.
 * @param {string} resourceType - Chrome resource type.
 * @param {object} trackerMatch - Matched tracker metadata.
 */
function recordTrackerDomain(state, hostname, resourceType, trackerMatch) {

    state.trackerRequests++;

    const trackerKey = trackerMatch.matchedDomain;

    if (!state.trackerDomains[trackerKey]) {
        state.trackerDomains[trackerKey] = {
            hostname: hostname,
            matchedDomain: trackerMatch.matchedDomain,
            category: trackerMatch.category,
            requestCount: 0,
            types: {}
        };
    }

    const tracker = state.trackerDomains[trackerKey];

    tracker.requestCount++;
    incrementCounter(tracker.types, resourceType);

}

/**
 * Classify a request against the page's site using a centralized registrable
 * domain heuristic. A full Public Suffix List would be needed for perfect
 * coverage; this keeps common compound suffixes replaceable in one place.
 *
 * @param {string} pageHostname - Top-level page hostname.
 * @param {string} requestHostname - Request hostname.
 * @returns {"first-party"|"third-party"} Party classification.
 */
function classifyRequestParty(pageHostname, requestHostname) {

    const pageSite = getRegistrableDomain(pageHostname);
    const requestSite = getRegistrableDomain(requestHostname);

    if (pageSite && requestSite && pageSite === requestSite) {
        return "first-party";
    }

    return "third-party";

}

/**
 * Approximate a registrable domain without shipping a full Public Suffix List.
 *
 * Known limitation: uncommon multi-label public suffixes may be grouped
 * incorrectly until this function is replaced by a PSL-based implementation.
 *
 * @param {string} hostname - Hostname to normalize.
 * @returns {string} Approximate registrable domain.
 */
function getRegistrableDomain(hostname) {

    const normalizedHostname = normalizeHostname(hostname);

    if (!normalizedHostname) {
        return "";
    }

    if (isIPAddress(normalizedHostname) || normalizedHostname === "localhost") {
        return normalizedHostname;
    }

    const parts = normalizedHostname.split(".");

    if (parts.length <= 2) {
        return normalizedHostname;
    }

    const lastTwoParts = parts.slice(-2).join(".");

    if (
        COMMON_COMPOUND_PUBLIC_SUFFIXES.has(lastTwoParts) &&
        parts.length >= 3
    ) {
        return parts.slice(-3).join(".");
    }

    return lastTwoParts;

}

/**
 * Build a serializable snapshot for the popup.
 *
 * @param {number} tabId - Chrome tab ID.
 * @returns {object} Network activity snapshot.
 */
function getNetworkActivitySnapshot(tabId) {

    const state = tabNetworkStates.get(tabId);

    if (!state) {
        return createEmptyNetworkSnapshot();
    }

    const thirdPartyDomains = Object.values(state.thirdPartyDomains)
        .sort(function (left, right) {
            return right.requestCount - left.requestCount ||
                left.hostname.localeCompare(right.hostname);
        });

    const trackerDomains = Object.values(state.trackerDomains || {})
        .sort(function (left, right) {
            return right.requestCount - left.requestCount ||
                left.matchedDomain.localeCompare(right.matchedDomain);
        });

    return {
        pageUrl: state.pageUrl,
        pageHostname: state.pageHostname,
        pageSite: state.pageSite,
        trackerDataset: {
            source: BROWSERGUARD_TRACKER_DATA.source,
            license: BROWSERGUARD_TRACKER_DATA.license,
            reviewedAt: BROWSERGUARD_TRACKER_DATA.reviewedAt,
            entryCount: trackerMatcher.size
        },
        totalRequests: state.totalRequests,
        firstPartyRequests: state.firstPartyRequests,
        thirdPartyRequests: state.thirdPartyRequests,
        thirdPartyDomainCount: thirdPartyDomains.length,
        trackerRequests: state.trackerRequests || 0,
        trackerDomainCount: trackerDomains.length,
        resourceTypes: {
            ...state.resourceTypes
        },
        thirdPartyDomains: thirdPartyDomains.map(function (domain) {
            return {
                hostname: domain.hostname,
                requestCount: domain.requestCount,
                types: {
                    ...domain.types
                }
            };
        }),
        trackerDomains: trackerDomains.map(function (tracker) {
            return {
                hostname: tracker.hostname,
                matchedDomain: tracker.matchedDomain,
                category: tracker.category,
                requestCount: tracker.requestCount,
                types: {
                    ...tracker.types
                }
            };
        })
    };

}

/**
 * @returns {object} Empty snapshot used when no requests were observed yet.
 */
function createEmptyNetworkSnapshot() {

    return {
        pageUrl: "",
        pageHostname: "",
        pageSite: "",
        trackerDataset: {
            source: BROWSERGUARD_TRACKER_DATA.source,
            license: BROWSERGUARD_TRACKER_DATA.license,
            reviewedAt: BROWSERGUARD_TRACKER_DATA.reviewedAt,
            entryCount: trackerMatcher.size
        },
        totalRequests: 0,
        firstPartyRequests: 0,
        thirdPartyRequests: 0,
        thirdPartyDomainCount: 0,
        trackerRequests: 0,
        trackerDomainCount: 0,
        resourceTypes: {},
        thirdPartyDomains: [],
        trackerDomains: []
    };

}


/**
 * Restore per-tab network state after the MV3 service worker wakes up.
 *
 * @returns {Promise<void>}
 */
async function restoreNetworkStates() {

    try {

        const storedData = await chrome.storage.session.get(
            networkStateStorageKey
        );

        const serializedStates =
            storedData[networkStateStorageKey] || {};

        Object.entries(serializedStates).forEach(function ([tabId, state]) {
            tabNetworkStates.set(Number(tabId), normalizeNetworkState(state));
        });

    } catch (error) {

        console.error("BrowserGuard: network state restore failed", error);

    }

}


/**
 * Fill fields added after earlier stored versions of the network state.
 *
 * @param {object} state - Restored network state.
 * @returns {object} Normalized network state.
 */
function normalizeNetworkState(state) {

    return {
        pageUrl: state.pageUrl || "",
        pageHostname: state.pageHostname || "",
        pageSite: state.pageSite || "",
        totalRequests: state.totalRequests || 0,
        firstPartyRequests: state.firstPartyRequests || 0,
        thirdPartyRequests: state.thirdPartyRequests || 0,
        trackerRequests: state.trackerRequests || 0,
        resourceTypes: state.resourceTypes || {},
        thirdPartyDomains: state.thirdPartyDomains || {},
        trackerDomains: state.trackerDomains || {}
    };

}


/**
 * Persist per-tab network state for MV3 service worker suspension.
 *
 * @returns {Promise<void>}
 */
async function persistNetworkStates() {

    const serializedStates = {};

    tabNetworkStates.forEach(function (state, tabId) {
        serializedStates[tabId] = state;
    });

    try {

        await chrome.storage.session.set({
            [networkStateStorageKey]: serializedStates
        });

    } catch (error) {

        console.error("BrowserGuard: network state persist failed", error);

    }

}

/**
 * Normalize Chrome resource type labels for display and aggregation.
 *
 * @param {string} resourceType - Raw chrome.webRequest type.
 * @returns {string} Normalized resource type.
 */
function normalizeResourceType(resourceType) {

    if (resourceType === "xmlhttprequest") {
        return "xhr";
    }

    if (resourceType === "sub_frame") {
        return "iframe";
    }

    return resourceType || "other";

}

/**
 * @param {object} counters - Map-like counter object.
 * @param {string} key - Counter key.
 */
function incrementCounter(counters, key) {

    counters[key] = (counters[key] || 0) + 1;

}

/**
 * @param {string} urlString - URL to parse.
 * @returns {string} Parsed hostname or empty string.
 */
function extractHostname(urlString) {

    try {
        return normalizeHostname(new URL(urlString).hostname);
    } catch (error) {
        return "";
    }

}

/**
 * @param {string} hostname - Hostname to normalize.
 * @returns {string} Lowercase hostname without a trailing dot.
 */
function normalizeHostname(hostname) {

    return String(hostname || "")
        .toLowerCase()
        .replace(/\.$/, "");

}

/**
 * @param {string} hostname - Hostname to inspect.
 * @returns {boolean} True for simple IPv4 or IPv6 hostnames.
 */
function isIPAddress(hostname) {

    return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
        hostname.includes(":");

}
