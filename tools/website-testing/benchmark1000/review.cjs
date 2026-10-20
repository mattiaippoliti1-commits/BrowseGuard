// Offline evidence grouping. Correlation is not causal attribution or bug confirmation.
function review(rows, comparisons) {
  const groups = new Map();
  for (const r of rows) for (const a of r.anomalies) {
    const components={access_restriction:'site access policy',navigation_failure:'navigation/environment',missing_sources:'extension observation availability',document_identity_mismatch:'worker/document synchronization',active_tab_mismatch:'popup/target attribution',extension_console_errors:'popup/resource loading',collection_failure:'popup acquisition',missing_analysis:'popup acquisition',engine_replay_mismatch:'assessment engine/replay',rendered_assessment_mismatch:'popup presentation'};
    const interpretations={access_restriction:'site restriction',navigation_failure:'environmental failure',missing_sources:'observability limitation',document_identity_mismatch:'methodological or synchronization difference',active_tab_mismatch:'methodological or synchronization difference',extension_console_errors:'resource or extension error requiring attribution',collection_failure:'collection failure; harness/extension attribution unresolved',missing_analysis:'unavailable measurement after collection failure'};
    if (!groups.has(a.code)) groups.set(a.code, {code:a.code,count:0,ids:[],component:components[a.code]||'extension/validator contract',interpretation:interpretations[a.code]||'possible extension or validator defect; separate reproduction required',byCategory:{},byNavigationOutcome:{},navigationErrorEvents:0,restrictedEvents:0,examples:[],investigation:a.investigation});
    const g=groups.get(a.code);g.count++;g.ids.push(r.id);
    const category=r.category||'unmapped',outcome=r.navigation?.error?'navigation-error':r.navigation?.blocked?'restricted':r.status;
    g.byCategory[category]=(g.byCategory[category]||0)+1;g.byNavigationOutcome[outcome]=(g.byNavigationOutcome[outcome]||0)+1;
    if(r.navigation?.error)g.navigationErrorEvents++;
    if(r.navigation?.blocked)g.restrictedEvents++;
    if(g.examples.length<3)g.examples.push({id:r.id,url:r.url,evidence:a.evidence});
  }
  const cdp=[],byId=new Map(rows.map(r=>[r.id,r]));
  for(const c of comparisons){
    const headerDifferences=(c.headers||[]).filter(h=>typeof h.extensionPresent==='boolean'&&typeof h.cdpPresent==='boolean'&&!h.equal);
    const protocolDifference=typeof c.protocol?.cdpUsesHTTPS==='boolean'&&typeof c.protocol?.extensionUsesHTTPS==='boolean'&&c.protocol.cdpUsesHTTPS!==c.protocol.extensionUsesHTTPS;
    const mixedDifference=c.comparableFinalNavigation&&c.droppedRequestDetails===0&&typeof c.mixedContent?.extensionAttemptCount==='number'&&c.mixedContent.cdpAttemptCount!==c.mixedContent.extensionAttemptCount;
    if(headerDifferences.length||protocolDifference||mixedDifference){
      const r=byId.get(c.websiteId),requests=r?.independent?.requests||[],doc=[...requests].reverse().find(q=>q.topFrame&&q.type==='Document'&&q.url===r?.navigation?.finalUrl);
      const mixedAttemptEvidence=doc?requests.filter(q=>q.timestamp>=doc.timestamp&&q.url.startsWith('http:')&&!(q.topFrame&&q.type==='Document')).map(q=>({requestId:q.requestId,url:q.url,type:q.type,failureReasons:(r.independent.failures||[]).filter(f=>f.requestId===q.requestId).map(f=>f.blockedReason||f.error)})):null;
      cdp.push({id:c.websiteId,url:c.url,headerDifferences,protocolDifference,protocol:c.protocol,mixedDifference:Boolean(mixedDifference),mixedContent:c.mixedContent,mixedAttemptEvidence,blockedMixedAttemptCount:mixedAttemptEvidence?mixedAttemptEvidence.filter(q=>q.failureReasons.includes('mixed-content')).length:null,finalResponseEvidence:c.finalResponseEvidence,phaseWindow:c.phaseWindow,investigation:'Inspect matched response, redirects, worker reset and snapshot timing. Reproduce separately before attributing a defect. Blocked mixed attempts may not reach webRequest.'});
    }
  }
  const candidates=rows.filter(r=>r.collectionError||(!r.navigation?.error&&r.anomalies.some(a=>['document_identity_mismatch','extension_console_errors'].includes(a.code)))).map(r=>({id:r.id,url:r.url,category:r.category,status:r.status,navigation:r.navigation,collectionError:r.collectionError,anomalies:r.anomalies}));
  return {classification:'investigation-hypotheses',confirmedBrowserGuardBugs:null,groups:[...groups.values()],cdpInvestigations:cdp,priorityManualCandidates:candidates,note:'Environmental overlap is descriptive, not proof of cause. CDP disagreements are separate observation differences and are not added to the raw anomaly count. Raw records are unchanged.'};
}
module.exports={review};
