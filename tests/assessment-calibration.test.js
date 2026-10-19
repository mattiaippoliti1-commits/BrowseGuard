const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assessBrowserState } = require('../modules/assessment/assessment-engine');
const { present } = require('../popup/presentation');
const historical = require('./fixtures/governo-historical.json');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() { return clone(historical); }
function levels(s) { const a = present(assessBrowserState(s)); return Object.values(a.cards).map(c => c.label); }
function runtime(s, category, details) {
    s.runtimePrivacy.categories[category] = { detected: true, eventCount: details.length, details };
}
test('historical governo observation preserves Low engine levels and discloses insufficient Network attribution', () => {
    const s = fixture(), before = JSON.stringify(s), a = assessBrowserState(s);
    assert.deepEqual(levels(s), ['Low', 'Low', '—']);
    assert.deepEqual(a.security.contributingFindings, []);
    assert.equal(a.network.level, 'low-third-party-activity');
    for (const id of ['csp-missing', 'hsts-missing']) assert.ok(a.security.informationalObservations.some(r => r.id === id));
    assert.equal(a.privacy.reasons.find(r => r.id === 'known-trackers').evidence.trackerRequests, 7);
    assert.deepEqual(a.privacy.reasons.find(r => r.id === 'known-trackers').evidence.categories, ['Advertising']);
    assert.equal(a.network.uncertainties[0].evidence.unknownThirdPartyRequests, 10);
    assert.equal(s.runtimePrivacy.categories.navigator.eventCount, 3);
    assert.equal(s.runtimePrivacy.categories.screen.eventCount, 2);
    assert.equal(JSON.stringify(s), before);
    s.urlAnalysis.hostname = 'unrelated.example';
    assert.deepEqual(levels(s), ['Low', 'Low', '—']);
});
test('HTTPS missing all hardening headers and permissive CSP remain recommendations', () => {
    const s = fixture();
    s.webSecurity.headers.csp.observations = ['script-src allows unsafe-inline'];
    s.webSecurity.headers.hsts.observations = ['max-age is below 180 days'];
    s.webSecurity.headers.contentTypeOptions.status = 'Missing';
    s.webSecurity.headers.antiFraming.status = 'No explicit anti-framing policy detected';
    for (const key of ['referrerPolicy', 'permissionsPolicy']) s.webSecurity.headers[key] = { present: false };
    const a = assessBrowserState(s).security;
    assert.equal(levels(s)[0], 'Low');
    assert.equal(a.informationalObservations.length, 8);
    assert.ok(a.reasons.every(r => !r.evidence.countedForEscalation));
});
test('HTTPS insecure password form stays High despite positive hardening', () => {
    const s = fixture(); s.pageAnalysis.insecurePasswordForms = 1;
    s.webSecurity.headers.csp.present = true; s.webSecurity.headers.hsts.present = true;
    const a = assessBrowserState(s).security;
    assert.equal(levels(s)[0], 'High');
    assert.ok(a.positiveSignals.length >= 4);
    assert.ok(a.contributingFindings.some(r => r.id === 'insecure-password-forms'));
});
test('HTTP with password fields remains High even without an explicit form action', () => {
    const s = fixture(); s.urlAnalysis.usesHTTPS = false; s.urlAnalysis.protocol = 'http';
    s.webSecurity.https.enabled = false; s.pageAnalysis.passwordFieldCount = 1;
    assert.equal(levels(s)[0], 'High');
});
for (const [type, expected] of [['script', 'High'], ['sub_frame', 'High'], ['image', 'Moderate'], ['other', 'Moderate']]) {
    test(`mixed content ${type} attempts give ${expected} without claiming execution`, () => {
        const s = fixture(); s.webSecurity.mixedContent = {requestCount:1,types:{[type]:1}};
        assert.equal(levels(s)[0], expected);
        assert.equal(assessBrowserState(s).security.reasons.find(r => r.id === 'mixed-content').evidence.successfulLoadConfirmed, false);
    });
}
test('single tracker-associated domain plus a single sensitive API does not accumulate', () => {
    const s = fixture(); runtime(s, 'canvas', ['toDataURL:']);
    assert.equal(levels(s)[1], 'Low');
    assert.equal(assessBrowserState(s).privacy.contributingFindings.length, 0);
});
test('substantial domain-associated activity remains High, without asserting request tracking', () => {
    const s = fixture(); s.networkActivity.trackerDomainCount = 5; s.networkActivity.trackerRequests = 30;
    const a = assessBrowserState(s).privacy;
    assert.equal(levels(s)[1], 'High');
    assert.match(a.reasons[0].message, /tracking-associated domains/);
});
test('Navigator and Screen including hardware capabilities remain informational', () => {
    const s = fixture(); runtime(s,'navigator',['language:','languages:','userAgent:','hardwareConcurrency:','deviceMemory:','platform:']);
    runtime(s,'screen',['width:','height:','colorDepth:']);
    assert.equal(levels(s)[1], 'Low');
    assert.ok(assessBrowserState(s).privacy.reasons.every(r => r.severity === 'info'));
});
test('three broad API categories do not imply correlated fingerprinting surfaces', () => {
    const s = fixture(); runtime(s,'webgl',['getParameter:MAX_TEXTURE_SIZE']); runtime(s,'audio',['AudioContext:']);
    assert.equal(levels(s)[1], 'Low');
});
test('two sensitive surfaces give Moderate; moderate tracker activity plus correlation stays High', () => {
    const s = fixture(); runtime(s,'canvas',['getImageData:']); runtime(s,'audio',['OfflineAudioContext:']);
    assert.equal(levels(s)[1], 'Moderate');
    const a = assessBrowserState(s).privacy;
    assert.equal(a.reasons[0].evidence.sameScriptAttributionConfirmed, false);
    s.networkActivity.trackerDomainCount = 2; s.networkActivity.trackerRequests = 12;
    assert.equal(levels(s)[1], 'High');
});
function exposure(s, total, requests, domains) {
    Object.assign(s.networkActivity,{totalRequests:total,thirdPartyRequests:requests,thirdPartyDomainCount:domains,
        externalThirdPartyRequests:requests,externalThirdPartyDomainCount:domains,unknownThirdPartyRequests:0,unknownThirdPartyDomainCount:0});
}
test('low confirmed external activity stays Low', () => {
    const s = fixture(); exposure(s,100,10,2); assert.equal(levels(s)[2], 'Low');
});
test('substantial confirmed external exposure stays High', () => {
    const s = fixture(); exposure(s,100,60,16); assert.equal(levels(s)[2], 'High');
});
test('high volume at a low external ratio does not escalate on request count alone', () => {
    const s = fixture(); exposure(s,10000,100,2); assert.equal(levels(s)[2], 'Low');
});
test('a tiny sample with a high external ratio stays Low', () => {
    const s = fixture(); exposure(s,5,4,4); assert.equal(levels(s)[2], 'Low');
    exposure(s,20,5,4); assert.equal(levels(s)[2], 'Moderate');
});
test('unknown attribution cannot turn into either confirmed external or first-party exposure', () => {
    const s = fixture(); Object.assign(s.networkActivity,{totalRequests:100,thirdPartyRequests:90,unknownThirdPartyRequests:90,thirdPartyDomainCount:20,unknownThirdPartyDomainCount:20,assessmentThirdPartyRequests:90});
    const a = assessBrowserState(s).network;
    assert.equal(levels(s)[2], '—');
    assert.equal(a.uncertainties[0].evidence.confirmedExternal, false);
    assert.equal(a.reasons.find(r=>r.id==='third-party-network-activity').evidence.assessmentThirdPartyRequests,0);
    delete s.networkActivity.externalThirdPartyRequests; delete s.networkActivity.externalThirdPartyDomainCount;
    assert.equal(levels(s)[2], '—');
});
test('same-entity cross-origin requests stay visible and do not escalate', () => {
    const s = fixture(); Object.assign(s.networkActivity,{totalRequests:100,thirdPartyRequests:90,sameEntityThirdPartyRequests:90,unknownThirdPartyRequests:0});
    assert.equal(levels(s)[2], 'Low');
    assert.equal(assessBrowserState(s).network.reasons[0].evidence.sameEntityThirdPartyRequests,90);
});
test('incomplete inputs are Unavailable without creating findings or hiding known High findings', () => {
    const s = fixture(); s.runtimePrivacy.available = false;
    assert.deepEqual(levels(s),['Low','—','—']);
    assert.equal(assessBrowserState(s).security.summary, 'No major security issues observed');
    s.networkActivity.trackerDomainCount = 5; s.networkActivity.trackerRequests = 30;
    assert.equal(levels(s)[1], 'High');
    s.pageAnalysis.available = false;
    assert.equal(levels(s)[0], '—');
    s.urlAnalysis.usesHTTPS = false;
    assert.equal(levels(s)[0], 'High');
    assert.deepEqual(levels({}), ['—','—','—']);
});
test('independent significant findings survive positive signals and stay deterministic', () => {
    const s = fixture(); s.pageAnalysis.insecurePasswordForms = 1;
    s.webSecurity.mixedContent = {requestCount:1,types:{script:1}};
    s.networkActivity.trackerDomainCount = 5; s.networkActivity.trackerRequests = 30;
    exposure(s,100,60,16);
    assert.deepEqual(levels(s), ['High','High','High']);
    const a = assessBrowserState(s);
    assert.equal(a.security.contributingFindings.length, 2);
    assert.deepEqual(a, assessBrowserState(clone(s)));
});
