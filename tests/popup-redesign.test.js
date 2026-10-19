const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assessBrowserState } = require('../modules/assessment/assessment-engine');
const { present, networkAttribution } = require('../popup/presentation');
const historical = require('./fixtures/governo-historical.json');
function snapshot() {
    const s = JSON.parse(JSON.stringify(historical));
    Object.assign(s.networkActivity, { totalRequests:100, firstPartyRequests:100, thirdPartyRequests:0,
        thirdPartyDomainCount:0, unknownThirdPartyRequests:0, unknownThirdPartyDomainCount:0,
        trackerDomainCount:0, trackerRequests:0 });
    return s;
}
function view(s) { return present(assessBrowserState(s), s.networkActivity); }
function labels(s) { return Object.values(view(s).cards).map(card => card.label); }
for (const [expected, configure] of [
    [['Low','Low','Low'], s => s],
    [['Low','High','—'], s => { Object.assign(s.networkActivity, historical.networkActivity); s.networkActivity.trackerDomainCount=5; s.networkActivity.trackerRequests=30; }],
    [['Moderate','Moderate','Low'], s => { s.pageAnalysis.externalPasswordForms=1; s.networkActivity.trackerDomainCount=2; s.networkActivity.trackerRequests=12; }],
    [['High','High','High'], s => { s.pageAnalysis.insecurePasswordForms=1; Object.assign(s.networkActivity,{trackerDomainCount:5,trackerRequests:40,thirdPartyRequests:70,thirdPartyDomainCount:12,externalThirdPartyRequests:70,externalThirdPartyDomainCount:12}); }]
]) {
    test('redesign status combination ' + expected.join(' / '), () => {
        const s=snapshot(); configure(s); const before=JSON.stringify(s);
        assert.deepEqual(labels(s),expected);
        assert.equal(JSON.stringify(s),before);
    });
}
test('all missing inputs display dashes and preserve the missing-source explanations', () => {
    const p=present(assessBrowserState({}));
    assert.deepEqual(Object.values(p.cards).map(c=>c.label),['—','—','—']);
    assert.match(p.cards.network.description,/not been collected/);
});
for (const [crossOrigin,unknown,expected] of [[4,4,'Low'],[5,5,'—'],[10,5,'Low'],[10,6,'—']]) {
    test(`Network ownership boundary: ${unknown}/${crossOrigin} unresolved -> ${expected}`, () => {
        const s=snapshot(); Object.assign(s.networkActivity,{thirdPartyRequests:crossOrigin,unknownThirdPartyRequests:unknown,sameEntityThirdPartyRequests:crossOrigin-unknown});
        assert.equal(labels(s)[2],expected);
        assert.equal(assessBrowserState(s).network.level,'low-third-party-activity');
    });
}
for (const [external, domains, expected] of [[25,2,'Moderate'],[60,16,'High']]) {
    test('confirmed ' + expected + ' findings survive majority unknown ownership', () => {
        const s=snapshot(); Object.assign(s.networkActivity,{totalRequests:200,thirdPartyRequests:external+100,
            externalThirdPartyRequests:external,externalThirdPartyDomainCount:domains,unknownThirdPartyRequests:100});
        // Moderate at >=20 external requests and >=10% ratio; High at >=15 external domains.
        assert.equal(labels(s)[2],expected);
        assert.match(view(s).cards.network.description,/actual exposure may be greater/);
        assert.equal(networkAttribution(assessBrowserState(s),s.networkActivity).externalMetric,String(external));
    });
}
test('confirmed zero requires no unresolved ownership; partial confirmed counts remain numeric', () => {
    const s=snapshot(), n=s.networkActivity;
    assert.equal(networkAttribution(null,n).externalMetric,'0');
    n.thirdPartyRequests=1; n.unknownThirdPartyRequests=1;
    assert.equal(networkAttribution(null,n).externalMetric,'—');
    n.externalThirdPartyRequests=2;
    assert.equal(networkAttribution(null,n).externalMetric,'2');
    n.available=false;
    assert.equal(networkAttribution(null,n).externalMetric,'—');
});
test('legacy unattributed cross-origin counts remain unknown rather than external or same-entity', () => {
    const s=snapshot(), n=s.networkActivity;
    n.thirdPartyRequests=20; delete n.externalThirdPartyRequests; delete n.sameEntityThirdPartyRequests; delete n.unknownThirdPartyRequests;
    const result=networkAttribution(assessBrowserState(s),n);
    assert.equal(result.unknown,20); assert.equal(result.external,null); assert.equal(result.sameEntity,null);
    assert.equal(labels(s)[2],'—'); assert.equal(result.externalMetric,'—');
});
test('malformed or unavailable collection cannot supply a zero external count', () => {
    for(const activity of [{},{available:false,totalRequests:0,externalThirdPartyRequests:0}]) {
        const p=present(assessBrowserState(snapshot()),activity);
        assert.equal(p.cards.network.label,'—');
        assert.equal(networkAttribution(null,activity).externalMetric,'—');
    }
});
