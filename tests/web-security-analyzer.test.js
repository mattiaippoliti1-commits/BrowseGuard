const assert = require("assert");

const {
    analyzeSecurityHeaders,
    createEmptyWebSecurityState,
    normalizeResponseHeaders
} = require("../modules/security/web-security-analyzer");

let headers = analyzeSecurityHeaders({});

assert.strictEqual(headers.csp.status, "Missing");
assert.strictEqual(headers.hsts.status, "Missing");
assert.strictEqual(headers.contentTypeOptions.status, "Missing");
assert.strictEqual(headers.referrerPolicy.status, "Not explicitly set");
assert.strictEqual(headers.permissionsPolicy.status, "Not explicitly set");
assert.strictEqual(
    headers.antiFraming.status,
    "No explicit anti-framing policy detected"
);

headers = analyzeSecurityHeaders({
    "content-security-policy":
        "default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "strict-transport-security":
        "max-age=31536000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), camera=()"
});

assert.strictEqual(headers.csp.status, "Present");
assert.ok(headers.csp.observations.includes(
    "default-src allows wildcard source"
));
assert.ok(headers.csp.observations.includes(
    "script-src allows 'unsafe-inline'"
));
assert.ok(headers.csp.observations.includes(
    "script-src allows 'unsafe-eval'"
));
assert.strictEqual(headers.hsts.maxAge, 31536000);
assert.strictEqual(headers.hsts.includeSubDomains, true);
assert.strictEqual(headers.hsts.preload, true);
assert.strictEqual(headers.contentTypeOptions.status, "nosniff");
assert.strictEqual(
    headers.referrerPolicy.value,
    "strict-origin-when-cross-origin"
);
assert.deepStrictEqual(headers.permissionsPolicy.features, [
    "geolocation",
    "camera"
]);

headers = analyzeSecurityHeaders({
    "content-security-policy-report-only": "script-src *",
    "x-content-type-options": "other-value",
    "strict-transport-security": "max-age=300"
});

assert.strictEqual(headers.csp.status, "Report-Only");
assert.ok(headers.csp.observations.includes(
    "script-src allows wildcard source"
));
assert.strictEqual(headers.contentTypeOptions.status, "Present");
assert.ok(headers.hsts.observations.includes("max-age is below 180 days"));

headers = analyzeSecurityHeaders({
    "content-security-policy": "frame-ancestors 'self'",
    "x-frame-options": "SAMEORIGIN"
});

assert.strictEqual(headers.antiFraming.status, "CSP frame-ancestors");
assert.strictEqual(headers.antiFraming.cspFrameAncestors, "'self'");
assert.strictEqual(headers.antiFraming.xFrameOptions, "SAMEORIGIN");

headers = analyzeSecurityHeaders({
    "x-frame-options": "DENY"
});

assert.strictEqual(headers.antiFraming.status, "X-Frame-Options");

const normalizedHeaders = normalizeResponseHeaders([
    {
        name: "Content-Security-Policy",
        value: "default-src 'self'"
    },
    {
        name: "Set-Cookie",
        value: "ignored=true"
    }
]);

assert.deepStrictEqual(normalizedHeaders, {
    "content-security-policy": "default-src 'self'"
});

assert.strictEqual(
    createEmptyWebSecurityState("https://example.test").https.enabled,
    true
);
assert.strictEqual(
    createEmptyWebSecurityState("http://example.test").https.enabled,
    false
);

console.log("Web security analyzer tests passed");
