// Offline enrichment/publication; never visits a website or transmits data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {compare,summarize}=require('../analyze-benchmark100.cjs');
const {atomicJson,recordsIn}=require('../storage.cjs'),{report,csvCell}=require('../report.cjs');
const {guardProduction,loadCorpus,recordValid,outcomes,sha}=require('./core.cjs');
const base=path.resolve(__dirname,'..'),output=path.join(base,'runs/benchmark1000');
function csv(file,columns,rows){fs.writeFileSync(file,columns.join(',')+'\n'+rows.map(r=>columns.map(k=>csvCell(r[k])).join(',')).join('\n')+'\n',{mode:0o600});}
function localData(){const context={};vm.runInNewContext(fs.readFileSync(path.join(base,'../../data/tracker-data.js'),'utf8')+';globalThis.result=BROWSERGUARD_TRACKER_DATA;',context);return {trackers:new Map(context.result.trackers.map(v=>[v[0],v[1]])),entities:new Map(context.result.entityDomains.map(v=>[v[0],v[1]]))};}
function finalResponse(r){return [...(r.independent?.responses||[])].reverse().find(v=>v.topFrame&&v.type==='Document'&&!v.redirect&&v.url===r.navigation?.finalUrl);}
function percentile(values,p){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);}
function consistency(comparisons){
 const headers=comparisons.flatMap(c=>c.headers||[]).filter(h=>typeof h.extensionPresent==='boolean'),protocol=comparisons.filter(c=>typeof c.protocol.extensionUsesHTTPS==='boolean'&&typeof c.protocol.cdpUsesHTTPS==='boolean');
 const mixed=comparisons.filter(c=>c.comparableFinalNavigation&&c.droppedRequestDetails===0&&typeof c.mixedContent?.extensionAttemptCount==='number');
 return {headers:{pairs:headers.length,equal:headers.filter(h=>h.equal).length,different:headers.filter(h=>!h.equal).length},protocol:{pairs:protocol.length,equal:protocol.filter(c=>c.protocol.cdpUsesHTTPS===c.protocol.extensionUsesHTTPS).length},mixed:{pairs:mixed.length,equal:mixed.filter(c=>c.mixedContent.cdpAttemptCount===c.mixedContent.extensionAttemptCount).length,cdpPositive:mixed.filter(c=>c.mixedContent.cdpAttemptCount>0).length,extensionPositive:mixed.filter(c=>c.mixedContent.extensionAttemptCount>0).length},note:'Paired observation agreement, not accuracy. CDP windows differ; blocked attempts may be unavailable to extension webRequest. Dataset-derived tracker/entity labels share production data.'};
}
function main(){
 guardProduction();const {corpus,identity}=loadCorpus(),manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
 if(fs.existsSync(path.join(output,'.lock')))throw Error('Collection is still running');
 if(manifest.sourceHash!==guardProduction().hash||manifest.corpus.txtSha256!==identity.txtSha256)throw Error('Identity changed');
 const byId=new Map(corpus.sites.map(s=>[s.id,s])),files=recordsIn(output);
 if(files.length!==1000&&!process.argv.includes('--allow-partial'))throw Error('Require 1000 completed records; use --allow-partial explicitly for a stopped run');
 const rows=files.map(file=>{const r=JSON.parse(fs.readFileSync(path.join(output,'records',file)));const site=byId.get(r.id);if(!site)throw Error('Unexpected ID');recordValid(r,site,manifest);return r;});
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate records');
 const data=localData(),comparisons=rows.map(r=>{
  const c=compare(r,data),response=finalResponse(r);
  c.protocol.cdpUsesHTTPS=response?/^https:/.test(response.url):null;c.protocol.measurementSource='Matched final CDP top-frame Document response URL, not Playwright final URL';
  return c;
 });
 const stats=summarize(rows),agreement=consistency(comparisons),operations={};
 for(const key of ['assessmentCaptured','partial','navigationAccepted','unrestrictedVisit','http401','http403','http429','http5xx','restriction','timeout','tlsError','dnsError','navigationError','collectionError','assessmentUnavailable'])operations[key]=rows.filter(r=>outcomes(r)[key]).length;
 operations.intendedPageSemanticVerification='not performed; neither captured assessment nor 2xx establishes intended-page identity';
 const categoryStats=Object.entries(corpus.categoryCounts).map(([category,planned])=>({category,label:corpus.sites.find(s=>s.category===category).categoryLabel,planned,...summarize(rows.filter(r=>byId.get(r.id).category===category))}));
 const resourceFiles=fs.readdirSync(output).filter(f=>/^resource-statistics-\d+\.json$/.test(f)),samples=resourceFiles.map(f=>JSON.parse(fs.readFileSync(path.join(output,f))));
 const resources={sessions:samples.length,samples:samples.reduce((n,s)=>n+s.samples,0),peakNodeRssBytes:Math.max(0,...samples.map(s=>s.peakNodeRssBytes)),peakChromiumRssBytes:Math.max(0,...samples.map(s=>s.peakChromiumRssBytes)),peakAttributableRssSumBytes:Math.max(0,...samples.map(s=>s.peakAttributableRssSumBytes)),peakBrowserProcesses:Math.max(0,...samples.map(s=>s.peakBrowserProcesses)),minimumDiskAvailableBytes:Math.min(...samples.map(s=>s.minimumDiskAvailableBytes)),memoryPressureSamples:{},semantics:samples[0]?.semantics||'not available'};
 // Fixed numeric prefix of the monitor CSV; a quoted error message is the last column.
 for(const file of fs.readdirSync(output).filter(f=>/^resource-monitoring.*\.csv$/.test(f)))for(const line of fs.readFileSync(path.join(output,file),'utf8').trim().split('\n').slice(1)){const v=line.split(',').slice(0,10).map(x=>x.replace(/^"|"$/g,''));const pressure=v[8]||'unknown';resources.memoryPressureSamples[pressure]=(resources.memoryPressureSamples[pressure]||0)+1;}
 const timings={collectionWallSeconds:(manifest.executions||[]).filter(e=>e.endedAt).reduce((n,e)=>n+(Date.parse(e.endedAt)-Date.parse(e.startedAt))/1000,0),legacyExecutionWindowSeconds:rows.length?(Math.max(...rows.map(r=>Date.parse(r.endedAt)))-Date.parse(manifest.startedAt))/1000:null,meanAttemptSeconds:Number.isFinite(stats.averageAttemptMs)?stats.averageAttemptMs/1000:null,medianAttemptSeconds:Number.isFinite(stats.medianAttemptMs)?stats.medianAttemptMs/1000:null};
 timings.p95AttemptSeconds=percentile(rows.map(r=>r.durationMs/1000),0.95);timings.percentileMethod='linear interpolation at (n-1)*p, matching pandas quantile default';
 const requestComparisons=comparisons.filter(c=>c.comparableFinalNavigation&&Number.isFinite(c.requestCountDelta));agreement.requests={pairs:requestComparisons.length,equal:requestComparisons.filter(c=>c.requestCountDelta===0).length,different:requestComparisons.filter(c=>c.requestCountDelta!==0).length,meanExtensionMinusCDP:requestComparisons.length?requestComparisons.reduce((n,c)=>n+c.requestCountDelta,0)/requestComparisons.length:null,note:'Identifiable final document and available counts, matching Python request_eligible. Different observation windows; descriptive count differences, not confirmed defects.'};
 const finalHosts=rows.filter(r=>finalResponse(r)).map(r=>new URL(finalResponse(r).url).hostname.replace(/^www\./,''));
 const review=require('./review.cjs').review(rows,comparisons);
 const checksums=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(output,'records',file)))]));
 atomicJson(path.join(output,'record-integrity.json'),checksums);
 atomicJson(path.join(output,'cdp-comparisons.json'),comparisons);
 atomicJson(path.join(output,'benchmark-statistics.json'),{generatedAt:new Date().toISOString(),sourceHash:manifest.sourceHash,corpusSha256:identity.txtSha256,complete:rows.length===1000,stats,operations,agreement,resources,timings,uniqueFinalResponseHostnames:new Set(finalHosts).size,finalResponseSamples:finalHosts.length,confirmedBrowserGuardBugs:null,bugReview:'Anomalies remain hypotheses unless separately reproduced; no automatic confirmation.',categoryStats});
 atomicJson(path.join(output,'provenance.json'),rows.map(r=>({...byId.get(r.id),recordSha256:checksums[r.id+'.json']})));
 atomicJson(path.join(output,'manual-investigations.json'),review.groups);
 atomicJson(path.join(output,'anomaly-review.json'),review);
 csv(path.join(output,'categories.csv'),['category','label','planned','tested','captured','successful','restricted','navigationErrors','timeoutSites','averageAttemptMs','medianAttemptMs','anomalyEvents'],categoryStats);
 const cdpRows=comparisons.map(c=>({id:c.websiteId,matchedDocument:c.comparableFinalNavigation,cdpRequests:c.cdpTotalRequests,extensionRequests:c.extensionTotalRequests,delta:c.requestCountDelta,headerPairs:c.headers.length,headerDifferences:c.headers.filter(h=>!h.equal).length,cdpHTTPS:c.protocol.cdpUsesHTTPS,extensionHTTPS:c.protocol.extensionUsesHTTPS}));
 csv(path.join(output,'cdp-comparisons.csv'),['id','matchedDocument','cdpRequests','extensionRequests','delta','headerPairs','headerDifferences','cdpHTTPS','extensionHTTPS'],cdpRows);
 console.log(JSON.stringify({stats,operations,agreement,resources,timings},null,2));
 return {manifest,corpus,rows,stats,operations,agreement,resources,timings,categoryStats};
}
if(require.main===module){try{main();}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={main,consistency,percentile};
