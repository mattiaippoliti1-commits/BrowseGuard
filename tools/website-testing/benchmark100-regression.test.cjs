const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('./validate.cjs');
const {assessBrowserState}=require('../../modules/assessment/assessment-engine');
const {present}=require('../../popup/presentation');
// Regression exposed by actual Walmart/Best Buy snapshots: production stores API:detail tokens.
test('Privacy rule oracle recognizes API-prefixed sensitive runtime details',()=>{
 const inputs={urlAnalysis:{usesHTTPS:true},pageAnalysis:{},networkActivity:{available:true,totalRequests:1,
  firstPartyRequests:1,thirdPartyRequests:0,thirdPartyDomainCount:0,sameEntityThirdPartyRequests:0,externalThirdPartyRequests:0,unknownThirdPartyRequests:0,
  sameEntityThirdPartyDomainCount:0,externalThirdPartyDomainCount:0,unknownThirdPartyDomainCount:0,trackerRequests:0,trackerDomainCount:0,
  resourceTypes:{main_frame:1},thirdPartyDomains:[],trackerDomains:[],sameEntityThirdPartyDomains:[],externalThirdPartyDomains:[],unknownThirdPartyDomains:[]},
  webSecurity:{https:{enabled:true},headers:{}},runtimePrivacy:{available:true,detectedCategoryCount:2,categories:{
   webgl:{detected:true,eventCount:1,details:['getParameter:UNMASKED_RENDERER_WEBGL']},
   audio:{detected:true,eventCount:1,details:['OfflineAudioContext:']}}}};
 const assessment=assessBrowserState(inputs),view=present(assessment,inputs.networkActivity);
 assert.equal(assessment.privacy.level,'moderate-activity');
 const record={navigation:{},extension:{inputs,assessment,renderedAssessment:assessment,
  displayed:Object.fromEntries(['security','privacy','network'].map(d=>[d,{label:view.cards[d].label,state:view.cards[d].state}]))},independent:{responses:[]}};
 assert.deepEqual(validate(record).filter(a=>a.code==='privacy_rule_contract'),[]);
});
