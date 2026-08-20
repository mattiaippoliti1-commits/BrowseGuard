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
            return;
        }

        // Start the analysis of the current page URL
        analyzeURL(tab.url);

    } catch (error) {

        // Log unexpected errors while retrieving the active tab
        console.error("Error retrieving tab:", error);

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