/**
 * BrowserGuard Web Security Configuration analyzer.
 *
 * The analyzer consumes only selected security headers and avoids storing
 * cookies, response bodies, request bodies, or unrelated headers.
 */

function createEmptyWebSecurityState(pageUrl) {

    const usesHttps = getUrlProtocol(pageUrl) === "https:";

    return {
        pageUrl: pageUrl || "",
        https: {
            enabled: usesHttps
        },
        headers: analyzeSecurityHeaders({}),
        mixedContent: {
            requestCount: 0,
            types: {}
        }
    };

}

function analyzeSecurityHeaders(headersByName) {

    const cspHeader = getHeaderValue(headersByName, "content-security-policy");
    const cspReportOnlyHeader = getHeaderValue(
        headersByName,
        "content-security-policy-report-only"
    );
    const hstsHeader = getHeaderValue(headersByName, "strict-transport-security");
    const contentTypeOptionsHeader = getHeaderValue(
        headersByName,
        "x-content-type-options"
    );
    const referrerPolicyHeader = getHeaderValue(headersByName, "referrer-policy");
    const permissionsPolicyHeader = getHeaderValue(
        headersByName,
        "permissions-policy"
    );
    const xFrameOptionsHeader = getHeaderValue(headersByName, "x-frame-options");

    const csp = analyzeCsp(cspHeader, cspReportOnlyHeader);

    return {
        csp: csp,
        hsts: analyzeHsts(hstsHeader),
        contentTypeOptions: analyzeContentTypeOptions(contentTypeOptionsHeader),
        referrerPolicy: analyzeReferrerPolicy(referrerPolicyHeader),
        permissionsPolicy: analyzePermissionsPolicy(permissionsPolicyHeader),
        antiFraming: analyzeAntiFraming(csp, xFrameOptionsHeader)
    };

}

function normalizeResponseHeaders(responseHeaders) {

    const normalizedHeaders = {};

    (responseHeaders || []).forEach(function (header) {
        const name = String(header.name || "").toLowerCase();

        if (!isSecurityHeaderName(name)) {
            return;
        }

        normalizedHeaders[name] = String(header.value || "");
    });

    return normalizedHeaders;

}

function isSecurityHeaderName(name) {

    return [
        "content-security-policy",
        "content-security-policy-report-only",
        "strict-transport-security",
        "x-content-type-options",
        "referrer-policy",
        "permissions-policy",
        "x-frame-options"
    ].includes(name);

}

function analyzeCsp(cspHeader, reportOnlyHeader) {

    const effectiveHeader = cspHeader || reportOnlyHeader || "";
    const directives = parseCspDirectives(effectiveHeader);
    const observations = [];

    Object.entries(directives).forEach(function ([directive, values]) {
        if (values.includes("*")) {
            observations.push(directive + " allows wildcard source");
        }

        if (values.includes("'unsafe-inline'")) {
            observations.push(directive + " allows 'unsafe-inline'");
        }

        if (values.includes("'unsafe-eval'")) {
            observations.push(directive + " allows 'unsafe-eval'");
        }
    });

    return {
        present: Boolean(cspHeader),
        reportOnly: !cspHeader && Boolean(reportOnlyHeader),
        status: cspHeader ? "Present" :
            reportOnlyHeader ? "Report-Only" : "Missing",
        observations: observations,
        frameAncestors: directives["frame-ancestors"] ?
            directives["frame-ancestors"].join(" ") :
            ""
    };

}

function parseCspDirectives(policy) {

    const directives = {};

    String(policy || "").split(";").forEach(function (rawDirective) {
        const parts = rawDirective.trim().split(/\s+/).filter(Boolean);

        if (parts.length === 0) {
            return;
        }

        directives[parts[0].toLowerCase()] = parts.slice(1);
    });

    return directives;

}

function analyzeHsts(headerValue) {

    if (!headerValue) {
        return {
            present: false,
            status: "Missing",
            maxAge: null,
            includeSubDomains: false,
            preload: false,
            observations: []
        };
    }

    const directives = parseHeaderDirectives(headerValue);
    const maxAge = Number(directives["max-age"]);
    const observations = [];

    if (Number.isFinite(maxAge) && maxAge < 15552000) {
        observations.push("max-age is below 180 days");
    }

    return {
        present: true,
        status: "Present",
        maxAge: Number.isFinite(maxAge) ? maxAge : null,
        includeSubDomains: Object.prototype.hasOwnProperty.call(
            directives,
            "includesubdomains"
        ),
        preload: Object.prototype.hasOwnProperty.call(directives, "preload"),
        observations: observations
    };

}

function analyzeContentTypeOptions(headerValue) {

    if (!headerValue) {
        return {
            present: false,
            status: "Missing",
            value: ""
        };
    }

    const value = headerValue.trim().toLowerCase();

    return {
        present: true,
        status: value === "nosniff" ? "nosniff" : "Present",
        value: headerValue
    };

}

function analyzeReferrerPolicy(headerValue) {

    return {
        present: Boolean(headerValue),
        status: headerValue ? headerValue : "Not explicitly set",
        value: headerValue || ""
    };

}

function analyzePermissionsPolicy(headerValue) {

    const features = String(headerValue || "")
        .split(",")
        .map(function (part) {
            return part.trim().split("=")[0].trim();
        })
        .filter(Boolean);

    return {
        present: Boolean(headerValue),
        status: headerValue ? "Present" : "Not explicitly set",
        features: features
    };

}

function analyzeAntiFraming(csp, xFrameOptionsHeader) {

    return {
        cspFrameAncestors: csp.frameAncestors,
        xFrameOptions: xFrameOptionsHeader || "",
        status: csp.frameAncestors ?
            "CSP frame-ancestors" :
            xFrameOptionsHeader ?
                "X-Frame-Options" :
                "No explicit anti-framing policy detected"
    };

}

function parseHeaderDirectives(headerValue) {

    const directives = {};

    String(headerValue || "").split(";").forEach(function (directive) {
        const [rawName, rawValue] = directive.trim().split("=");
        const name = String(rawName || "").toLowerCase();

        if (!name) {
            return;
        }

        directives[name] = rawValue === undefined ? true : rawValue.trim();
    });

    return directives;

}

function getHeaderValue(headersByName, name) {

    return headersByName[String(name).toLowerCase()] || "";

}

function getUrlProtocol(urlString) {

    try {
        return new URL(urlString).protocol;
    } catch (error) {
        return "";
    }

}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        analyzeSecurityHeaders: analyzeSecurityHeaders,
        createEmptyWebSecurityState: createEmptyWebSecurityState,
        normalizeResponseHeaders: normalizeResponseHeaders,
        parseCspDirectives: parseCspDirectives
    };
} else {
    globalThis.BrowserGuardWebSecurityAnalyzer = {
        analyzeSecurityHeaders: analyzeSecurityHeaders,
        createEmptyWebSecurityState: createEmptyWebSecurityState,
        normalizeResponseHeaders: normalizeResponseHeaders,
        parseCspDirectives: parseCspDirectives
    };
}
