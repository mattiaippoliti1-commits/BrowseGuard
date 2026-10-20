const {test}=require('node:test'),assert=require('node:assert/strict');
const {assessBrowserState}=require('../../modules/assessment/assessment-engine');
const {present}=require('../../popup/presentation');
const {validate}=require('./validate.cjs');
function record(urlAnalysis){
 const inputs={urlAnalysis,pageAnalysis:null,networkActivity:null,runtimePrivacy:null,webSecurity:null};
 const assessment=assessBrowserState(inputs),view=present(assessment);
 return {extension:{inputs,assessment,renderedAssessment:assessment,displayed:Object.fromEntries(['security','privacy','network'].map(d=>[d,{label:view.cards[d].label,state:view.cards[d].state}]))}};
}
test('independent HTTP oracle does not mistake unsupported usesHTTPS=false for HTTP',()=>{
 const r=record({protocol:'about',usesHTTPS:false,available:false});
 const codes=validate(r).map(a=>a.code);
 assert.ok(!codes.includes('http_security_rule'));assert.ok(!codes.includes('missing_source_contract'));
});
test('independent HTTP oracle still catches a lost explicit HTTP finding',()=>{
 const r=record({protocol:'http',usesHTTPS:false});
 r.extension.assessment.security.level='no-major-issues';
 assert.ok(validate(r).some(a=>a.code==='http_security_rule'));
});
