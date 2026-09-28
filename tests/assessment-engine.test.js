const assert = require("assert");

const {
    ASSESSMENT_THRESHOLDS,
    assessBrowserState
} = require("../modules/assessment/assessment-engine");

function completeCleanSnapshot() {
    return {
        urlAnalysis: {
            protocol: "https",
            hostname: "example.test",
            urlLength: 26,
            subdomainCount: 0,
            isIPAddress: false,
            hasPunycode: false,
            usesHTTPS: true,
            isLongURL: false,
            hasManySubdomains: false,
            hasAtSymbol: false,
            hasURLEncoding: false
        },
        pageAnalysis: {
            externalForms: 0,
            externalPasswordForms: 0,
            insecurePasswordForms: 0,
            hiddenIframeCount: 0,
            thirdPartyUnsandboxedIframeCount: 0,
            httpsPageHttpIframeCount: 0
        },
        networkActivity: {
            totalRequests: 10,
            thirdPartyRequests: 0,
            thirdPartyDomainCount: 0,
            trackerRequests: 0,
            trackerDomainCount: 0,
            trackerDomains: []
        },
        runtimePrivacy: {
            categories: {
                canvas: emptyRuntimeCategory(),
                webgl: emptyRuntimeCategory(),
                audio: emptyRuntimeCategory(),
                navigator: emptyRuntimeCategory(),
                screen: emptyRuntimeCategory()
            }
        },
        webSecurity: {
            https: {
                enabled: true
            },
            headers: {
                csp: {
                    present: true,
                    reportOnly: false,
                    status: "Present",
                    observations: [],
                    frameAncestors: "'self'"
                },
                hsts: {
                    present: true,
                    status: "Present",
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: false,
                    observations: []
                },
                contentTypeOptions: {
                    present: true,
                    status: "nosniff",
                    value: "nosniff"
                },
                referrerPolicy: {
                    present: true,
                    status: "strict-origin",
                    value: "strict-origin"
                },
                permissionsPolicy: {
                    present: true,
                    status: "Present",
                    features: [
                        "geolocation"
                    ]
                },
                antiFraming: {
                    cspFrameAncestors: "'self'",
                    xFrameOptions: "",
                    status: "CSP frame-ancestors"
                }
            },
            mixedContent: {
                requestCount: 0,
                types: {}
            }
        }
    };
}

function emptyRuntimeCategory() {
    return {
        detected: false,
        eventCount: 0,
        apis: [],
        details: []
    };
}

function detectedRuntimeCategory(details) {
    return {
        detected: true,
        eventCount: details.length,
        apis: details.map(function (detail) {
            return detail.split(":")[0];
        }),
        details: details
    };
}

function assertEscalationsHaveReasons(assessment) {
    [
        assessment.security,
        assessment.privacy,
        assessment.network
    ].forEach(function (dimension) {
        const isEscalated = ![
            "no-major-issues",
            "low-activity",
            "low-third-party-activity"
        ].includes(dimension.level);

        if (isEscalated) {
            assert.ok(
                dimension.reasons.length > 0,
                dimension.level + " must include reasons"
            );
        }
    });
}

let snapshot = completeCleanSnapshot();
let assessment = assessBrowserState(snapshot);

assert.strictEqual(assessment.dataStatus, "complete");
assert.strictEqual(assessment.security.level, "no-major-issues");
assert.strictEqual(assessment.privacy.level, "low-activity");
assert.strictEqual(assessment.network.level, "low-third-party-activity");
assert.ok(assessment.security.positiveSignals.length >= 4);

snapshot = completeCleanSnapshot();
snapshot.webSecurity.headers.csp.present = false;
snapshot.webSecurity.headers.csp.status = "Missing";
snapshot.webSecurity.headers.hsts.present = false;
snapshot.webSecurity.headers.hsts.status = "Missing";
snapshot.webSecurity.headers.antiFraming.status =
    "No explicit anti-framing policy detected";
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "observations");
assert.strictEqual(
    assessment.security.reasons.find(function (reason) {
        return reason.id === "anti-framing-missing";
    }).severity,
    "info"
);

snapshot = completeCleanSnapshot();
snapshot.urlAnalysis.usesHTTPS = false;
snapshot.urlAnalysis.protocol = "http";
snapshot.webSecurity.https.enabled = false;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "attention");
assert.ok(assessment.security.reasons.some(function (reason) {
    return reason.id === "main-page-http";
}));

snapshot = completeCleanSnapshot();
snapshot.webSecurity.mixedContent.requestCount = 2;
snapshot.webSecurity.mixedContent.types = {
    script: 1,
    image: 1
};
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "attention");

snapshot = completeCleanSnapshot();
snapshot.pageAnalysis.insecurePasswordForms = 1;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "attention");

snapshot = completeCleanSnapshot();
snapshot.urlAnalysis.isLongURL = true;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "observations");

snapshot = completeCleanSnapshot();
snapshot.urlAnalysis.isLongURL = true;
snapshot.urlAnalysis.hasManySubdomains = true;
snapshot.webSecurity.headers.csp.present = false;
snapshot.webSecurity.headers.csp.status = "Missing";
snapshot.webSecurity.headers.hsts.present = false;
snapshot.webSecurity.headers.hsts.status = "Missing";
snapshot.webSecurity.headers.antiFraming.status =
    "No explicit anti-framing policy detected";
snapshot.webSecurity.headers.contentTypeOptions.status = "missing";
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "observations");

snapshot = completeCleanSnapshot();
snapshot.webSecurity.headers.csp.present = false;
snapshot.webSecurity.headers.csp.status = "Missing";
snapshot.webSecurity.headers.hsts.present = false;
snapshot.webSecurity.headers.hsts.status = "Missing";
snapshot.webSecurity.headers.contentTypeOptions.status = "missing";
snapshot.webSecurity.headers.antiFraming.status = "No independent policy";
snapshot.urlAnalysis.isLongURL = true;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "observations");

snapshot = completeCleanSnapshot();
snapshot.pageAnalysis.hiddenIframeCount = 1;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "no-major-issues");
assert.strictEqual(
    assessment.security.reasons.find(function (reason) {
        return reason.id === "hidden-iframes";
    }).severity,
    "info"
);

snapshot = completeCleanSnapshot();
snapshot.pageAnalysis.thirdPartyUnsandboxedIframeCount = 1;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "no-major-issues");
assert.strictEqual(
    assessment.security.reasons.find(function (reason) {
        return reason.id === "third-party-unsandboxed-iframes";
    }).severity,
    "info"
);

snapshot = completeCleanSnapshot();
snapshot.pageAnalysis.hiddenIframeCount = 3;
snapshot.pageAnalysis.thirdPartyUnsandboxedIframeCount = 2;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "no-major-issues");
assert.deepStrictEqual(
    assessment.security.reasons.map(function (reason) {
        return reason.severity;
    }),
    ["info", "info"]
);

snapshot = completeCleanSnapshot();
snapshot.pageAnalysis.externalPasswordForms = 1;
snapshot.pageAnalysis.httpsPageHttpIframeCount = 1;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "attention");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.trackerDomainCount = 1;
snapshot.networkActivity.trackerRequests = 2;
snapshot.networkActivity.trackerDomains = [
    {
        category: "Analytics"
    }
];
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "low-activity");
assert.ok(assessment.privacy.reasons.some(function (reason) {
    return reason.id === "known-trackers";
}));

snapshot = completeCleanSnapshot();
snapshot.networkActivity.trackerDomainCount =
    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerDomains;
snapshot.networkActivity.trackerRequests =
    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequests;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "elevated-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.trackerDomainCount = 1;
snapshot.networkActivity.trackerRequests =
    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequests;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "moderate-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.trackerDomainCount =
    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequestMinimumDomains;
snapshot.networkActivity.trackerRequests =
    ASSESSMENT_THRESHOLDS.privacy.elevatedTrackerRequests;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "elevated-activity");

snapshot = completeCleanSnapshot();
snapshot.runtimePrivacy.categories.canvas = detectedRuntimeCategory([
    "toDataURL:"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "low-activity");

snapshot = completeCleanSnapshot();
snapshot.runtimePrivacy.categories.webgl = detectedRuntimeCategory([
    "getParameter:UNMASKED_RENDERER_WEBGL"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "low-activity");

snapshot = completeCleanSnapshot();
snapshot.runtimePrivacy.categories.canvas = detectedRuntimeCategory([
    "toDataURL:"
]);
snapshot.runtimePrivacy.categories.webgl = detectedRuntimeCategory([
    "getParameter:UNMASKED_RENDERER_WEBGL"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "moderate-activity");
assert.ok(assessment.privacy.reasons.some(function (reason) {
    return reason.id === "multiple-runtime-privacy-indicators" &&
        reason.evidence.combinedRuntimeIndicators;
}));

snapshot = completeCleanSnapshot();
snapshot.runtimePrivacy.categories.screen = detectedRuntimeCategory([
    "width:"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "low-activity");

snapshot = completeCleanSnapshot();
snapshot.runtimePrivacy.categories.canvas = detectedRuntimeCategory([
    "toDataURL:"
]);
snapshot.runtimePrivacy.categories.webgl = detectedRuntimeCategory([
    "getParameter:UNMASKED_RENDERER_WEBGL"
]);
snapshot.runtimePrivacy.categories.navigator = detectedRuntimeCategory([
    "hardwareConcurrency:"
]);
snapshot.runtimePrivacy.categories.screen = detectedRuntimeCategory([
    "width:"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "moderate-activity");

snapshot.networkActivity.trackerDomainCount = 2;
snapshot.networkActivity.trackerRequests = 12;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.privacy.level, "elevated-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 100;
snapshot.networkActivity.thirdPartyRequests = 10;
snapshot.networkActivity.thirdPartyDomainCount = 2;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "low-third-party-activity");

snapshot.networkActivity.thirdPartyRequests = 30;
snapshot.networkActivity.thirdPartyDomainCount = 5;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "moderate-third-party-activity");

snapshot.networkActivity.thirdPartyRequests = 60;
snapshot.networkActivity.thirdPartyDomainCount = 16;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "high-third-party-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 6;
snapshot.networkActivity.thirdPartyRequests = 3;
snapshot.networkActivity.thirdPartyDomainCount = 6;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "moderate-third-party-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 5;
snapshot.networkActivity.thirdPartyRequests = 4;
snapshot.networkActivity.thirdPartyDomainCount = 4;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "moderate-third-party-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 1000;
snapshot.networkActivity.thirdPartyRequests = 100;
snapshot.networkActivity.thirdPartyDomainCount = 3;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "moderate-third-party-activity");

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 34;
snapshot.networkActivity.firstPartyRequests = 14;
snapshot.networkActivity.thirdPartyRequests = 20;
snapshot.networkActivity.thirdPartyDomainCount = 4;
snapshot.networkActivity.sameEntityThirdPartyRequests = 18;
snapshot.networkActivity.externalThirdPartyRequests = 2;
snapshot.networkActivity.unknownThirdPartyRequests = 0;
snapshot.networkActivity.sameEntityThirdPartyDomainCount = 2;
snapshot.networkActivity.externalThirdPartyDomainCount = 2;
snapshot.networkActivity.unknownThirdPartyDomainCount = 0;
snapshot.networkActivity.assessmentThirdPartyRequests = 2;
snapshot.networkActivity.assessmentThirdPartyDomainCount = 2;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "low-third-party-activity");
assert.ok(assessment.network.reasons.some(function (reason) {
    return reason.evidence.thirdPartyRequests === 20 &&
        reason.evidence.assessmentThirdPartyRequests === 2;
}));

snapshot = completeCleanSnapshot();
snapshot.networkActivity.totalRequests = 0;
snapshot.networkActivity.thirdPartyRequests = 0;
snapshot.networkActivity.thirdPartyDomainCount = 0;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.network.level, "low-third-party-activity");

snapshot = completeCleanSnapshot();
snapshot.urlAnalysis.hostname = "www.ilpost.it";
snapshot.urlAnalysis.urlLength = 22;
snapshot.urlAnalysis.subdomainCount = 1;
snapshot.pageAnalysis.formCount = 1;
snapshot.pageAnalysis.totalLinks = 164;
snapshot.pageAnalysis.externalLinks = 6;
snapshot.pageAnalysis.mismatchedLinks = 1;
snapshot.pageAnalysis.iframeCount = 19;
snapshot.pageAnalysis.hiddenIframeCount = 19;
snapshot.pageAnalysis.externalScriptCount = 52;
snapshot.pageAnalysis.thirdPartyIframeCount = 14;
snapshot.pageAnalysis.sandboxedIframeCount = 11;
snapshot.pageAnalysis.thirdPartyUnsandboxedIframeCount = 4;
snapshot.webSecurity.headers.csp.present = false;
snapshot.webSecurity.headers.csp.status = "Missing";
snapshot.webSecurity.headers.hsts.present = false;
snapshot.webSecurity.headers.hsts.status = "Missing";
snapshot.webSecurity.headers.contentTypeOptions.present = false;
snapshot.webSecurity.headers.contentTypeOptions.status = "missing";
snapshot.webSecurity.headers.referrerPolicy.present = false;
snapshot.webSecurity.headers.referrerPolicy.status = "Not explicitly set";
snapshot.webSecurity.headers.permissionsPolicy.present = false;
snapshot.webSecurity.headers.permissionsPolicy.status = "Not explicitly set";
snapshot.webSecurity.headers.antiFraming.cspFrameAncestors = null;
snapshot.webSecurity.headers.antiFraming.xFrameOptions = "";
snapshot.webSecurity.headers.antiFraming.status =
    "No explicit anti-framing policy detected";
snapshot.networkActivity.totalRequests = 272;
snapshot.networkActivity.firstPartyRequests = 40;
snapshot.networkActivity.thirdPartyRequests = 232;
snapshot.networkActivity.thirdPartyDomainCount = 93;
snapshot.networkActivity.trackerDomainCount = 7;
snapshot.networkActivity.trackerRequests = 40;
snapshot.networkActivity.trackerDomains = [
    {
        category: "Advertising"
    },
    {
        category: "Analytics"
    },
    {
        category: "Social"
    }
];
snapshot.runtimePrivacy.categories.webgl = detectedRuntimeCategory([
    "getExtension:WEBGL_debug_renderer_info",
    "getParameter:UNMASKED_RENDERER_WEBGL"
]);
snapshot.runtimePrivacy.categories.navigator = detectedRuntimeCategory([
    "deviceMemory:",
    "hardwareConcurrency:",
    "languages:",
    "maxTouchPoints:",
    "platform:",
    "userAgent:"
]);
snapshot.runtimePrivacy.categories.screen = detectedRuntimeCategory([
    "availHeight:",
    "availWidth:",
    "colorDepth:",
    "height:",
    "width:"
]);
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.security.level, "observations");
assert.strictEqual(assessment.privacy.level, "elevated-activity");
assert.strictEqual(assessment.network.level, "high-third-party-activity");
assert.deepStrictEqual(
    assessment.security.reasons.map(function (reason) {
        return reason.id + ":" + reason.severity;
    }),
    [
        "content-type-options-not-nosniff:low",
        "csp-missing:low",
        "hsts-missing:low",
        "anti-framing-missing:info",
        "hidden-iframes:info",
        "third-party-unsandboxed-iframes:info"
    ]
);

snapshot = completeCleanSnapshot();
delete snapshot.runtimePrivacy;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.dataStatus, "partial");
assert.deepStrictEqual(assessment.missingSources, ["runtimePrivacy"]);
assert.strictEqual(assessment.privacy.summary, "Analysis incomplete");
assert.ok(assessment.privacy.reasons.some(function (reason) {
    return reason.id === "privacy-data-incomplete";
}));

snapshot = completeCleanSnapshot();
delete snapshot.networkActivity;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.dataStatus, "partial");
assert.ok(assessment.privacy.reasons.some(function (reason) {
    return reason.id === "privacy-data-incomplete";
}));

snapshot = completeCleanSnapshot();
delete snapshot.networkActivity;
delete snapshot.pageAnalysis;
delete snapshot.webSecurity;
assessment = assessBrowserState(snapshot);
assert.strictEqual(assessment.dataStatus, "partial");
assert.deepStrictEqual(assessment.missingSources, [
    "pageAnalysis",
    "networkActivity",
    "webSecurity"
]);

snapshot = completeCleanSnapshot();
const firstAssessment = assessBrowserState(snapshot);
const secondAssessment = assessBrowserState(JSON.parse(JSON.stringify(snapshot)));
assert.deepStrictEqual(firstAssessment, secondAssessment);

[
    firstAssessment,
    assessment
].forEach(assertEscalationsHaveReasons);

console.log("Assessment engine tests passed");
