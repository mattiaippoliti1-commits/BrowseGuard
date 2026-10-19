const themeStorageKey = "appearanceTheme";
const appearanceThemes = {
    dark: "dark",
    light: "light"
};

applyTheme(getSystemTheme());
loadStoredThemePreference().then(function (theme) {
    applyTheme(theme || getSystemTheme());
}).catch(function () {
    applyTheme(getSystemTheme());
});

// Wait until the popup HTML document is fully loaded
document.addEventListener("DOMContentLoaded", async function () {

    try {

        setupThemeToggle();
        BrowserGuardExperience.setup(document, chrome);
        setupContextualGlossary();

        const analysis = await loadFreshTabAnalysis();

        // Stop if the active tab or its URL cannot be retrieved
        if (!analysis) {
            updateUrlUnavailable();
            updatePageAnalysis(null);
            updateNetworkActivity(null);
            updateRuntimePrivacy(null);
            updateWebSecurity(null, null);
            updateAssessment(null);
            return;
        }

        updateNetworkActivity(analysis.networkActivity);
        updateRuntimePrivacy(analysis.runtimePrivacy);
        updatePageAnalysis(analysis.pageAnalysis);
        updateWebSecurity(analysis.webSecurity, analysis.pageAnalysis);

        const assessment = BrowserGuardAssessmentEngine.assessBrowserState({
            urlAnalysis: analysis.urlAnalysis,
            pageAnalysis: analysis.pageAnalysis,
            networkActivity: analysis.networkActivity,
            runtimePrivacy: analysis.runtimePrivacy,
            webSecurity: analysis.webSecurity
        });

        updateAssessment(assessment);

    } catch (error) {

        // Log unexpected errors while retrieving the active tab
        console.error("Error retrieving tab:", error);

        updateUrlUnavailable();
        updatePageAnalysis(null);
        updateNetworkActivity(null);
        updateRuntimePrivacy(null);
        updateWebSecurity(null, null);
        updateAssessment(null);

    }

});

const visibleThirdPartyDomainLimit = 5;
const visibleTrackerDomainLimit = 5;
const visibleFindingLimit = 5;
let currentNetworkActivity = null;
let currentAssessment = null;
let selectedAssessmentDimension = null;
let showAllThirdPartyDomains = false;
let showAllTrackerDomains = false;
let showAllFindings = false;


async function loadFreshTabAnalysis() {

    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const tab = await getActiveTab();
        const identity = createTabIdentity(tab);

        if (!identity) {
            return null;
        }

        const urlAnalysis = analyzeURL(tab.url);
        const networkActivity = await requestNetworkActivity(tab);
        const runtimePrivacy = await requestRuntimePrivacy(tab);
        const webSecurity = await requestWebSecurity(tab);
        const pageAnalysis = await requestPageAnalysis(tab);
        const latestTab = await getActiveTab();

        if (isSameTabIdentity(identity, createTabIdentity(latestTab))) {
            return {
                tab: tab,
                urlAnalysis: urlAnalysis,
                networkActivity: networkActivity,
                runtimePrivacy: runtimePrivacy,
                webSecurity: webSecurity,
                pageAnalysis: pageAnalysis
            };
        }
    }

    return null;

}


async function getActiveTab() {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tab || null;

}


function createTabIdentity(tab) {

    if (!tab || typeof tab.id !== "number" || !tab.url) {
        return null;
    }

    return {
        id: tab.id,
        url: tab.url
    };

}


function isSameTabIdentity(left, right) {

    return Boolean(
        left &&
        right &&
        left.id === right.id &&
        left.url === right.url
    );

}


function setupThemeToggle() {

    const toggle = document.getElementById("theme-toggle");

    if (!toggle) {
        return;
    }

    updateThemeToggle();

    toggle.addEventListener("click", function () {
        const nextTheme =
            getCurrentTheme() === appearanceThemes.dark ?
                appearanceThemes.light :
                appearanceThemes.dark;

        applyTheme(nextTheme);
        saveThemePreference(nextTheme);
    });

}


function getSystemTheme() {

    return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches ?
            appearanceThemes.dark :
            appearanceThemes.light;

}


function getCurrentTheme() {

    return document.documentElement.dataset.theme === appearanceThemes.light ?
        appearanceThemes.light :
        appearanceThemes.dark;

}


function applyTheme(theme) {

    const normalizedTheme =
        theme === appearanceThemes.light ?
            appearanceThemes.light :
            appearanceThemes.dark;

    document.documentElement.dataset.theme = normalizedTheme;
    updateThemeToggle();

}


function updateThemeToggle() {

    const toggle = document.getElementById("theme-toggle");

    if (!toggle) {
        return;
    }

    const isDark = getCurrentTheme() === appearanceThemes.dark;
    const label = isDark ?
        "Switch to light mode" :
        "Switch to dark mode";

    toggle.setAttribute("aria-label", label);
    toggle.title = label;

}


function loadStoredThemePreference() {

    return new Promise(function (resolve, reject) {
        if (
            typeof chrome === "undefined" ||
            !chrome.storage ||
            !chrome.storage.local
        ) {
            resolve(null);
            return;
        }

        chrome.storage.local.get(themeStorageKey, function (result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            const theme = result && result[themeStorageKey];
            resolve(isValidAppearanceTheme(theme) ? theme : null);
        });
    });

}


function saveThemePreference(theme) {

    if (!isValidAppearanceTheme(theme)) {
        return;
    }

    if (
        typeof chrome === "undefined" ||
        !chrome.storage ||
        !chrome.storage.local
    ) {
        return;
    }

    chrome.storage.local.set({
        [themeStorageKey]: theme
    });

}


function isValidAppearanceTheme(theme) {

    return theme === appearanceThemes.dark ||
        theme === appearanceThemes.light;

}


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

        updateProtocolDisplay(protocol);

        updateText("hostname", hostname);
        updateText("hostname-detail", hostname);

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

        updateIndicatorChip(
            "https-indicator",
            usesHTTPS ? "HTTPS" : "HTTP",
            usesHTTPS ? "positive" : "warning",
            true
        );

        updateIndicatorChip("long-url", "Long URL", "warning", isLongURL);

        updateIndicatorChip(
            "many-subdomains",
            "Many subdomains",
            "warning",
            hasManySubdomains
        );

        updateIndicatorChip("at-symbol", "Contains @", "warning", hasAtSymbol);

        updateIndicatorChip(
            "url-encoding",
            "URL encoding",
            "warning",
            hasURLEncoding
        );

        updateIndicatorChip("ip-address", "IP address", "warning", isIPAddress);
        updateIndicatorChip("punycode", "Punycode", "warning", hasPunycode);

        return {
            protocol: protocol,
            hostname: hostname,
            urlLength: urlLength,
            subdomainCount: subdomainCount,
            isIPAddress: isIPAddress,
            hasPunycode: hasPunycode,
            usesHTTPS: usesHTTPS,
            isLongURL: isLongURL,
            hasManySubdomains: hasManySubdomains,
            hasAtSymbol: hasAtSymbol,
            hasURLEncoding: hasURLEncoding
        };

    } catch (error) {

        // Log errors caused by invalid or unsupported URLs
        console.error("URL analysis failed:", error);
        updateUrlUnavailable();
        return null;

    }

}


/**
 * Update the temporary Assessment card.
 *
 * @param {object|null} assessment - Assessment Engine output.
 */
function updateAssessment(assessment) {
    currentAssessment = assessment;
    selectedAssessmentDimension = null;
    showAllFindings = false;
    const view = BrowserGuardPresentation.present(assessment, currentNetworkActivity);
    updateText("assessment-data-status", view.limitation + (view.missing ? " Missing: " + view.missing + "." : ""));
    BrowserGuardPresentation.dimensions.forEach(function (dimension) {
        const card = document.querySelector(".assessment-card[data-dimension='" + dimension + "']");
        const result = view.cards[dimension];
        card.dataset.state = result.state;
        updateText("assessment-" + dimension, result.label);
        card.setAttribute("aria-label", dimension.charAt(0).toUpperCase() + dimension.slice(1) + ": " +
            (result.state === "unknown" ? "Unavailable" : result.label) + ". Show assessment details");
        updateText("description-" + dimension, result.description + (result.limited ? " Some inputs are unavailable." : ""));
    });
    renderAssessmentContextPanel();
    document.getElementById("assessment-reasons").textContent = "";
    if (assessment) renderAssessmentReasons(assessment);
    renderPositiveSignals(assessment);
    renderDimensionFindings(assessment);
    updateQuickInsights();
}


/**
 * Render a compact Why section using the strongest reasons per dimension.
 *
 * @param {object} assessment - Assessment Engine output.
 */
function renderAssessmentReasons(assessment) {

    const container = document.getElementById("assessment-reasons");
    const findings = collectReasonFindings(assessment);
    const visibleFindings = showAllFindings ?
        findings :
        findings.slice(0, visibleFindingLimit);
    const hiddenFindingCount = findings.length - visibleFindings.length;

    container.textContent = "";

    if (findings.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "No assessment findings available yet.";
        container.appendChild(emptyState);
        return;
    }

    const list = document.createElement("div");
    list.className = "finding-list";

    visibleFindings.forEach(function (finding) {
        list.appendChild(renderFindingItem(finding, true));
    });

    container.appendChild(list);

    if (hiddenFindingCount > 0 || showAllFindings) {
        const button = document.createElement("button");
        button.className = "show-more-button";
        button.id = "findings-show-more";
        button.type = "button";
        button.textContent = showAllFindings ?
            "Show fewer findings" :
            "Show all findings (" + hiddenFindingCount + " more)";
        container.appendChild(button);
    }

}


function renderAssessmentContextPanel() {
    updateAssessmentCardSelection();
    const view = BrowserGuardPresentation.present(currentAssessment, currentNetworkActivity);
    BrowserGuardPresentation.dimensions.forEach(function (dimension) {
        const panel = document.getElementById("context-" + dimension);
        panel.textContent = "";
        panel.hidden = selectedAssessmentDimension !== dimension;
        if (panel.hidden) return;
        const result = currentAssessment && currentAssessment[dimension];
        const heading = document.createElement("h3");
        heading.textContent = dimension.charAt(0).toUpperCase() + dimension.slice(1) + " · " +
            (view.cards[dimension].state === "unknown" ? "Unavailable" : view.cards[dimension].label);
        panel.appendChild(heading);
        const summary = document.createElement("p");
        summary.textContent = view.cards[dimension].description;
        panel.appendChild(summary);
        const reasons = result && result.reasons || [];
        const contributors = result && result.contributingFindings || reasons.filter(reason => ["high", "medium"].includes(reason.severity));
        const selected = contributors.length ? contributors : reasons;
        if (selected.length) {
            const caption = document.createElement("p");
            caption.className = "context-caption";
            caption.textContent = contributors.length ? "Contributing findings" : "Observations and limitations";
            panel.appendChild(caption);
            const list = document.createElement("ul");
            list.className = "context-findings";
            selected.slice(0, 3).forEach(function (reason) {
                const item = document.createElement("li");
                item.textContent = BrowserGuardPresentation.explain(reason).observation;
                list.appendChild(item);
            });
            panel.appendChild(list);
        }
        const action = document.createElement("button");
        action.type = "button";
        action.className = "assessment-context-action";
        action.dataset.detailsTarget = dimension;
        action.textContent = "View all " + dimension + " evidence";
        panel.appendChild(action);
    });
}


function createGlossaryButton(term) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "glossary-button";
    button.dataset.glossary = term;
    button.textContent = "About " + term;
    button.setAttribute("aria-haspopup", "dialog");
    return button;
}

function setupContextualGlossary() {
    const terms = { "web-security-https": "HTTPS", "web-security-csp": "Content Security Policy", "web-security-hsts": "HSTS", "web-security-mixed-content": "Mixed content", "tracker-domain-count-detail": "Tracker", "network-third-party-requests": "Third-party request", "network-total-requests-detail": "Network activity", "web-security-content-type": "Security header" };
    Object.entries(terms).forEach(function ([id, term]) {
        const row = document.getElementById(id)?.parentElement;
        if (row) row.firstElementChild.appendChild(createGlossaryButton(term));
    });
    // Existing supplemental tooltips also support explicit touch/click and Escape dismissal.
    document.querySelectorAll(".info-dot").forEach(function (button) {
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", function () {
            const open = button.getAttribute("aria-expanded") !== "true";
            button.setAttribute("aria-expanded", String(open));
            button.parentElement.classList.toggle("is-open", open);
        });
        button.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                button.setAttribute("aria-expanded", "false");
                button.parentElement.classList.add("is-dismissed");
                button.parentElement.classList.remove("is-open");
            }
        });
        button.addEventListener("blur", function () {
            button.setAttribute("aria-expanded", "false");
            button.parentElement.classList.remove("is-open", "is-dismissed");
        });
    });
}


function renderFindingItem(finding, includeDimensionLabel) {

    const item = document.createElement("div");
    item.className =
        "finding-item " + getFindingClassName(finding);

    const text = document.createElement("div");
    text.className = "finding-text";

    if (includeDimensionLabel) {
        const label = document.createElement("span");
        label.className = "finding-label";
        label.textContent = finding.dimension;
        text.appendChild(label);
    }

    const message = document.createElement("span");
    message.className = "finding-message";
    message.textContent = finding.message;

    text.appendChild(message);
    item.appendChild(text);

    if (finding.evidence && Object.keys(finding.evidence).length) {
        const evidence = document.createElement("details");
        evidence.className = "evidence-disclosure";
        const summary = document.createElement("summary");
        summary.textContent = "Supporting evidence";
        evidence.appendChild(summary);
        evidence.appendChild(renderEvidenceRows(finding.evidence));
        text.appendChild(evidence);
    }

    return item;

}


function renderDimensionFindings(assessment) {
    BrowserGuardPresentation.dimensions.forEach(function (dimension) {
        const container = document.getElementById(dimension + "-findings");
        container.textContent = "";
        const reasons = assessment && assessment[dimension]?.reasons || [];
        reasons.forEach(function (reason) {
            container.appendChild(renderFindingItem({ ...reason, dimension: dimension, type: "reason" }, false));
        });
        if (!reasons.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = assessment ? "No specific findings in the available signals." : "Collection data is unavailable.";
            container.appendChild(empty);
        }
    });
}

function evidenceLabel(key) {
    const labels = { countedForEscalation: "Contributes to level", assessmentThirdPartyRequests: "Assessed external requests",
        assessmentThirdPartyDomainCount: "Assessed external domains", thirdPartyRequests: "Cross-origin requests",
        thirdPartyDomainCount: "Cross-origin domains", externalThirdPartyRequests: "Confirmed external requests",
        sameEntityThirdPartyRequests: "Confirmed same-entity requests", unknownThirdPartyRequests: "Unknown attribution requests", thirdPartyRatio: "Cross-origin ratio",
        assessmentThirdPartyRatio: "Assessed external ratio", combinedRuntimeIndicators: "Correlated API surfaces" };
    return labels[key] || key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, function (letter) { return letter.toUpperCase(); });
}

function renderEvidenceRows(value) {
    const container = document.createElement("div");
    container.className = "evidence-rows";
    Object.entries(value).forEach(function ([key, entry]) {
        if (entry && typeof entry === "object") {
            const label = document.createElement("p");
            label.className = "evidence-group-label";
            label.textContent = evidenceLabel(key);
            container.appendChild(label);
            if (Object.keys(entry).length) container.appendChild(renderEvidenceRows(entry));
            else {
                const empty = document.createElement("p");
                empty.className = "empty-state";
                empty.textContent = "None observed";
                container.appendChild(empty);
            }
        } else {
            const row = document.createElement("div");
            row.className = "analysis-row";
            const label = document.createElement("span");
            label.textContent = /^\d+$/.test(key) ? "Observation " + (Number(key) + 1) : evidenceLabel(key);
            const text = document.createElement("span");
            text.textContent = entry === true ? "Yes" : entry === false ? "No" : entry == null ? "Not available" : String(entry);
            row.appendChild(label); row.appendChild(text); container.appendChild(row);
        }
    });
    return container;
}

function updateQuickInsights() {
    const activity = currentNetworkActivity;
    const available = isSnapshotAvailable(activity);
    const count = key => available && Number.isFinite(activity[key]) ? String(activity[key]) : "—";
    updateText("network-total-requests", count("totalRequests"));
    updateText("tracker-known-count", count("trackerDomainCount"));
    const attribution = BrowserGuardPresentation.networkAttribution(currentAssessment, activity);
    updateText("network-external-third-party", available ? attribution.externalMetric : "—");
    updateText("external-count-note", attribution.explanation || "Counts only requests attributed to a different organization.");
    updateText("network-attribution-status", attribution.explanation);
}

let selectedTechnicalTab = "overview";
const technicalTabNames = ["overview", "security", "privacy", "network"];
function selectTechnicalTab(name, focus) {
    if (!technicalTabNames.includes(name)) return;
    selectedTechnicalTab = name;
    technicalTabNames.forEach(function (tab) {
        const button = document.getElementById("tab-" + tab);
        button.setAttribute("aria-selected", String(tab === name));
        button.setAttribute("tabindex", tab === name ? "0" : "-1");
        document.getElementById("panel-" + tab).hidden = tab !== name;
    });
    if (focus) document.getElementById("tab-" + name).focus();
}
document.addEventListener("click", function (event) {
    const tab = event.target.closest("[data-technical-tab]");
    if (tab) selectTechnicalTab(tab.dataset.technicalTab, false);
});
document.addEventListener("keydown", function (event) {
    const tab = event.target.closest("[data-technical-tab]");
    if (!tab) return;
    const index = technicalTabNames.indexOf(tab.dataset.technicalTab);
    const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 :
        event.key === "Home" ? 0 : event.key === "End" ? 3 : null;
    if (next === null) return;
    event.preventDefault();
    selectTechnicalTab(technicalTabNames[next], true);
});

function updateAssessmentCardSelection() {

    document.querySelectorAll(".assessment-card").forEach(function (card) {
        const isSelected =
            card.dataset.dimension === selectedAssessmentDimension;

        card.classList.toggle("is-selected", isSelected);
        card.setAttribute("aria-expanded", String(isSelected));
    });

}


function collectReasonFindings(assessment) {

    return [
        ["Security", assessment.security],
        ["Privacy", assessment.privacy],
        ["Network", assessment.network]
    ].flatMap(function ([dimension, result]) {
        return (result?.reasons || []).map(function (reason) {
            return {
                dimension: dimension,
                message: reason.message,
                severity: reason.severity,
                id: reason.id,
                evidence: reason.evidence,
                type: "reason"
            };
        });
    });

}


function renderPositiveSignals(assessment) {

    const section = document.getElementById("positive-signals-card");
    const container = document.getElementById("positive-signals");

    if (!section || !container) {
        return;
    }

    container.textContent = "";

    if (!assessment) {
        section.hidden = true;
        return;
    }

    const signals = collectPositiveSignals(assessment);

    if (signals.length === 0) {
        section.hidden = true;
        return;
    }

    signals.forEach(function (signal) {
        const chip = document.createElement("span");
        chip.className = "positive-signal-chip";
        chip.textContent = formatPositiveSignalLabel(signal);
        container.appendChild(chip);
    });

    section.hidden = false;

}


function isSnapshotAvailable(snapshot) {

    return Boolean(snapshot && snapshot.available !== false);

}


function collectPositiveSignals(assessment) {

    return [
        assessment.security,
        assessment.privacy,
        assessment.network
    ].flatMap(function (result) {
        return result?.positiveSignals || [];
    });

}


function formatPositiveSignalLabel(signal) {

    const labelsById = {
        "https-enabled": "HTTPS",
        "hsts-present": "HSTS",
        "csp-present": "CSP",
        "content-type-nosniff": "XCTO nosniff",
        "anti-framing-present": "Anti-framing",
        "no-mixed-content-observed": "No mixed content"
    };

    const labelsByMessage = {
        "HTTPS connection observed": "HTTPS",
        "HSTS header present": "HSTS",
        "CSP header present": "CSP",
        "X-Content-Type-Options nosniff present": "XCTO nosniff",
        "Explicit anti-framing policy observed": "Anti-framing",
        "No mixed content observed": "No mixed content"
    };

    return labelsById[signal.id] ||
        labelsByMessage[signal.message] ||
        signal.message;

}


function getFindingClassName(finding) {

    if (finding.type === "positive") {
        return "is-positive";
    }

    return "is-" + finding.severity;

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
        return null;
    }

    const isContentScriptAvailable =
        await ensureContentScriptAvailable(tab);

    if (!isContentScriptAvailable) {
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

        return response.data;

    } catch (error) {

        // The listener can disappear if the tab navigates while the popup is open.
        if (!isReceivingEndMissing(error)) {
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
            return true;
        }

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
 * Request network activity data from the background service worker.
 *
 * @param {object} tab - Currently active browser tab.
 * @returns {Promise<object|null>} Network activity snapshot.
 */
async function requestNetworkActivity(tab) {

    if (!tab || !tab.id || !canAnalyzeTabURL(tab.url)) {
        return null;
    }

    try {

        const response = await chrome.runtime.sendMessage({
            type: "GET_NETWORK_ACTIVITY",
            tabId: tab.id
        });

        if (!response || !response.success) {
            return null;
        }

        return response.data;

    } catch (error) {

        console.error("BrowserGuard: network activity request failed", error);
        return null;

    }

}


/**
 * Request runtime privacy data from the background service worker.
 *
 * @param {object} tab - Currently active browser tab.
 * @returns {Promise<object|null>} Runtime privacy snapshot.
 */
async function requestRuntimePrivacy(tab) {

    if (!tab || !tab.id || !canAnalyzeTabURL(tab.url)) {
        return null;
    }

    try {

        const response = await chrome.runtime.sendMessage({
            type: "GET_RUNTIME_PRIVACY",
            tabId: tab.id
        });

        if (!response || !response.success) {
            return null;
        }

        return response.data;

    } catch (error) {

        console.error("BrowserGuard: runtime privacy request failed", error);
        return null;

    }

}


/**
 * Request Web Security data from the background service worker.
 *
 * @param {object} tab - Currently active browser tab.
 * @returns {Promise<object|null>} Web Security snapshot.
 */
async function requestWebSecurity(tab) {

    if (!tab || !tab.id || !canAnalyzeTabURL(tab.url)) {
        return null;
    }

    try {

        const response = await chrome.runtime.sendMessage({
            type: "GET_WEB_SECURITY",
            tabId: tab.id
        });

        if (!response || !response.success) {
            return null;
        }

        return response.data;

    } catch (error) {

        console.error("BrowserGuard: web security request failed", error);
        return null;

    }

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
                "content/page-analysis.js"
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
            analysis[propertyName] ?? "—";
    });

}


/**
 * Update the Network Activity card in the popup.
 *
 * @param {object|null} activity - Network activity snapshot from service worker.
 */
function updateNetworkActivity(activity) {

    currentNetworkActivity = activity;
    updateQuickInsights();
    showAllThirdPartyDomains = false;

    const unavailable = "Unavailable";
    const notObservedYet = "Not observed yet";
    const summaryFields = [
        ["network-first-party-requests", "firstPartyRequests"],
        ["network-third-party-requests", "thirdPartyRequests"],
        ["network-third-party-domains", "thirdPartyDomainCount"],
        ["network-same-entity-third-party", "sameEntityThirdPartyRequests"],
        ["network-unknown-third-party", "unknownThirdPartyRequests"]
    ];

    if (!activity) {
        summaryFields.forEach(function ([elementId]) {
            document.getElementById(elementId).textContent = unavailable;
        });

        updateText("network-total-requests-detail", unavailable);
        updateText("network-same-entity-third-party-detail", unavailable);
        updateText("network-external-third-party-detail", unavailable);
        renderNetworkResourceTypes(null);
        renderThirdPartyDomains([]);
        updateTrackerDetection(null);
        return;
    }

    if (!isSnapshotAvailable(activity)) {
        summaryFields.forEach(function ([elementId]) {
            document.getElementById(elementId).textContent = notObservedYet;
        });

        updateText("network-total-requests-detail", notObservedYet);
        updateText("network-same-entity-third-party-detail", notObservedYet);
        updateText("network-external-third-party-detail", notObservedYet);
        renderNetworkResourceTypes(null);
        renderThirdPartyDomains(null);
        updateTrackerDetection(activity);
        return;
    }

    summaryFields.forEach(function ([elementId, propertyName]) {
        document.getElementById(elementId).textContent =
            activity[propertyName] ?? "—";
    });

    updateText("network-total-requests-detail", activity.totalRequests);
    updateText(
        "network-same-entity-third-party-detail",
        activity.sameEntityThirdPartyRequests
    );
    updateText(
        "network-external-third-party-detail",
        activity.externalThirdPartyRequests
    );
    renderNetworkResourceTypes(activity.resourceTypes);
    renderThirdPartyDomains(activity.thirdPartyDomains || []);
    updateTrackerDetection(activity);

}


/**
 * Update the Runtime Privacy card.
 *
 * @param {object|null} runtimePrivacy - Runtime privacy snapshot.
 */
function updateRuntimePrivacy(runtimePrivacy) {

    const note = document.getElementById("runtime-indicator-note");
    const list = document.getElementById("runtime-category-list");

    list.textContent = "";
    note.hidden = true;

    if (!runtimePrivacy) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "Runtime privacy data unavailable.";
        list.appendChild(emptyState);
        return;
    }

    if (!isSnapshotAvailable(runtimePrivacy)) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "Runtime privacy data not observed yet.";
        list.appendChild(emptyState);
        return;
    }

    note.hidden = !runtimePrivacy.multipleIndicators;

    const categoryDefinitions = [
        ["canvas", "Canvas"],
        ["webgl", "WebGL"],
        ["audio", "Audio"],
        ["navigator", "Device Information"],
        ["screen", "Screen Information"]
    ];

    categoryDefinitions.forEach(function ([categoryKey, label]) {
        const category =
            (runtimePrivacy.categories || {})[categoryKey] ||
            createEmptyRuntimeCategory();

        list.appendChild(renderRuntimeCategory(label, category));
    });

}


/**
 * Update the Web Security card.
 *
 * @param {object|null} webSecurity - Web Security snapshot.
 * @param {object|null} pageAnalysis - Page Analysis snapshot with iframe data.
 */
function updateWebSecurity(webSecurity, pageAnalysis) {

    const unavailable = "Unavailable";
    const observations = document.getElementById("web-security-observations");
    observations.textContent = "";

    if (!webSecurity || !webSecurity.headers) {
        [
            "web-security-https",
            "web-security-csp",
            "web-security-hsts",
            "web-security-content-type",
            "web-security-referrer",
            "web-security-permissions",
            "web-security-anti-framing",
            "web-security-mixed-content",
            "web-security-iframes"
        ].forEach(function (elementId) {
            document.getElementById(elementId).textContent = unavailable;
        });

        return;
    }

    if (!isSnapshotAvailable(webSecurity)) {
        [
            "web-security-https",
            "web-security-csp",
            "web-security-hsts",
            "web-security-content-type",
            "web-security-referrer",
            "web-security-permissions",
            "web-security-anti-framing",
            "web-security-mixed-content",
            "web-security-iframes"
        ].forEach(function (elementId) {
            document.getElementById(elementId).textContent = "Not observed yet";
        });

        return;
    }

    document.getElementById("web-security-https").textContent =
        webSecurity.https?.enabled ? "Enabled" : "Not observed";

    document.getElementById("web-security-csp").textContent =
        formatCspStatus(webSecurity.headers.csp);

    document.getElementById("web-security-hsts").textContent =
        formatHstsStatus(webSecurity.headers.hsts);

    document.getElementById("web-security-content-type").textContent =
        webSecurity.headers.contentTypeOptions?.status ?? "Not collected";

    document.getElementById("web-security-referrer").textContent =
        webSecurity.headers.referrerPolicy?.status ?? "Not collected";

    document.getElementById("web-security-permissions").textContent =
        webSecurity.headers.permissionsPolicy ? formatPermissionsPolicyStatus(webSecurity.headers.permissionsPolicy) : "Not collected";

    document.getElementById("web-security-anti-framing").textContent =
        webSecurity.headers.antiFraming?.status ?? "Not collected";

    document.getElementById("web-security-mixed-content").textContent =
        formatMixedContentStatus(webSecurity.mixedContent);

    document.getElementById("web-security-iframes").textContent =
        formatIframeSecurityStatus(pageAnalysis);

    renderWebSecurityObservations(webSecurity, pageAnalysis);

}


function formatCspStatus(csp) {

    if (!csp) {
        return "Unavailable";
    }

    const observationCount = csp.observations ? csp.observations.length : 0;

    if (observationCount === 0) {
        return csp.status;
    }

    return csp.status + " · " + observationCount + " observations";

}


function formatHstsStatus(hsts) {

    if (!hsts || !hsts.present) {
        return "Missing";
    }

    if (hsts.maxAge === null) {
        return "Present";
    }

    return "Present · max-age " + hsts.maxAge;

}


function formatPermissionsPolicyStatus(permissionsPolicy) {

    if (!permissionsPolicy || !permissionsPolicy.present) {
        return "Not explicitly set";
    }

    const featureCount = permissionsPolicy.features ?
        permissionsPolicy.features.length :
        0;

    return featureCount > 0 ?
        "Present · " + featureCount + " features" :
        "Present";

}


function formatMixedContentStatus(mixedContent) {

    if (!mixedContent || mixedContent.requestCount === 0) {
        return "None observed";
    }

    return "Observed · " + mixedContent.requestCount + " requests";

}


function formatIframeSecurityStatus(pageAnalysis) {

    if (!pageAnalysis) {
        return "Unavailable";
    }

    return (pageAnalysis.thirdPartyIframeCount ?? "—") + " third-party · " +
        (pageAnalysis.sandboxedIframeCount ?? "—") + " sandboxed";

}


function renderWebSecurityObservations(webSecurity, pageAnalysis) {

    const observations = document.getElementById("web-security-observations");
    const items = [];

    if (webSecurity.headers.csp?.observations) {
        webSecurity.headers.csp.observations.forEach(function (observation) {
            items.push("CSP: " + observation);
        });
    }

    if (webSecurity.headers.hsts?.observations) {
        webSecurity.headers.hsts.observations.forEach(function (observation) {
            items.push("HSTS: " + observation);
        });
    }

    if (
        webSecurity.mixedContent &&
        webSecurity.mixedContent.requestCount > 0
    ) {
        items.push(
            "Mixed Content: " +
            formatTypeCounts(webSecurity.mixedContent.types)
        );
    }

    if (pageAnalysis && pageAnalysis.thirdPartyUnsandboxedIframeCount > 0) {
        items.push(
            "Iframes: " +
            pageAnalysis.thirdPartyUnsandboxedIframeCount +
            " third-party without sandbox"
        );
    }

    if (pageAnalysis && pageAnalysis.httpsPageHttpIframeCount > 0) {
        items.push(
            "Iframes: " +
            pageAnalysis.httpsPageHttpIframeCount +
            " HTTP iframe on HTTPS page"
        );
    }

    if (items.length === 0) {
        return;
    }

    const list = document.createElement("ul");
    list.className = "web-security-observation-list";

    items.forEach(function (item) {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
    });

    observations.appendChild(list);

}


function formatTypeCounts(types) {

    return Object.entries(types || {})
        .sort(function (left, right) {
            return right[1] - left[1] || left[0].localeCompare(right[0]);
        })
        .map(function ([type, count]) {
            return type + ": " + count;
        })
        .join(" · ");

}


/**
 * @returns {object} Empty category used as a UI fallback.
 */
function createEmptyRuntimeCategory() {

    return {
        detected: false,
        eventCount: 0,
        apis: [],
        details: []
    };

}


/**
 * Render one Runtime Privacy category.
 *
 * @param {string} label - UI category label.
 * @param {object} category - Runtime category snapshot.
 * @returns {HTMLElement} Rendered category element.
 */
function renderRuntimeCategory(label, category) {

    const item = document.createElement("div");
    item.className = "runtime-category-item";

    const header = document.createElement("div");
    header.className = "runtime-category-header";

    const title = document.createElement("span");
    title.className = "runtime-category-title";
    title.textContent = label;

    const status = document.createElement("span");
    status.className = "runtime-category-status";
    status.classList.add(category.detected ? "is-active" : "is-idle");
    status.textContent = formatRuntimeCategoryStatus(category);

    header.appendChild(title);
    header.appendChild(status);
    item.appendChild(header);

    const observedDetails = formatRuntimeObservedDetails(category);

    if (observedDetails.length > 0) {
        const detailList = document.createElement("ul");
        detailList.className = "runtime-detail-list";

        observedDetails.forEach(function (detail) {
            const detailItem = document.createElement("li");
            detailItem.textContent = detail;
            detailList.appendChild(detailItem);
        });

        item.appendChild(detailList);
    }

    return item;

}


/**
 * @param {object} category - Runtime category snapshot.
 * @returns {string} Descriptive category status.
 */
function formatRuntimeCategoryStatus(category) {

    if (!category.detected) {
        return "Not observed";
    }

    if (category.eventCount === 1) {
        return "1 event";
    }

    return category.eventCount + " events";

}


/**
 * @param {object} category - Runtime category snapshot.
 * @returns {Array<string>} API/property names to show, without values.
 */
function formatRuntimeObservedDetails(category) {

    if (!category.detected) {
        return [];
    }

    const details = category.details && category.details.length > 0 ?
        category.details :
        category.apis || [];

    return details.map(function (detail) {
        return detail.replace(/:$/, "").replace(":", " · ");
    });

}


/**
 * Update the Privacy / Trackers card in the popup.
 *
 * @param {object|null} activity - Network activity snapshot from service worker.
 */
function updateTrackerDetection(activity) {

    showAllTrackerDomains = false;

    const summaryFields = [
        ["tracker-domain-count-detail", "trackerDomainCount"],
        ["tracker-request-count", "trackerRequests"]
    ];

    if (!activity) {
        summaryFields.forEach(function ([elementId]) {
            document.getElementById(elementId).textContent = "Unavailable";
        });

        renderTrackerDomains([]);
        return;
    }

    if (!isSnapshotAvailable(activity)) {
        summaryFields.forEach(function ([elementId]) {
            document.getElementById(elementId).textContent = "Not observed yet";
        });

        renderTrackerDomains(null);
        return;
    }

    summaryFields.forEach(function ([elementId, propertyName]) {
        document.getElementById(elementId).textContent =
            activity[propertyName] ?? "—";
    });

    renderTrackerDomains(activity.trackerDomains || []);

}


/**
 * Render aggregate request counts by Chrome resource type.
 *
 * @param {object|null} resourceTypes - Resource type counters.
 */
function renderNetworkResourceTypes(resourceTypes) {

    const container = document.getElementById("network-resource-types");
    container.textContent = "";

    if (!resourceTypes || Object.keys(resourceTypes).length === 0) {
        return;
    }

    const orderedTypes = Object.entries(resourceTypes)
        .sort(function (left, right) {
            return right[1] - left[1] || left[0].localeCompare(right[0]);
        });

    orderedTypes.forEach(function ([type, count]) {
        const pill = document.createElement("span");
        pill.className = "network-type-pill";
        pill.textContent = formatResourceType(type) + ": " + count;
        container.appendChild(pill);
    });

}


/**
 * Render the cross-origin domain list with a compact Show more control.
 *
 * @param {Array<object>} domains - Cross-origin domain summaries.
 */
function renderThirdPartyDomains(domains) {

    const list = document.getElementById("network-domain-list");
    const showMoreButton = document.getElementById("network-show-more");

    list.textContent = "";

    if (!domains) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "Network data not observed yet.";
        list.appendChild(emptyState);
        showMoreButton.hidden = true;
        return;
    }

    if (domains.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "No cross-origin domains observed yet.";
        list.appendChild(emptyState);
        showMoreButton.hidden = true;
        return;
    }

    const visibleDomains = showAllThirdPartyDomains ?
        domains :
        domains.slice(0, visibleThirdPartyDomainLimit);

    visibleDomains.forEach(function (domain) {
        const item = document.createElement("div");
        item.className = "network-domain-item";

        const hostname = document.createElement("span");
        hostname.className = "network-domain-hostname";
        hostname.textContent = domain.hostname;

        const details = document.createElement("span");
        details.className = "network-domain-details";
        details.textContent = formatDomainRequestSummary(domain);

        item.appendChild(hostname);
        item.appendChild(details);
        list.appendChild(item);
    });

    showMoreButton.hidden = domains.length <= visibleThirdPartyDomainLimit;
    showMoreButton.textContent = showAllThirdPartyDomains ?
        "Show less" :
        "Show more";

}


document.addEventListener("click", function (event) {

    const card = event.target.closest(".assessment-card");

    if (!card) {
        return;
    }

    const dimension = card.dataset.dimension;

    if (!dimension) {
        return;
    }

    selectedAssessmentDimension =
        selectedAssessmentDimension === dimension ? null : dimension;
    renderAssessmentContextPanel();

});


document.addEventListener("click", function (event) {

    const action = event.target.closest(".assessment-context-action");

    if (!action) {
        return;
    }

    focusTechnicalDetailsSection(action.dataset.detailsTarget);

});


document.addEventListener("click", function (event) {

    const trigger = event.target.closest("#technical-details-trigger");

    if (!trigger) {
        return;
    }

    const content = document.getElementById(
        trigger.getAttribute("aria-controls")
    );
    const isExpanded = trigger.getAttribute("aria-expanded") === "true";

    trigger.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;

});


document.addEventListener("click", function (event) {

    if (event.target.id !== "findings-show-more" || !currentAssessment) {
        return;
    }

    showAllFindings = !showAllFindings;
    renderAssessmentReasons(currentAssessment);

});


document.addEventListener("click", function (event) {

    if (event.target.id !== "network-show-more" || !currentNetworkActivity) {
        return;
    }

    showAllThirdPartyDomains = !showAllThirdPartyDomains;
    renderThirdPartyDomains(currentNetworkActivity.thirdPartyDomains || []);

});


document.addEventListener("click", function (event) {

    if (event.target.id !== "tracker-show-more" || !currentNetworkActivity) {
        return;
    }

    showAllTrackerDomains = !showAllTrackerDomains;
    renderTrackerDomains(currentNetworkActivity.trackerDomains || []);

});


/**
 * Render the tracking-associated domain list with a compact Show more control.
 *
 * @param {Array<object>} trackers - Tracking-associated domain summaries.
 */
function renderTrackerDomains(trackers) {

    const list = document.getElementById("tracker-domain-list");
    const showMoreButton = document.getElementById("tracker-show-more");

    list.textContent = "";

    if (!trackers) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent =
            "Tracking-associated activity not observed yet.";
        list.appendChild(emptyState);
        showMoreButton.hidden = true;
        return;
    }

    if (trackers.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent =
            "No tracking-associated domains detected.";
        list.appendChild(emptyState);
        showMoreButton.hidden = true;
        return;
    }

    const visibleTrackers = showAllTrackerDomains ?
        trackers :
        trackers.slice(0, visibleTrackerDomainLimit);

    visibleTrackers.forEach(function (tracker) {
        const item = document.createElement("div");
        item.className = "network-domain-item";

        const hostname = document.createElement("span");
        hostname.className = "network-domain-hostname";
        hostname.textContent = tracker.matchedDomain || tracker.hostname || "Domain not recorded";

        const details = document.createElement("span");
        details.className = "network-domain-details";
        details.textContent = formatTrackerSummary(tracker);

        item.appendChild(hostname);
        item.appendChild(details);
        list.appendChild(item);
    });

    showMoreButton.hidden = trackers.length <= visibleTrackerDomainLimit;
    showMoreButton.textContent = showAllTrackerDomains ?
        "Show less" :
        "Show more";

}


/**
 * @param {object} tracker - Tracking-associated domain summary.
 * @returns {string} Human-readable tracker category and count summary.
 */
function formatTrackerSummary(tracker) {

    const requestLabel =
        tracker.requestCount === 1 ? "request" : "requests";
    const matchNote =
        tracker.hostname && tracker.hostname !== tracker.matchedDomain ?
            " · observed: " + tracker.hostname :
            "";

    return formatTrackingCategory(tracker.category) + " · " +
        tracker.requestCount + " " + requestLabel +
        matchNote;

}


/**
 * Present Tracker Radar categories without implying that every request is
 * itself definitively tracking.
 *
 * @param {string} category - Internal normalized Tracker Radar category.
 * @returns {string} User-facing category label.
 */
function formatTrackingCategory(category) {

    const labels = {
        Advertising: "Advertising-related",
        Analytics: "Analytics-related",
        Social: "Social-related"
    };

    return labels[category] || category || "Other";

}


/**
 * @param {object} domain - Cross-origin domain summary.
 * @returns {string} Human-readable count and resource type summary.
 */
function formatDomainRequestSummary(domain) {

    const requestLabel =
        domain.requestCount === 1 ? "request" : "requests";

    const typeSummary = Object.entries(domain.types || {})
        .sort(function (left, right) {
            return right[1] - left[1] || left[0].localeCompare(right[0]);
        })
        .slice(0, 3)
        .map(function ([type, count]) {
            return count + " " + formatResourceType(type);
        });

    const parts = [
        domain.requestCount + " " + requestLabel
    ];

    if (typeSummary.length > 0) {
        parts.push(typeSummary.join(" · "));
    }

    return parts.join(" · ");

}


/**
 * @param {string} type - Normalized resource type.
 * @returns {string} Short display label.
 */
function formatResourceType(type) {

    const labels = {
        main_frame: "document",
        script: "scripts",
        stylesheet: "stylesheets",
        image: "images",
        font: "fonts",
        xhr: "XHR/fetch",
        media: "media",
        iframe: "iframes",
        other: "other"
    };

    return labels[type] || type;

}


function updateText(elementId, value) {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = value;
    if (elementId === "hostname") element.setAttribute("title", value);

}


function updateProtocolDisplay(protocol) {

    const label = protocol.toUpperCase();
    const badge = document.getElementById("protocol");

    updateText("protocol", label);
    updateText("protocol-detail", label);

    if (!badge) {
        return;
    }

    badge.classList.remove("is-https", "is-http");
    badge.classList.add(protocol === "https" ? "is-https" : "is-http");

}


function updateUrlUnavailable() {

    updateText("protocol", "Unavailable");
    updateText("protocol-detail", "Unavailable");
    updateText("hostname", "Unavailable");
    updateText("hostname-detail", "Unavailable");

    const protocol = document.getElementById("protocol");

    if (protocol) {
        protocol.classList.remove("is-https", "is-http");
    }

    [
        "url-length",
        "subdomains"
    ].forEach(function (elementId) {
        updateText(elementId, "Unavailable");
    });

    [
        "https-indicator",
        "long-url",
        "many-subdomains",
        "at-symbol",
        "url-encoding",
        "ip-address",
        "punycode"
    ].forEach(function (elementId) {
        updateIndicatorChip(elementId, "Unavailable", "warning", false);
    });

}


function updateIndicatorChip(elementId, label, status, isVisible) {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = label;
    element.classList.remove("is-muted", "is-positive", "is-warning");

    if (!isVisible) {
        element.classList.add("is-muted");
        return;
    }

    element.classList.add(status === "positive" ? "is-positive" : "is-warning");

}


function focusTechnicalDetailsSection(dimension) {

    const trigger = document.getElementById("technical-details-trigger");
    const content = document.getElementById("technical-details-content");
    const targetIds = {
        security: "web-security-title",
        privacy: "privacy-signals-title",
        network: "network-title"
    };
    const target = document.getElementById(targetIds[dimension]);

    if (!trigger || !content || !target) {
        return;
    }

    trigger.setAttribute("aria-expanded", "true");
    content.hidden = false;
    selectTechnicalTab(dimension, false);
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({
        block: "start",
        behavior: "instant"
    });
    target.focus({
        preventScroll: true
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
