const {test}=require('node:test'),assert=require('node:assert/strict'),{review}=require('./review.cjs');
test('P95 interpolates measured attempts using the pandas default convention',()=>{const {percentile}=require('./analyze.cjs');assert.equal(percentile([],0.95),null);assert.equal(percentile([20,0,10],0.95),19);assert.equal(percentile([7],0.95),7);});
test('groups retain supporting evidence and overlapping environmental outcomes without confirmation',()=>{
 const r={id:'fixture',category:'news',url:'https://example.org/',navigation:{error:'navigation failed',blocked:{}},anomalies:[{code:'identity',evidence:{finalUrl:'chrome-error://chromewebdata/'},investigation:'inspect'}]};
 const before=JSON.stringify(r),result=review([r],[]);
 assert.equal(result.groups[0].navigationErrorEvents,1);assert.equal(result.groups[0].restrictedEvents,1);assert.equal(result.groups[0].examples[0].evidence.finalUrl,'chrome-error://chromewebdata/');assert.equal(result.confirmedBrowserGuardBugs,null);assert.equal(JSON.stringify(r),before);
 assert.equal(result.groups[0].byCategory.news,1);assert.equal(result.groups[0].byNavigationOutcome['navigation-error'],1);assert.ok(result.groups[0].component);
});
test('CDP differences require paired observations, not missing values or capped mixed windows',()=>{
 const c={websiteId:'fixture',url:'https://example.org/',headers:[{cdpPresent:true,extensionPresent:undefined,equal:false}],protocol:{cdpUsesHTTPS:null,extensionUsesHTTPS:true},comparableFinalNavigation:true,droppedRequestDetails:1,mixedContent:{cdpAttemptCount:1,extensionAttemptCount:0}};
 assert.equal(review([],[c]).cdpInvestigations.length,0);
 const result=review([],[{...c,droppedRequestDetails:0}]);assert.equal(result.cdpInvestigations[0].mixedDifference,true);
 const row={id:'fixture',navigation:{finalUrl:'https://example.org/'},anomalies:[],independent:{requests:[{requestId:'doc',url:'https://example.org/',topFrame:true,type:'Document',timestamp:10},{requestId:'mixed',url:'http://example.org/test.js',type:'Script',timestamp:11}],failures:[{requestId:'mixed',blockedReason:'mixed-content'}]}};
 const blocked=review([row],[{...c,droppedRequestDetails:0}]);assert.equal(blocked.cdpInvestigations[0].blockedMixedAttemptCount,1);assert.deepEqual(blocked.cdpInvestigations[0].mixedAttemptEvidence[0].failureReasons,['mixed-content']);
});
test('paired header disagreement is preserved separately from raw anomaly events',()=>{
 const result=review([],[{websiteId:'fixture',headers:[{cdpPresent:true,extensionPresent:false,equal:false}],protocol:{}}]);
 assert.equal(result.groups.length,0);assert.equal(result.cdpInvestigations.length,1);assert.equal(result.cdpInvestigations[0].headerDifferences.length,1);
});
