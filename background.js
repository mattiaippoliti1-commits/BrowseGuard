/**
 * BrowserGuard Network Activity Collector
 *
 * This MV3 service worker observes network requests and keeps per-tab state.
 * It does not block, modify, classify reputation, or assign risk to traffic.
 */

const tabNetworkStates = new Map();
const networkStateStorageKey = "browserGuardNetworkStates";
const networkStatesReady = restoreNetworkStates();

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
    await networkStatesReady;
    tabNetworkStates.delete(tabId);
    await persistNetworkStates();
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (!message || message.type !== "GET_NETWORK_ACTIVITY") {
        return false;
    }

    networkStatesReady.then(function () {
        sendResponse({
            success: true,
            data: getNetworkActivitySnapshot(message.tabId)
        });
    });

    return true;

});

/**
 * Observe one Chrome network request and update the matching tab state.
 *
 * @param {object} details - chrome.webRequest request details.
 */
async function handleBeforeRequest(details) {

    if (!details || details.tabId < 0 || !details.url) {
        return;
    }

    await networkStatesReady;

    if (details.type === "main_frame") {
        resetTabNetworkState(details.tabId, details.url);
    }

    const state = getOrCreateTabNetworkState(details.tabId, details.url);
    recordNetworkRequest(state, details);
    await persistNetworkStates();

}

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
        resourceTypes: {},
        thirdPartyDomains: {}
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

    return {
        pageUrl: state.pageUrl,
        pageHostname: state.pageHostname,
        pageSite: state.pageSite,
        totalRequests: state.totalRequests,
        firstPartyRequests: state.firstPartyRequests,
        thirdPartyRequests: state.thirdPartyRequests,
        thirdPartyDomainCount: thirdPartyDomains.length,
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
        totalRequests: 0,
        firstPartyRequests: 0,
        thirdPartyRequests: 0,
        thirdPartyDomainCount: 0,
        resourceTypes: {},
        thirdPartyDomains: []
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
            tabNetworkStates.set(Number(tabId), state);
        });

    } catch (error) {

        console.error("BrowserGuard: network state restore failed", error);

    }

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
