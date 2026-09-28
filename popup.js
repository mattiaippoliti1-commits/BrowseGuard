// Wait until the popup HTML document is fully loaded
document.addEventListener("DOMContentLoaded", async function () {

    try {

        // Ask Chrome for the currently active tab
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        // Stop if the active tab or its URL cannot be retrieved
        if (!tab || !tab.url) {
            updatePageAnalysis(null);
            return;
        }

        // Start the analysis of the current page URL
        analyzeURL(tab.url);

        // Ask the content script to analyze the current page DOM
        const pageAnalysis = await requestPageAnalysis(tab);

        // Update the popup with page-level information
        updatePageAnalysis(pageAnalysis);

    } catch (error) {

        // Log unexpected errors while retrieving the active tab
        console.error("Error retrieving tab:", error);

        updatePageAnalysis(null);

    }

});


/**
 * Analyze the current URL and extract security-relevant features.
 *
 * @param {string} urlString - URL of the currently active browser tab.
 */
function analyzeURL(urlString) {

    try {

        // Convert the URL string into a structured URL object
        const url = new URL(urlString);


        // --------------------------------------------------
        // BASIC URL FEATURES
        // --------------------------------------------------

        // Extract the protocol and remove the final colon
        // Example: "https:" -> "https"
        const protocol = url.protocol.replace(":", "");

        // Extract the hostname
        // Example: "www.ilpost.it"
        const hostname = url.hostname;

        // Calculate the total number of characters in the URL
        const urlLength = urlString.length;

        // Count the number of subdomains
        const subdomainCount = countSubdomains(hostname);

        // Check whether the hostname is an IPv4 address
        const isIPAddress = isIP(hostname);

        // Check whether the hostname uses Punycode
        const hasPunycode = hostname.includes("xn--");


        // --------------------------------------------------
        // SECURITY INDICATORS
        // --------------------------------------------------

        // Check whether the connection uses HTTPS
        const usesHTTPS = protocol === "https";

        // Check whether the URL exceeds the selected threshold
        const isLongURL = urlLength > 100;

        // Check whether the hostname contains many subdomains
        const hasManySubdomains = subdomainCount >= 3;

        // Check whether the URL contains the @ character
        const hasAtSymbol = urlString.includes("@");

        // Check whether the URL contains percent-encoded characters
        const hasURLEncoding = /%[0-9A-Fa-f]{2}/.test(urlString);


        // --------------------------------------------------
        // UPDATE URL ANALYSIS CARD
        // --------------------------------------------------

        document.getElementById("protocol").textContent =
            protocol.toUpperCase();

        document.getElementById("hostname").textContent =
            hostname;

        document.getElementById("url-length").textContent =
            urlLength;

        document.getElementById("subdomains").textContent =
            subdomainCount;

        document.getElementById("ip-address").textContent =
            isIPAddress ? "Yes" : "No";

        document.getElementById("punycode").textContent =
            hasPunycode ? "Yes" : "No";


        // --------------------------------------------------
        // UPDATE SECURITY INDICATORS CARD
        // --------------------------------------------------

        document.getElementById("https-indicator").textContent =
            usesHTTPS ? "Yes" : "No";

        document.getElementById("long-url").textContent =
            isLongURL ? "Detected" : "No";

        document.getElementById("many-subdomains").textContent =
            hasManySubdomains ? "Detected" : "No";

        document.getElementById("at-symbol").textContent =
            hasAtSymbol ? "Detected" : "No";

        document.getElementById("url-encoding").textContent =
            hasURLEncoding ? "Detected" : "No";

    } catch (error) {

        // Log errors caused by invalid or unsupported URLs
        console.error("URL analysis failed:", error);

    }

}


/**
 * Request page analysis data from the content script running in the active tab.
 *
 * @param {object} tab - Currently active browser tab.
 * @returns {Promise<object|null>} Page analysis data, or null if unavailable.
 */
async function requestPageAnalysis(tab) {

    if (!tab || !tab.id) {
        return null;
    }

    if (!canAnalyzeTabURL(tab.url)) {
        console.debug("BrowserGuard: page analysis unsupported for this page");
        return null;
    }

    const isContentScriptAvailable =
        await ensureContentScriptAvailable(tab);

    if (!isContentScriptAvailable) {
        console.debug("BrowserGuard: content script not available after retry");
        return null;
    }

    try {

        const response = await sendPageAnalysisMessage(tab.id);

        if (!response || !response.success) {
            console.error(
                "BrowserGuard: page analysis failed in content script",
                response
            );

            return null;
        }

        console.debug("BrowserGuard: content script available");

        return response.data;

    } catch (error) {

        // The listener can disappear if the tab navigates while the popup is open.
        if (isReceivingEndMissing(error)) {
            console.debug("BrowserGuard: content script not yet available");
        } else {
            console.error("BrowserGuard: real page analysis error", error);
        }

        return null;

    }

}


/**
 * Verify that the content script listener is available before requesting analysis.
 *
 * @param {object} tab - Currently active browser tab.
 * @returns {Promise<boolean>} True when the content script answers the ping.
 */
async function ensureContentScriptAvailable(tab) {

    const maxAttempts = 3;
    const retryDelayMilliseconds = 120;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        const pingResponse = await pingContentScript(tab.id);

        if (pingResponse && pingResponse.ready) {
            console.debug("BrowserGuard: content script available");
            return true;
        }

        console.debug("BrowserGuard: content script not yet available");

        if (attempt === 1) {
            await injectContentScript(tab.id);
        }

        if (attempt < maxAttempts) {
            await delay(retryDelayMilliseconds);
        }

    }

    return false;

}


/**
 * Send the PAGE_ANALYSIS message to the content script.
 *
 * @param {number} tabId - ID of the tab that should receive the message.
 * @returns {Promise<object>} Response returned by the content script.
 */
function sendPageAnalysisMessage(tabId) {

    // Manifest V3 messaging between popup and content script.
    return chrome.tabs.sendMessage(tabId, {
        type: "PAGE_ANALYSIS"
    });

}


/**
 * Send a lightweight ping to check whether the content script listener is ready.
 *
 * @param {number} tabId - ID of the tab that should receive the message.
 * @returns {Promise<object|null>} Ping response, or null when no listener exists yet.
 */
async function pingContentScript(tabId) {

    try {

        return await chrome.tabs.sendMessage(tabId, {
            type: "BROWSERGUARD_PING"
        });

    } catch (error) {

        if (!isReceivingEndMissing(error)) {
            console.error("BrowserGuard: real content script ping error", error);
        }

        return null;

    }

}


/**
 * Inject the content script into supported pages when it is not present yet.
 *
 * @param {number} tabId - ID of the tab where the content script should run.
 * @returns {Promise<void>}
 */
async function injectContentScript(tabId) {

    try {

        // This handles tabs that were already open before the extension was reloaded.
        await chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            files: [
                "content.js"
            ]
        });

    } catch (error) {

        console.error("BrowserGuard: content script injection failed", error);

    }

}


/**
 * Check whether Chrome failed because no content script listener exists.
 *
 * @param {Error} error - Error thrown by chrome.tabs.sendMessage().
 * @returns {boolean} True when the receiving end is missing.
 */
function isReceivingEndMissing(error) {

    return Boolean(
        error &&
        error.message &&
        error.message.includes("Receiving end does not exist")
    );

}


/**
 * Decide whether BrowserGuard can analyze the current tab.
 *
 * @param {string} urlString - URL of the currently active browser tab.
 * @returns {boolean} True for normal HTTP and HTTPS pages.
 */
function canAnalyzeTabURL(urlString) {

    try {

        const url = new URL(urlString);

        const isWebPage =
            url.protocol === "http:" ||
            url.protocol === "https:";

        const isChromeWebStore =
            url.hostname === "chrome.google.com" &&
            url.pathname.startsWith("/webstore");

        const isNewChromeWebStore =
            url.hostname === "chromewebstore.google.com";

        return (
            isWebPage &&
            !isChromeWebStore &&
            !isNewChromeWebStore
        );

    } catch (error) {

        return false;

    }

}


/**
 * Wait for a short amount of time before retrying content script messaging.
 *
 * @param {number} milliseconds - Delay duration.
 * @returns {Promise<void>}
 */
function delay(milliseconds) {

    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });

}


/**
 * Update the Page Analysis card in the popup DOM.
 *
 * @param {object|null} analysis - Page analysis data returned by the content script.
 */
function updatePageAnalysis(analysis) {

    const unavailable = "Unavailable";
    const pageAnalysisFields = [
        ["page-forms", "formCount"],
        ["password-fields", "passwordFieldCount"],
        ["external-forms", "externalForms"],
        ["external-password-forms", "externalPasswordForms"],
        ["insecure-password-forms", "insecurePasswordForms"],
        ["total-links", "totalLinks"],
        ["external-links", "externalLinks"],
        ["mismatched-links", "mismatchedLinks"],
        ["iframes", "iframeCount"],
        ["hidden-iframes", "hiddenIframeCount"],
        ["external-scripts", "externalScriptCount"]
    ];

    if (!analysis) {
        pageAnalysisFields.forEach(function ([elementId]) {
            document.getElementById(elementId).textContent = unavailable;
        });

        return;
    }

    // Render the page analysis values returned by the content script.
    pageAnalysisFields.forEach(function ([elementId, propertyName]) {
        document.getElementById(elementId).textContent =
            analysis[propertyName];
    });

}


/**
 * Check whether a hostname is an IPv4 address.
 *
 * @param {string} hostname - Hostname extracted from the URL.
 * @returns {boolean} True if the hostname is an IPv4 address.
 */
function isIP(hostname) {

    // Regular expression for an IPv4 address
    const ipv4Pattern =
        /^(\d{1,3}\.){3}\d{1,3}$/;

    return ipv4Pattern.test(hostname);

}


/**
 * Count the number of subdomains in a hostname.
 *
 * @param {string} hostname - Hostname extracted from the URL.
 * @returns {number} Number of detected subdomains.
 */
function countSubdomains(hostname) {

    // IP addresses do not contain subdomains
    if (isIP(hostname)) {
        return 0;
    }

    // Split the hostname using the dot as separator
    const parts = hostname.split(".");

    // A simple domain such as example.com
    // is considered to have no subdomains
    if (parts.length <= 2) {
        return 0;
    }

    // Basic approximation:
    // hostname parts - domain name - top-level domain
    return parts.length - 2;

}
