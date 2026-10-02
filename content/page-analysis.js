/**
 * BrowserGuard Page Analyzer
 *
 * This content script analyzes the currently loaded web page
 * and extracts security-relevant information from the DOM.
 */


/**
 * Analyze security-relevant forms in the current page.
 *
 * @returns {object} Information about detected forms.
 */
function analyzeForms() {

    const forms = document.querySelectorAll("form");
    const passwordFields =
        document.querySelectorAll('input[type="password"]');

    let externalForms = 0;
    let externalPasswordForms = 0;
    let insecurePasswordForms = 0;


    forms.forEach(function (form) {

        const passwordField =
            form.querySelector('input[type="password"]');

        const action = form.getAttribute("action");

        // If the form has no explicit action,
        // the browser normally submits it to the current page
        if (!action) {
            return;
        }

        try {

            // Convert the action into an absolute URL
            const actionURL =
                new URL(action, window.location.href);

            const isExternal =
                hasDifferentHostname(actionURL);

            if (isExternal) {
                externalForms++;
            }

            // Check whether the password is sent to a different host
            if (passwordField && isExternal) {
                externalPasswordForms++;
            }

            // Check whether the password is sent using HTTP
            if (passwordField && actionURL.protocol === "http:") {
                insecurePasswordForms++;
            }

        } catch (error) {

            // Ignore malformed form actions
            console.error(
                "BrowserGuard: invalid form action",
                error
            );

        }

    });


    // Return the collected information
    return {
        formCount: forms.length,
        passwordFieldCount: passwordFields.length,
        externalForms: externalForms,
        externalPasswordForms: externalPasswordForms,
        insecurePasswordForms: insecurePasswordForms

    };

}


/**
 * Analyze links and identify external or visually misleading destinations.
 *
 * @returns {object} Information about detected links.
 */
function analyzeLinks() {

    const links = document.querySelectorAll("a[href]");
    let externalLinks = 0;
    let mismatchedLinks = 0;
    let suspiciousMismatchedLinks = 0;
    const mismatchedLinkDetails = [];

    links.forEach(function (link) {

        try {

            const hrefURL =
                new URL(link.getAttribute("href"), window.location.href);

            if (hasDifferentHostname(hrefURL)) {
                externalLinks++;
            }

            // Only inspect visible texts that look like real URLs or domains.
            const visibleText =
                link.textContent.trim().replace(/\s+/g, "");

            const displayedURL = extractURLFromText(visibleText);

            if (!displayedURL) {
                return;
            }

            if (
                hrefURL.hostname &&
                displayedURL.hostname !== hrefURL.hostname
            ) {
                mismatchedLinks++;

                const detail = {
                    displayedHostname: displayedURL.hostname,
                    destinationHostname: hrefURL.hostname,
                    externalDestination: hasDifferentHostname(hrefURL),
                    explicitDisplayedUrl: /^https?:\/\//i.test(visibleText)
                };

                if (
                    detail.externalDestination &&
                    detail.explicitDisplayedUrl
                ) {
                    suspiciousMismatchedLinks++;
                    detail.suspicious = true;
                } else {
                    detail.suspicious = false;
                }

                mismatchedLinkDetails.push(detail);
            }

        } catch (error) {

            // Malformed href values should not interrupt the whole page analysis.
            console.error("BrowserGuard: invalid link href", error);

        }

    });

    return {
        totalLinks: links.length,
        externalLinks: externalLinks,
        mismatchedLinks: mismatchedLinks,
        suspiciousMismatchedLinks: suspiciousMismatchedLinks,
        mismatchedLinkDetails: mismatchedLinkDetails.slice(0, 20)
    };

}


/**
 * Analyze iframe usage and detect simple hidden iframe patterns.
 *
 * @returns {object} Information about detected iframes.
 */
function analyzeIframes() {

    const iframes = document.querySelectorAll("iframe");
    let hiddenIframeCount = 0;
    let thirdPartyIframeCount = 0;
    let sandboxedIframeCount = 0;
    let thirdPartyUnsandboxedIframeCount = 0;
    let httpsPageHttpIframeCount = 0;
    const sandboxTokenCounts = {};

    iframes.forEach(function (iframe) {

        const style = window.getComputedStyle(iframe);
        const hasSandbox = iframe.hasAttribute("sandbox");

        // Hidden iframes are common in legitimate pages too, but can be useful signals.
        if (
            iframe.hidden ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            iframe.offsetWidth === 0 ||
            iframe.offsetHeight === 0
        ) {
            hiddenIframeCount++;
        }

        if (hasSandbox) {
            sandboxedIframeCount++;
            collectSandboxTokens(iframe, sandboxTokenCounts);
        }

        try {

            const src = iframe.getAttribute("src");

            if (!src) {
                return;
            }

            const iframeURL = new URL(src, window.location.href);
            const isThirdParty = hasDifferentHostname(iframeURL);

            if (isThirdParty) {
                thirdPartyIframeCount++;
            }

            if (isThirdParty && !hasSandbox) {
                thirdPartyUnsandboxedIframeCount++;
            }

            if (
                window.location.protocol === "https:" &&
                iframeURL.protocol === "http:"
            ) {
                httpsPageHttpIframeCount++;
            }

        } catch (error) {

            console.error("BrowserGuard: invalid iframe src", error);

        }

    });

    return {
        iframeCount: iframes.length,
        hiddenIframeCount: hiddenIframeCount,
        thirdPartyIframeCount: thirdPartyIframeCount,
        sandboxedIframeCount: sandboxedIframeCount,
        thirdPartyUnsandboxedIframeCount: thirdPartyUnsandboxedIframeCount,
        httpsPageHttpIframeCount: httpsPageHttpIframeCount,
        sandboxTokenCounts: sandboxTokenCounts
    };

}


/**
 * Count sandbox capability tokens that are explicitly re-enabled.
 *
 * @param {HTMLIFrameElement} iframe - Iframe to inspect.
 * @param {object} tokenCounts - Mutable token counter.
 */
function collectSandboxTokens(iframe, tokenCounts) {

    const sandboxValue = iframe.getAttribute("sandbox") || "";

    sandboxValue.split(/\s+/).forEach(function (token) {
        if (!token) {
            return;
        }

        tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    });

}


/**
 * Analyze external scripts loaded by the page.
 *
 * @returns {object} Information about detected scripts.
 */
function analyzeScripts() {

    const scripts = document.querySelectorAll("script[src]");
    let externalScriptCount = 0;

    scripts.forEach(function (script) {

        try {

            const scriptURL =
                new URL(script.getAttribute("src"), window.location.href);

            if (hasDifferentHostname(scriptURL)) {
                externalScriptCount++;
            }

        } catch (error) {

            // Ignore malformed script src values and continue analyzing the page.
            console.error("BrowserGuard: invalid script src", error);

        }

    });

    return {
        externalScriptCount: externalScriptCount
    };

}


/**
 * Aggregate all DOM-based page analysis signals.
 *
 * @returns {object} Full page analysis result.
 */
function analyzePage() {

    return {
        ...analyzeForms(),
        ...analyzeLinks(),
        ...analyzeIframes(),
        ...analyzeScripts()
    };

}


/**
 * Check whether a parsed URL points to a different hostname.
 *
 * @param {URL} url - Parsed URL to compare with the current page.
 * @returns {boolean} True when the URL has a real external hostname.
 */
function hasDifferentHostname(url) {

    return Boolean(
        url.hostname &&
        url.hostname !== window.location.hostname
    );

}


/**
 * Convert visible link text into a URL only when it looks like a URL or domain.
 *
 * @param {string} text - Visible text from a link.
 * @returns {URL|null} Parsed URL or null for generic link text.
 */
function extractURLFromText(text) {

    const urlLikePattern =
        /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}([/?#].*)?$/i;

    if (!urlLikePattern.test(text)) {
        return null;
    }

    try {

        const normalizedText =
            /^https?:\/\//i.test(text) ? text : "https://" + text;

        return new URL(normalizedText);

    } catch (error) {

        return null;

    }

}


// Register the message listener only once, even if the script is injected manually.
if (!globalThis.browserGuardMessageListenerRegistered) {

    globalThis.browserGuardMessageListenerRegistered = true;

    // Listen for PAGE_ANALYSIS requests from the popup and answer with DOM data.
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

        if (!message || !message.type) {
            return false;
        }

        if (message.type === "BROWSERGUARD_PING") {
            sendResponse({
                success: true,
                ready: true
            });

            return false;
        }

        if (message.type !== "PAGE_ANALYSIS") {
            return false;
        }

        try {

            sendResponse({
                success: true,
                data: analyzePage()
            });

        } catch (error) {

            // Return a controlled failure so the popup can identify analysis errors.
            console.error("BrowserGuard: page analysis failed", error);

            sendResponse({
                success: false,
                error: "Page analysis failed"
            });

        }

        return false;

    });

    console.debug("BrowserGuard: content script listener registered");

}


// Run the full page analysis once when the content script is loaded for debugging.
if (!globalThis.browserGuardInitialAnalysisLogged) {

    globalThis.browserGuardInitialAnalysisLogged = true;

    const pageAnalysis = analyzePage();

    console.log(
        "BrowserGuard Page Analysis:",
        pageAnalysis
    );

}
