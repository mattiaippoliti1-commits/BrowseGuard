/**
 * BrowserGuard Assessment Engine
 *
 * Converts collected technical signals into deterministic, explainable,
 * user-facing assessments. This module has no UI or Chrome API dependencies.
 */

const ASSESSMENT_THRESHOLDS = {
    security: {
        moderateSignalsForAttention: 2
    },
    privacy: {
        moderateTrackerDomains: 2,
        elevatedTrackerDomains: 5,
        moderateTrackerRequests: 10,
        elevatedTrackerRequests: 30,
        elevatedTrackerRequestMinimumDomains: 2,
        multipleRuntimeCategories: 3
    },
    network: {
        moderateThirdPartyRatio: 0.25,
        highThirdPartyRatio: 0.5,
        highThirdPartyRatioMinimumRequests: 10,
        moderateThirdPartyDomains: 5,
        highThirdPartyDomains: 15,
        highThirdPartyDomainsMinimumRequests: 15,
        highThirdPartyDomainsMinimumTotalRequests: 30,
        moderateThirdPartyRequests: 20,
        highThirdPartyRequests: 75
    }
};

function assessBrowserState(snapshot) {

    const normalizedSnapshot = snapshot || {};
    const missingSources = getMissingSources(normalizedSnapshot);
    const dataStatus = missingSources.length === 0 ? "complete" : "partial";

    return {
        dataStatus: dataStatus,
        missingSources: missingSources,
        security: assessSecurity(normalizedSnapshot, dataStatus),
        privacy: assessPrivacy(normalizedSnapshot, dataStatus),
        network: assessNetwork(normalizedSnapshot, dataStatus)
    };

}

function getMissingSources(snapshot) {

    return [
        ["urlAnalysis", snapshot.urlAnalysis],
        ["pageAnalysis", snapshot.pageAnalysis],
        ["networkActivity", snapshot.networkActivity],
        ["runtimePrivacy", snapshot.runtimePrivacy],
        ["webSecurity", snapshot.webSecurity]
    ]
        .filter(function ([, value]) {
            return !value;
        })
        .map(function ([name]) {
            return name;
        });

}

function assessSecurity(snapshot, dataStatus) {

    const reasons = [];
    const positiveSignals = [];
    const url = snapshot.urlAnalysis;
    const page = snapshot.pageAnalysis;
    const web = snapshot.webSecurity;

    if (web && web.https && web.https.enabled) {
        addPositive(positiveSignals, "https-enabled", "HTTPS connection observed");
    }

    if (web && web.headers) {
        if (web.headers.hsts && web.headers.hsts.present) {
            addPositive(positiveSignals, "hsts-present", "HSTS header present");
        }

        if (web.headers.csp && web.headers.csp.present) {
            addPositive(positiveSignals, "csp-present", "CSP header present");
        }

        if (
            web.headers.contentTypeOptions &&
            web.headers.contentTypeOptions.status === "nosniff"
        ) {
            addPositive(
                positiveSignals,
                "content-type-nosniff",
                "X-Content-Type-Options nosniff present"
            );
        }

        if (
            web.headers.antiFraming &&
            web.headers.antiFraming.status !==
                "No explicit anti-framing policy detected"
        ) {
            addPositive(
                positiveSignals,
                "anti-framing-present",
                "Explicit anti-framing policy observed"
            );
        }
    }

    if (web && web.mixedContent && web.mixedContent.requestCount === 0) {
        addPositive(
            positiveSignals,
            "no-mixed-content-observed",
            "No mixed content observed"
        );
    }

    let strongCount = 0;
    let moderateCount = 0;
    let weakCount = 0;

    if (url && !url.usesHTTPS) {
        strongCount++;
        reasons.push(createReason(
            "main-page-http",
            "high",
            "Main page is not using HTTPS",
            {
                protocol: url.protocol
            }
        ));
    }

    if (web && web.mixedContent && web.mixedContent.requestCount > 0) {
        strongCount++;
        reasons.push(createReason(
            "mixed-content",
            "high",
            "Mixed content requests were observed",
            {
                requestCount: web.mixedContent.requestCount,
                types: web.mixedContent.types
            }
        ));
    }

    if (page && page.insecurePasswordForms > 0) {
        strongCount++;
        reasons.push(createReason(
            "insecure-password-forms",
            "high",
            "Password form submission over HTTP was observed",
            {
                formCount: page.insecurePasswordForms
            }
        ));
    }

    if (page && page.externalPasswordForms > 0) {
        moderateCount++;
        reasons.push(createReason(
            "external-password-forms",
            "medium",
            "Password form submission target is external",
            {
                formCount: page.externalPasswordForms
            }
        ));
    }

    if (web && web.headers && web.headers.csp) {
        const csp = web.headers.csp;

        if (csp.reportOnly) {
            weakCount++;
            reasons.push(createReason(
                "csp-report-only",
                "low",
                "CSP is present only in report-only mode",
                {}
            ));
        } else if (!csp.present) {
            weakCount++;
            reasons.push(createReason(
                "csp-missing",
                "low",
                "No enforced CSP header was observed",
                {}
            ));
        }

        if (csp.observations && csp.observations.length > 0) {
            moderateCount++;
            reasons.push(createReason(
                "csp-permissive-observations",
                "medium",
                "CSP contains potentially permissive directives",
                {
                    observations: csp.observations
                }
            ));
        }
    }

    if (web && web.headers && web.headers.hsts) {
        const hsts = web.headers.hsts;

        if (web.https && web.https.enabled && !hsts.present) {
            weakCount++;
            reasons.push(createReason(
                "hsts-missing",
                "low",
                "No HSTS header was observed on an HTTPS page",
                {}
            ));
        }

        if (hsts.observations && hsts.observations.length > 0) {
            weakCount++;
            reasons.push(createReason(
                "hsts-observations",
                "low",
                "HSTS configuration observations were found",
                {
                    observations: hsts.observations
                }
            ));
        }
    }

    if (
        web &&
        web.headers &&
        web.headers.contentTypeOptions &&
        web.headers.contentTypeOptions.status !== "nosniff"
    ) {
        weakCount++;
        reasons.push(createReason(
            "content-type-options-not-nosniff",
            "low",
            "X-Content-Type-Options nosniff was not observed",
            {
                status: web.headers.contentTypeOptions.status
            }
        ));
    }

    if (
        web &&
        web.headers &&
        web.headers.antiFraming &&
        web.headers.antiFraming.status ===
            "No explicit anti-framing policy detected"
    ) {
        const csp = web.headers.csp;
        const isMissingBecauseCspIsAbsent =
            csp &&
            !csp.present &&
            !csp.reportOnly &&
            !web.headers.antiFraming.xFrameOptions;

        if (!isMissingBecauseCspIsAbsent) {
            weakCount++;
        }

        reasons.push(createReason(
            "anti-framing-missing",
            isMissingBecauseCspIsAbsent ? "info" : "low",
            "No explicit anti-framing policy was observed",
            {
                countedForEscalation: !isMissingBecauseCspIsAbsent
            }
        ));
    }

    if (page && page.httpsPageHttpIframeCount > 0) {
        moderateCount++;
        reasons.push(createReason(
            "http-iframe-on-https-page",
            "medium",
            "HTTP iframe was observed on an HTTPS page",
            {
                iframeCount: page.httpsPageHttpIframeCount
            }
        ));
    }

    if (page && page.hiddenIframeCount > 0) {
        reasons.push(createReason(
            "hidden-iframes",
            "info",
            "Hidden iframes were observed",
            {
                iframeCount: page.hiddenIframeCount,
                countedForEscalation: false
            }
        ));
    }

    if (page && page.thirdPartyUnsandboxedIframeCount > 0) {
        reasons.push(createReason(
            "third-party-unsandboxed-iframes",
            "info",
            "Third-party iframes without sandbox were observed",
            {
                iframeCount: page.thirdPartyUnsandboxedIframeCount,
                countedForEscalation: false
            }
        ));
    }

    if (url) {
        const urlObservationIds = [];

        if (url.isLongURL) {
            urlObservationIds.push("long-url");
        }

        if (url.hasManySubdomains) {
            urlObservationIds.push("many-subdomains");
        }

        if (url.isIPAddress) {
            urlObservationIds.push("ip-hostname");
        }

        if (url.hasPunycode) {
            urlObservationIds.push("punycode-hostname");
        }

        if (url.hasAtSymbol) {
            urlObservationIds.push("at-symbol");
        }

        if (url.hasURLEncoding) {
            urlObservationIds.push("url-encoding");
        }

        if (urlObservationIds.length > 0) {
            weakCount++;
            reasons.push(createReason(
                "url-heuristics",
                "low",
                "URL heuristic observations were found",
                {
                    observations: urlObservationIds
                }
            ));
        }
    }

    if (dataStatus === "partial") {
        reasons.push(createReason(
            "security-data-incomplete",
            "info",
            "Some security inputs are unavailable or incomplete",
            {
                missing: {
                    urlAnalysis: !url,
                    pageAnalysis: !page,
                    webSecurity: !web
                }
            }
        ));
    }

    const level = determineSecurityLevel(
        strongCount,
        moderateCount,
        weakCount,
        dataStatus
    );

    return {
        level: level,
        summary: getSecuritySummary(level, dataStatus),
        reasons: sortReasons(reasons),
        positiveSignals: positiveSignals
    };

}

function determineSecurityLevel(strongCount, moderateCount, weakCount, dataStatus) {

    if (strongCount > 0) {
        return "attention";
    }

    if (
        moderateCount >= ASSESSMENT_THRESHOLDS.security.moderateSignalsForAttention
    ) {
        return "attention";
    }

    if (moderateCount > 0 || weakCount > 0 || dataStatus === "partial") {
        return "observations";
    }

    return "no-major-issues";

}

function getSecuritySummary(level, dataStatus) {

    if (dataStatus === "partial" && level === "no-major-issues") {
        return "Analysis incomplete";
    }

    const summaries = {
        "no-major-issues": "No major security issues observed",
        observations: "Security observations detected",
        attention: "Security attention suggested"
    };

    return summaries[level];

}

function assessPrivacy(snapshot, dataStatus) {

    const network = snapshot.networkActivity;
    const runtime = snapshot.runtimePrivacy;
    const reasons = [];
    let trackerActivity = "none";
    let runtimeActivity = "none";

    if (network) {
        const trackerDomains = network.trackerDomainCount || 0;
        const trackerRequests = network.trackerRequests || 0;

        if (
            trackerDomains >= ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerDomains ||
            (
                trackerRequests >=
                    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequests &&
                trackerDomains >=
                    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequestMinimumDomains
            )
        ) {
            trackerActivity = "elevated";
        } else if (
            trackerDomains >= ASSESSMENT_THRESHOLDS.privacy.moderateTrackerDomains ||
            trackerRequests >= ASSESSMENT_THRESHOLDS.privacy.moderateTrackerRequests
        ) {
            trackerActivity = "moderate";
        } else if (trackerDomains > 0 || trackerRequests > 0) {
            trackerActivity = "limited";
        }

        if (trackerActivity !== "none") {
            reasons.push(createReason(
                "known-trackers",
                trackerActivity === "elevated" ? "high" :
                    trackerActivity === "moderate" ? "medium" : "low",
                "Known tracker activity was observed",
                {
                    trackerDomainCount: trackerDomains,
                    trackerRequests: trackerRequests,
                    categories: getTrackerCategories(network.trackerDomains)
                }
            ));
        }
    }

    if (runtime) {
        const detectedCategories = getDetectedRuntimeCategories(runtime);
        const webglHardware = hasRuntimeDetail(
            runtime,
            "webgl",
            "UNMASKED_RENDERER_WEBGL"
        ) || hasRuntimeDetail(runtime, "webgl", "UNMASKED_VENDOR_WEBGL");
        const hasCombinedRuntimeIndicators =
            webglHardware &&
            (
                detectedCategories.includes("canvas") ||
                detectedCategories.includes("navigator")
            );

        if (
            detectedCategories.length >=
                ASSESSMENT_THRESHOLDS.privacy.multipleRuntimeCategories ||
            hasCombinedRuntimeIndicators
        ) {
            runtimeActivity = "multiple";
            reasons.push(createReason(
                "multiple-runtime-privacy-indicators",
                "medium",
                hasCombinedRuntimeIndicators ?
                    "Combined fingerprinting-related indicators were observed" :
                    "Multiple fingerprinting-related indicators were observed",
                {
                    categories: detectedCategories,
                    webglHardware: webglHardware,
                    combinedRuntimeIndicators: hasCombinedRuntimeIndicators
                }
            ));
        } else if (detectedCategories.length > 0) {
            runtimeActivity = "limited";
            reasons.push(createReason(
                "runtime-privacy-api-usage",
                "low",
                "Privacy-sensitive API usage was observed",
                {
                    categories: detectedCategories,
                    webglHardware: webglHardware,
                    combinedRuntimeIndicators: false
                }
            ));
        }
    }

    if (!network || !runtime) {
        reasons.push(createReason(
            "privacy-data-incomplete",
            "info",
            "Some privacy inputs are unavailable or incomplete",
            {
                missing: {
                    networkActivity: !network,
                    runtimePrivacy: !runtime
                }
            }
        ));
    }

    const level = determinePrivacyLevel(trackerActivity, runtimeActivity, dataStatus);

    return {
        level: level,
        summary: getPrivacySummary(level, dataStatus),
        reasons: sortReasons(reasons),
        positiveSignals: []
    };

}

function determinePrivacyLevel(trackerActivity, runtimeActivity, dataStatus) {

    if (
        trackerActivity === "elevated" ||
        (trackerActivity === "moderate" && runtimeActivity === "multiple")
    ) {
        return "elevated-activity";
    }

    if (
        trackerActivity === "moderate" ||
        runtimeActivity === "multiple" ||
        (trackerActivity === "limited" && runtimeActivity === "limited")
    ) {
        return "moderate-activity";
    }

    if (
        trackerActivity === "limited" ||
        runtimeActivity === "limited" ||
        dataStatus === "partial"
    ) {
        return "low-activity";
    }

    return "low-activity";

}

function getPrivacySummary(level, dataStatus) {

    if (dataStatus === "partial" && level === "low-activity") {
        return "Analysis incomplete";
    }

    const summaries = {
        "low-activity": "Low privacy-related activity observed",
        "moderate-activity": "Moderate privacy-related activity observed",
        "elevated-activity": "Elevated privacy-related activity observed"
    };

    return summaries[level];

}

function assessNetwork(snapshot, dataStatus) {

    const network = snapshot.networkActivity;
    const reasons = [];

    if (!network || network.totalRequests === 0) {
        if (dataStatus === "partial" || !network) {
            reasons.push(createReason(
                "network-data-unavailable",
                "info",
                "Network activity data is unavailable or incomplete",
                {}
            ));
        }

        return {
            level: "low-third-party-activity",
            summary: dataStatus === "partial" ?
                "Analysis incomplete" :
                "No third-party network activity observed",
            reasons: reasons,
            positiveSignals: []
        };
    }

    const totalRequests = network.totalRequests || 0;
    const thirdPartyRequests = network.thirdPartyRequests || 0;
    const thirdPartyDomainCount = network.thirdPartyDomainCount || 0;
    const thirdPartyRatio = totalRequests > 0 ?
        thirdPartyRequests / totalRequests :
        0;

    let level = "low-third-party-activity";

    const highRatioWithVolume =
        thirdPartyRatio >= ASSESSMENT_THRESHOLDS.network.highThirdPartyRatio &&
        thirdPartyRequests >=
            ASSESSMENT_THRESHOLDS.network.highThirdPartyRatioMinimumRequests;
    const highDomainDiversityWithVolume =
        thirdPartyDomainCount >=
            ASSESSMENT_THRESHOLDS.network.highThirdPartyDomains &&
        (
            thirdPartyRequests >=
                ASSESSMENT_THRESHOLDS.network.highThirdPartyDomainsMinimumRequests ||
            totalRequests >=
                ASSESSMENT_THRESHOLDS.network.highThirdPartyDomainsMinimumTotalRequests
        );

    if (
        highRatioWithVolume ||
        highDomainDiversityWithVolume ||
        (
            thirdPartyRequests >=
                ASSESSMENT_THRESHOLDS.network.highThirdPartyRequests &&
            thirdPartyRatio >= ASSESSMENT_THRESHOLDS.network.moderateThirdPartyRatio
        )
    ) {
        level = "high-third-party-activity";
    } else if (
        thirdPartyRatio >= ASSESSMENT_THRESHOLDS.network.moderateThirdPartyRatio ||
        thirdPartyDomainCount >=
            ASSESSMENT_THRESHOLDS.network.moderateThirdPartyDomains ||
        thirdPartyRequests >=
            ASSESSMENT_THRESHOLDS.network.moderateThirdPartyRequests
    ) {
        level = "moderate-third-party-activity";
    }

    if (thirdPartyRequests > 0 || thirdPartyDomainCount > 0) {
        reasons.push(createReason(
            "third-party-network-activity",
            level === "high-third-party-activity" ? "high" :
                level === "moderate-third-party-activity" ? "medium" : "low",
            "Third-party network activity was observed",
            {
                totalRequests: totalRequests,
                thirdPartyRequests: thirdPartyRequests,
                thirdPartyDomainCount: thirdPartyDomainCount,
                thirdPartyRatio: Number(thirdPartyRatio.toFixed(3))
            }
        ));
    }

    return {
        level: level,
        summary: getNetworkSummary(level),
        reasons: sortReasons(reasons),
        positiveSignals: []
    };

}

function getNetworkSummary(level) {

    const summaries = {
        "low-third-party-activity": "Low third-party network activity",
        "moderate-third-party-activity": "Moderate third-party network activity",
        "high-third-party-activity": "High third-party network activity"
    };

    return summaries[level];

}

function getDetectedRuntimeCategories(runtime) {

    return Object.entries(runtime.categories || {})
        .filter(function ([, category]) {
            return category && category.detected;
        })
        .map(function ([name]) {
            return name;
        })
        .sort();

}

function hasRuntimeDetail(runtime, categoryName, detailName) {

    const category = runtime.categories && runtime.categories[categoryName];

    if (!category || !Array.isArray(category.details)) {
        return false;
    }

    return category.details.some(function (detail) {
        return detail.includes(detailName);
    });

}

function getTrackerCategories(trackers) {

    return Array.from(new Set((trackers || []).map(function (tracker) {
        return tracker.category;
    }).filter(Boolean))).sort();

}

function addPositive(positiveSignals, id, message) {

    positiveSignals.push({
        id: id,
        message: message
    });

}

function createReason(id, severity, message, evidence) {

    return {
        id: id,
        severity: severity,
        message: message,
        evidence: evidence || {}
    };

}

function sortReasons(reasons) {

    const severityOrder = {
        high: 0,
        medium: 1,
        low: 2,
        info: 3
    };

    return reasons.slice().sort(function (left, right) {
        return severityOrder[left.severity] - severityOrder[right.severity] ||
            left.id.localeCompare(right.id);
    });

}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        ASSESSMENT_THRESHOLDS: ASSESSMENT_THRESHOLDS,
        assessBrowserState: assessBrowserState
    };
} else {
    globalThis.BrowserGuardAssessmentEngine = {
        ASSESSMENT_THRESHOLDS: ASSESSMENT_THRESHOLDS,
        assessBrowserState: assessBrowserState
    };
}
