const assert = require('node:assert/strict');
const { test } = require('node:test');
const { present, explain } = require('../popup/presentation');
const { assessBrowserState } = require('../modules/assessment/assessment-engine');
function fixture() {
    return {
        dataStatus: 'complete', missingSources: [],
        security: { level: 'no-major-issues', reasons: [] },
        privacy: { level: 'low-activity', reasons: [] },
        network: { level: 'low-third-party-activity', reasons: [] }
    };
}
test('complete results without major findings', () => {
    assert.equal(present(fixture()).state, 'good');
});
test('security attention follows engine level', () => {
    const a = fixture(); a.security.level = 'attention';
    const p = present(a);
    assert.equal(p.state, 'significant');
    assert.match(p.description, /security/);
});
test('elevated privacy is never described as a security vulnerability', () => {
    const a = fixture(); a.privacy.level = 'elevated-activity';
    a.privacy.reasons = [{ id: 'known-trackers', evidence: { trackerDomainCount: 5 } }];
    const p = present(a);
    assert.equal(p.cards.privacy.state, 'significant');
    assert.doesNotMatch(p.description, /security|vulnerability/);
    assert.match(explain(a.privacy.reasons[0]).observation, /5 tracking-associated domains/);
});
test('high network exposure retains actual metric meaning', () => {
    const a = fixture(); a.network.level = 'high-third-party-activity';
    assert.match(present(a).cards.network.description, /confirmed external organizations/);
    assert.doesNotMatch(present(a).cards.network.description, /high amount of network activity/i);
});
test('combined findings name each affected category', () => {
    const a = fixture(); a.security.level = 'observations'; a.privacy.level = 'moderate-activity'; a.network.level = 'high-third-party-activity';
    const p = present(a);
    for (const phrase of ['security', 'privacy', 'network']) assert.ok(p.description.includes(phrase));
});
test('missing network inputs cannot appear positive', () => {
    const a = fixture(); a.dataStatus = 'partial'; a.missingSources = ['networkActivity'];
    assert.equal(present(a).cards.network.state, 'unknown');
    assert.equal(present(a).cards.security.state, 'good');
    assert.equal(present(a).state, 'unknown');
});
test('confirmed findings survive partial analysis', () => {
    const a = fixture(); a.dataStatus = 'partial'; a.missingSources = ['runtimePrivacy'];
    a.privacy.reasons = [{ id: 'known-trackers' }];
    const p = present(a);
    assert.equal(p.cards.privacy.state, 'unknown');
    assert.match(p.cards.privacy.description, /insufficient/);
    assert.equal(p.cards.privacy.limited, true);
    a.privacy.level = 'elevated-activity';
    assert.equal(present(a).state, 'significant');
    assert.ok(present(a).limitation);
});
test('empty, unavailable, unknown levels and engine empty snapshot are insufficient', () => {
    for (const a of [null, {}, assessBrowserState({})]) {
        const p = present(a);
        assert.equal(p.state, 'unknown');
        for (const c of Object.values(p.cards)) assert.equal(c.state, 'unknown');
    }
    const a = fixture(); a.network.level = 'future-level';
    assert.equal(present(a).cards.network.state, 'unknown');
});
test('adapter never mutates engine outputs or adds thresholds', () => {
    const a = fixture(); const before = JSON.stringify(a);
    present(a); assert.equal(JSON.stringify(a), before);
    assert.equal('score' in present(a), false);
});
test('unsupported reason keeps observation without fabricated advice', () => {
    const e = explain({ id: 'future-reason', message: 'Observed detail' });
    assert.equal(e.observation, 'Observed detail'); assert.equal(e.action, null);
});
test('header absence explanation avoids vulnerability claims', () => {
    assert.match(explain({ id: 'hsts-missing' }).implication, /does not establish a vulnerability/);
    assert.equal(explain({ id: 'hsts-missing' }).action, null);
});
test('real engine fixtures preserve mixed findings and per-category availability', () => {
    const assessment = assessBrowserState({
        urlAnalysis: { usesHTTPS: false, protocol: 'http' },
        pageAnalysis: { insecurePasswordForms: 1 },
        networkActivity: { totalRequests: 100, trackerDomainCount: 6, trackerRequests: 40,
            thirdPartyRequests: 80, thirdPartyDomainCount: 20, externalThirdPartyRequests: 80, externalThirdPartyDomainCount: 20 },
        runtimePrivacy: { available: false },
        webSecurity: { available: false }
    });
    const p = present(assessment);
    assert.equal(p.cards.security.state, 'significant');
    assert.equal(p.cards.privacy.state, 'significant');
    assert.equal(p.cards.network.state, 'significant');
    assert.equal(p.cards.network.limited, false);
    assert.equal(p.cards.security.limited, true);
    assert.ok(p.limitation);
    assert.match(explain(assessment.security.reasons.find(r => r.id === 'insecure-password-forms')).action, /Avoid submitting/);
});
