/**
 * BrowserGuard Assessment Engine
 *
 * Converts collected technical signals into deterministic, explainable,
 * user-facing assessments. This module has no UI or Chrome API dependencies.
 */

const ASSESSMENT_THRESHOLDS = {
    security: {
        mismatchedLinkMinimumCount: 3,
        mismatchedLinkMinimumRatio: 0.25
    },
    privacy: {
        moderateTrackerDomains: 2,
        elevatedTrackerDomains: 5,
        moderateTrackerRequests: 10,
        elevatedTrackerRequests: 30,
        elevatedTrackerRequestMinimumDomains: 2,
        correlatedRuntimeSurfaces: 2
    },
    network: {
        moderateThirdPartyRatio: 0.25,
        moderateRatioMinimumRequests: 5,
        moderateVolumeMinimumRatio: 0.1,
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
    const availableSnapshot = getAvailableSnapshot(normalizedSnapshot);

    const securityPartial = missingSources.some(function (source) {
        return ["urlAnalysis", "pageAnalysis", "webSecurity"].includes(source);
    });
    const privacyPartial = !availableSnapshot.networkActivity || !availableSnapshot.runtimePrivacy;

    return {
        dataStatus: dataStatus,
        missingSources: missingSources,
        security: finalizeAssessment(assessSecurity(
            availableSnapshot, securityPartial ? "partial" : "complete"
        )),
        privacy: finalizeAssessment(assessPrivacy(
            availableSnapshot, privacyPartial ? "partial" : "complete"
        )),
        network: finalizeAssessment(assessNetwork(
            availableSnapshot, !availableSnapshot.networkActivity ? "partial" : "complete"
        ))
    };

}

function getAvailableSnapshot(snapshot) {

    return {
        urlAnalysis: isSourceAvailable(snapshot.urlAnalysis) ?
            snapshot.urlAnalysis :
            null,
        pageAnalysis: isSourceAvailable(snapshot.pageAnalysis) ?
            snapshot.pageAnalysis :
            null,
        networkActivity: isSourceAvailable(snapshot.networkActivity) ?
            snapshot.networkActivity :
            null,
        runtimePrivacy: isSourceAvailable(snapshot.runtimePrivacy) ?
            snapshot.runtimePrivacy :
            null,
        webSecurity: isSourceAvailable(snapshot.webSecurity) ?
            snapshot.webSecurity :
            null
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
            return !isSourceAvailable(value);
        })
        .map(function ([name]) {
            return name;
        });

}

function isSourceAvailable(value) {

    if (!value) {
        return false;
    }

    return value.available !== false;

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
            (web.headers.antiFraming.observed === true ||
                web.headers.antiFraming.status === "X-Frame-Options" ||
                (web.headers.antiFraming.status === "CSP frame-ancestors" && web.headers.csp && web.headers.csp.present))
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

    if ((url && url.usesHTTPS === false) || (web && typeof web.pageUrl === "string" && web.pageUrl.startsWith("http:"))) {
        strongCount++;
        reasons.push(createReason(
            "main-page-http",
            "high",
            "Main page is not using HTTPS",
            {
                protocol: url ? url.protocol : "http"
            }
        ));
    }

    if (web && web.mixedContent && web.mixedContent.requestCount > 0) {
        // onBeforeRequest observes attempts, not successful loads or execution.
        const activeTypes = ["script", "stylesheet", "sub_frame", "xmlhttprequest", "object", "websocket"];
        const active = activeTypes.some(type => (web.mixedContent.types || {})[type] > 0);
        if (active) strongCount++; else moderateCount++;
        reasons.push(createReason(
            "mixed-content",
            active ? "high" : "medium",
            active ? "Active mixed content request attempts were observed" : "Mixed content request attempts were observed",
            {
                requestCount: web.mixedContent.requestCount,
                types: web.mixedContent.types,
                activeResourceTypes: active,
                successfulLoadConfirmed: false
            }
        ));
    }

    if (page && page.insecurePasswordForms > 0) {
        strongCount++;
        reasons.push(createReason(
            "insecure-password-forms",
            "high",
            "A password form targeting HTTP was observed",
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
            reasons.push(createReason(
                "csp-report-only",
                "info",
                "CSP is present only in report-only mode",
                {}
            ));
        } else if (!csp.present) {
            reasons.push(createReason(
                "csp-missing",
                "info",
                "No enforced CSP header was observed",
                {}
            ));
        }

        if (csp.observations && csp.observations.length > 0) {
            reasons.push(createReason(
                "csp-permissive-observations",
                "info",
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
            reasons.push(createReason(
                "hsts-missing",
                "info",
                "No HSTS header was observed on an HTTPS page",
                {}
            ));
        }

        if (hsts.observations && hsts.observations.length > 0) {
            reasons.push(createReason(
                "hsts-observations",
                "info",
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
        reasons.push(createReason(
            "content-type-options-not-nosniff",
            "info",
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
        reasons.push(createReason(
            "anti-framing-missing", "info",
            "No explicit anti-framing policy was observed", {}
        ));
    }

    for (const [key, id, label] of [
        ["referrerPolicy", "referrer-policy-missing", "Referrer-Policy"],
        ["permissionsPolicy", "permissions-policy-missing", "Permissions-Policy"]
    ]) {
        if (web && web.headers && web.headers[key] && !web.headers[key].present) {
            reasons.push(createReason(id, "info", "No explicit " + label + " header was observed", {}));
        }
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

    if (page && page.mismatchedLinks > 0) {
        const totalLinks = page.totalLinks || 0;
        const mismatchedLinkRatio = totalLinks > 0 ?
            page.mismatchedLinks / totalLinks :
            0;
        const suspiciousMismatchedLinks =
            page.suspiciousMismatchedLinks || 0;
        const shouldReportMismatchedLinks =
            suspiciousMismatchedLinks > 0 ||
            page.mismatchedLinks >=
                ASSESSMENT_THRESHOLDS.security.mismatchedLinkMinimumCount ||
            mismatchedLinkRatio >=
                ASSESSMENT_THRESHOLDS.security.mismatchedLinkMinimumRatio;

        if (shouldReportMismatchedLinks) {
            const severity = suspiciousMismatchedLinks > 0 ? "medium" : "info";
            if (severity === "medium") moderateCount++;

            reasons.push(createReason(
                "mismatched-link-destinations",
                severity,
                "Visible link text pointed to a different destination host",
                {
                    mismatchedLinks: page.mismatchedLinks,
                    suspiciousMismatchedLinks: suspiciousMismatchedLinks,
                    totalLinks: totalLinks,
                    mismatchedLinkRatio:
                        Number(mismatchedLinkRatio.toFixed(3)),
                    countedForEscalation: severity === "medium"
                }
            ));
        }
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
            reasons.push(createReason(
                "url-heuristics",
                "info",
                "URL heuristic observations were found",
                {
                    observations: urlObservationIds
                }
            ));
        }
    }

    if (page && page.passwordFieldCount === 0) {
        addPositive(positiveSignals, "no-password-fields", "No password fields observed");
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
        moderateCount
    );

    return {
        level: level,
        summary: getSecuritySummary(level, dataStatus),
        reasons: sortReasons(reasons),
        positiveSignals: positiveSignals
    };

}

function determineSecurityLevel(strongCount, moderateCount) {
    if (strongCount > 0) return "attention";
    if (moderateCount > 0) return "observations";
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
                    trackerActivity === "moderate" ? "medium" : "info",
                "Activity from tracking-associated domains was observed",
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
        const webglHardware = hasRuntimeDetail(runtime, "webgl", "UNMASKED_RENDERER_WEBGL") ||
            hasRuntimeDetail(runtime, "webgl", "UNMASKED_VENDOR_WEBGL");
        const canvasReadback = ["toDataURL", "toBlob", "getImageData"].some(api => hasRuntimeDetail(runtime, "canvas", api));
        const offlineAudio = hasRuntimeDetail(runtime, "audio", "OfflineAudioContext");
        const sensitiveSurfaces = [canvasReadback && "canvas-readback", webglHardware && "webgl-hardware", offlineAudio && "offline-audio"].filter(Boolean);
        const combined = sensitiveSurfaces.length >= ASSESSMENT_THRESHOLDS.privacy.correlatedRuntimeSurfaces;
        if (detectedCategories.length > 0) {
            runtimeActivity = combined ? "multiple" : "informational";
            reasons.push(createReason(
                combined ? "multiple-runtime-privacy-indicators" : "runtime-privacy-api-usage",
                combined ? "medium" : "info",
                combined ? "Co-occurring fingerprinting-related API surfaces were observed; purpose is unknown" : "Browser API access was observed; purpose is unknown",
                { categories: detectedCategories, sensitiveSurfaces, webglHardware,
                    combinedRuntimeIndicators: combined, sameScriptAttributionConfirmed: false }
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
        runtimeActivity === "multiple"
    ) {
        return "moderate-activity";
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
                "External network exposure data is unavailable or incomplete",
                {}
            ));
        }

        return {
            level: "low-third-party-activity",
            summary: dataStatus === "partial" ?
                "Analysis incomplete" :
                "No external third-party exposure observed",
            reasons: reasons,
            positiveSignals: []
        };
    }

    const totalRequests = network.totalRequests || 0;
    const thirdPartyRequests = network.externalThirdPartyRequests || 0;
    const thirdPartyDomainCount = network.externalThirdPartyDomainCount || 0;
    const unknownRequests = typeof network.unknownThirdPartyRequests === "number" ? network.unknownThirdPartyRequests :
        Math.max(0, (network.thirdPartyRequests || 0) - (network.sameEntityThirdPartyRequests || 0) - thirdPartyRequests);
    if (unknownRequests > 0) {
        reasons.push(createReason("unknown-network-attribution", "info",
            "Cross-origin requests have unresolved entity attribution", {
                unknownThirdPartyRequests: unknownRequests,
                unknownThirdPartyDomainCount: network.unknownThirdPartyDomainCount ?? network.thirdPartyDomainCount ?? 0,
                confirmedExternal: false
            }));
    }
    const thirdPartyRatio = totalRequests > 0 ?
        thirdPartyRequests / totalRequests :
        0;
    const rawThirdPartyRatio = totalRequests > 0 ?
        (network.thirdPartyRequests || 0) / totalRequests :
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
        (thirdPartyRatio >= ASSESSMENT_THRESHOLDS.network.moderateThirdPartyRatio &&
            thirdPartyRequests >= ASSESSMENT_THRESHOLDS.network.moderateRatioMinimumRequests) ||
        (thirdPartyDomainCount >= ASSESSMENT_THRESHOLDS.network.moderateThirdPartyDomains &&
            thirdPartyRequests >= ASSESSMENT_THRESHOLDS.network.moderateRatioMinimumRequests) ||
        (thirdPartyRequests >= ASSESSMENT_THRESHOLDS.network.moderateThirdPartyRequests &&
            thirdPartyRatio >= ASSESSMENT_THRESHOLDS.network.moderateVolumeMinimumRatio)
    ) {
        level = "moderate-third-party-activity";
    }

    if ((network.thirdPartyRequests || 0) > 0 || thirdPartyRequests > 0 || thirdPartyDomainCount > 0) {
        reasons.push(createReason(
            "third-party-network-activity",
            level === "high-third-party-activity" ? "high" :
                level === "moderate-third-party-activity" ? "medium" : "info",
            "Network request composition was observed; only confirmed external attribution contributes to the level",
            {
                totalRequests: totalRequests,
                thirdPartyRequests: network.thirdPartyRequests || 0,
                thirdPartyDomainCount: network.thirdPartyDomainCount || 0,
                assessmentThirdPartyRequests: thirdPartyRequests,
                assessmentThirdPartyDomainCount: thirdPartyDomainCount,
                sameEntityThirdPartyRequests:
                    network.sameEntityThirdPartyRequests || 0,
                externalThirdPartyRequests:
                    network.externalThirdPartyRequests || 0,
                unknownThirdPartyRequests: unknownRequests,
                thirdPartyRatio: Number(rawThirdPartyRatio.toFixed(3)),
                assessmentThirdPartyRatio: Number(thirdPartyRatio.toFixed(3))
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
        "low-third-party-activity": "Low external third-party exposure",
        "moderate-third-party-activity": "Moderate external third-party exposure",
        "high-third-party-activity": "High external third-party exposure"
    };

    return summaries[level];

}

function finalizeAssessment(result) {
    result.contributingFindings = result.reasons.filter(reason => ["high", "medium"].includes(reason.severity));
    result.informationalObservations = result.reasons.filter(reason => !["high", "medium"].includes(reason.severity));
    result.uncertainties = result.reasons.filter(reason => /data-(incomplete|unavailable)$/.test(reason.id) || reason.id === "unknown-network-attribution" ||
        reason.evidence.successfulLoadConfirmed === false || reason.evidence.sameScriptAttributionConfirmed === false);
    result.reasons.forEach(reason => {
        reason.evidence.countedForEscalation = result.contributingFindings.includes(reason);
    });
    return result;
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
        return typeof detail === "string" && detail.includes(detailName);
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
