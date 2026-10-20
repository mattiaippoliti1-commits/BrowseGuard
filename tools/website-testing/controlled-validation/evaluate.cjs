function evaluate(s,r) {
 const checks=[];
 const check=(name,condition,evidence)=>checks.push({name,pass:Boolean(condition),evidence});
 const x=r.extension, i=x?.inputs, a=x?.assessment;
 if (!i || !a) return {status:'INCONCLUSIVE',reason:'Actual popup assessment could not be collected',checks};
 check('popup target identity',x.activeTab?.url===r.url,{expected:r.url,actual:x.activeTab});
 if(s.id==='S17') {
   check('unsupported URL marked unavailable',i.urlAnalysis?.available===false && i.urlAnalysis?.protocol==='about' && i.urlAnalysis?.usesHTTPS===null,i.urlAnalysis);
   check('no false HTTP finding',!a.security.reasons.some(v=>v.id==='main-page-http'),a.security);
   check('Security unavailable, not favorable Low',x.displayed.security.label==='—',x.displayed.security);
   check('partial input status',a.dataStatus==='partial', {status:a.dataStatus,missing:a.missingSources});
   check('missing browser sources', ['urlAnalysis','pageAnalysis','networkActivity','runtimePrivacy','webSecurity'].every(k=>a.missingSources.includes(k)),a.missingSources);
   check('unavailable Privacy and Network cards',x.displayed.privacy.label==='—' && x.displayed.network.label==='—',x.displayed);
   return finish();
 }
 if(r.navigationError) return {status:'INCONCLUSIVE',reason:'Fixture navigation failed',checks};
 check('all sources available',a.dataStatus==='complete',a.missingSources);
 const n=i.networkActivity,p=i.pageAnalysis,w=i.webSecurity,t=i.runtimePrivacy;
 check('request counter partition',n.totalRequests===n.firstPartyRequests+n.thirdPartyRequests && n.thirdPartyRequests===n.sameEntityThirdPartyRequests+n.externalThirdPartyRequests+n.unknownThirdPartyRequests,n);
 check('local resources are not trackers',n.trackerRequests===0 && n.trackerDomainCount===0,{requests:n.trackerRequests,domains:n.trackerDomainCount});
 const securityExpected=s.tls?'no-major-issues':'attention';
 if(!['S06','S07','S09'].includes(s.id)) check('Security rule',a.security.level===securityExpected,{expected:securityExpected,actual:a.security.level});
 if(['S01','S03','S04','S05'].includes(s.id)) {
   const response=r.independent.responses.find(v=>v.topFrame&&v.type==='Document'&&v.url===r.url);
   if(!response)return {status:'INCONCLUSIVE',reason:'Main-document response headers unavailable from independent collector',checks};
   const expected=require('../collect.cjs').selectedHeaders(r.fixture.headers);
   for(const name of ['content-security-policy','strict-transport-security','x-content-type-options','referrer-policy','permissions-policy','x-frame-options'])check('server/response header '+name,(response.headers[name]??null)===(expected[name]??null),{configured:expected[name]??null,response:response.headers[name]??null});
   check('TLS accepted with security details',Boolean(r.tls?.protocol),r.tls);
   check('HTTPS observation',w.https.enabled,{url:w.pageUrl,https:w.https});
   for(const field of ['csp','hsts','contentTypeOptions','referrerPolicy','permissionsPolicy']) {
     const expected=s.id!=='S05' && !(s.id==='S03' && field==='csp') && !(s.id==='S04' && field==='hsts');
     check(field+' presence',w.headers[field].present===expected,{expected,actual:w.headers[field]});
   }
   const antiExpected=s.id==='S05'?'No explicit anti-framing policy detected':s.id==='S03'?'X-Frame-Options':'CSP frame-ancestors';
   check('anti-framing header',w.headers.antiFraming.status===antiExpected,w.headers.antiFraming);
 }
 if(s.id==='S02') check('HTTP observation',w.https.enabled===false && i.urlAnalysis.usesHTTPS===false,{web:w.https,url:i.urlAnalysis.protocol});
 if(['S08','S09'].includes(s.id)) {
   check('one password form',p.formCount===1 && p.passwordFieldCount===1 && p.insecurePasswordForms===1,p);
   check('insecure action Security High',a.security.level==='attention',a.security);
 }
 if(['S10','S11','S12'].includes(s.id)) {
   const count=s.id==='S11'?24:1;
   const received=r.serverReceipts.filter(v=>v.path.startsWith(`/resource/${s.id}/`));
   check('configured resource receipts',new Set(received.map(v=>v.path)).size===count,received);
   check('unknown cross-site counter',n.unknownThirdPartyRequests===count+(s.id==='S12'?1:0),n);
   check('no confirmed entity attribution',n.externalThirdPartyRequests===0 && a.network.level==='low-third-party-activity', {external:n.externalThirdPartyRequests,engine:a.network.level,display:x.displayed.network});
   if(s.id==='S12') check('external DOM resource and iframe',p.externalScriptCount===1 && p.thirdPartyIframeCount===1 && p.thirdPartyUnsandboxedIframeCount===1,p);
 }
 if(s.id==='S13') check('hidden iframe markup',p.iframeCount===1 && p.hiddenIframeCount===1,p);
 if(['S14','S15','S16'].includes(s.id)) {
   const f=r.pageEvidence || {};
   if(s.id==='S15' && (!f.webgl || !f.hardware)) return {status:'NOT_OBSERVABLE',reason:'WebGL context or debug renderer extension unavailable in browser',checks,evidence:f};
   if((s.id==='S14' || s.id==='S16') && !f.canvas || s.id==='S16' && !f.audio) return {status:'INCONCLUSIVE',reason:'Configured runtime calls did not complete',checks,evidence:f};
   if(s.id!=='S15') check('canvas call observed',t.categories.canvas.detected && t.categories.canvas.details.some(v=>v.includes('toDataURL')),t.categories.canvas);
   if(s.id==='S15') check('WebGL hardware call observed',t.categories.webgl.detected && t.categories.webgl.details.some(v=>v.includes('UNMASKED_RENDERER_WEBGL')),t.categories.webgl);
   if(s.id==='S16') check('offline audio observed',t.categories.audio.detected && t.categories.audio.details.some(v=>v.includes('OfflineAudioContext')),t.categories.audio);
   const expected=s.id==='S16'?'moderate-activity':'low-activity';
   check('Privacy rule',a.privacy.level===expected,{expected,actual:a.privacy.level});
 }
 if(['S06','S07'].includes(s.id)) {
   const receipts=r.serverReceipts.filter(v=>v.path.startsWith(`/resource/${s.id}/`));
   const attempted=r.independent.requests.filter(v=>r.fixture?.scriptURLs.includes(v.url));
   check('configured mixed request attempted',attempted.length>0,attempted);
   const blocked=r.independent.failures.filter(v=>v.blockedReason==='mixed-content');
   if(s.id==='S06') {
     if(!receipts.length || !r.resourceExecuted) return {status:'INCONCLUSIVE',reason:'Browser did not load loopback HTTP active script; no protection was overridden',checks,evidence:{receipts,blocked}};
     check('active mixed script observed',w.mixedContent.types.script>=1,w.mixedContent);
     check('active mixed Security High',a.security.level==='attention',a.security);
   } else {
     check('blocked script did not execute',r.resourceExecuted===0,{executed:r.resourceExecuted,receipts});
     if(!blocked.length || receipts.length) return {status:'INCONCLUSIVE',reason:'Configured browser block not independently established',checks,evidence:{receipts,blocked}};
     if(w.mixedContent.requestCount===0) {
       if(checks.some(c=>!c.pass)) return finish();
       return {status:'NOT_OBSERVABLE',reason:'CDP confirms a mixed-content block before any extension request observation; no server receipt. API observation limit, not a demonstrated detector false negative.',checks,evidence:{blocked,mixedContent:w.mixedContent,receipts}};
     }
     check('attempt-only assessment evidence',a.security.reasons.find(v=>v.id==='mixed-content')?.evidence.successfulLoadConfirmed===false,a.security);
   }
 }
 if(s.id==='S18') {
   const before=r.before?.inputs;
   check('A actually contained signals',before?.pageAnalysis.insecurePasswordForms===1 && before?.runtimePrivacy.categories.canvas.detected && before?.networkActivity.unknownThirdPartyRequests>=1,r.before);
   check('B clears DOM and runtime',p.formCount===0 && !t.categories.canvas.detected,{page:p,runtime:t});
   check('B clears network attribution',n.thirdPartyRequests===0 && n.pageUrl===r.url,n);
   check('B clears security state',w.pageUrl===r.url && w.mixedContent.requestCount===0,w);
   check('same tab across A and B',r.before?.activeTab.id===x.activeTab.id,{before:r.before?.activeTab,after:x.activeTab});
 }
 return finish();
 function finish(){return {status:checks.some(c=>!c.pass)?'FAIL':'PASS',reason:null,checks};}
}
module.exports={evaluate};
