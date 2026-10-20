// Synthetic offline fixtures only: none of these generated URLs enters the real corpus.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CATEGORY_IDS,EXPECTED,validateCorpus,publicHostname,recordValid,outcomes,guardProduction}=require('./core.cjs');
const {idFor}=require('../config.cjs'),{parsePs,attributable,stopReason}=require('./resources.cjs'),{args}=require('./run.cjs');
function corpus(){const sites=Array.from({length:1000},(_,i)=>{const url=`https://case-${i}.corpus-unit.org/`;return {id:idFor(url),url,category:CATEGORY_IDS[i%10],source:'https://www.wikidata.org/wiki/Q1',sourceProperty:'P856',verificationStatus:'synthetic offline fixture'};});return {sites};}
const text=c=>c.sites.map(s=>s.url).join('\n')+'\n';
test('production identity matches the explicitly authorized version',()=>assert.equal(guardProduction().hash,EXPECTED));
test('1000 unique balanced records validate; order hash is stable',()=>{const c=corpus();const a=validateCorpus(c,text(c));assert.equal(a.urls,1000);assert.equal(a.normalizedHostnames,1000);assert.equal(a.txtSha256,validateCorpus(c,text(c)).txtSha256);});
test('incomplete corpus is refused before any browser launch',()=>{const c=corpus();c.sites.pop();assert.throws(()=>validateCorpus(c,text(c)),/exactly 1000/);});
test('duplicate www alias and category imbalance are rejected',()=>{
 const c=corpus();c.sites[1].url=c.sites[0].url.replace('https://','https://www.');c.sites[1].id=idFor(c.sites[1].url);assert.throws(()=>validateCorpus(c,text(c)),/Duplicate/);
 const d=corpus();d.sites[0].category=CATEGORY_IDS[1];assert.throws(()=>validateCorpus(d,text(d)),/quotas/);
});
test('private literals/reserved hosts, credentials and token queries are refused',()=>{
 for(const host of ['localhost','127.0.0.1','10.0.0.1','[::ffff:127.0.0.1]','page.test','router.local'])assert.equal(publicHostname(host),false);
 for(const url of ['http://public.org/','https://127.0.0.1/','https://user:secret@public.org/','https://public.org/?token=fixture']){const c=corpus();c.sites[0].url=url;assert.throws(()=>validateCorpus(c,text(c)));}
});
test('resume validation accepts a completed failed attempt and rejects corruption or version drift',()=>{
 const s=corpus().sites[0],m={sourceHash:EXPECTED},r={schemaVersion:1,id:s.id,url:s.url,sourceHash:EXPECTED,status:'navigation-error',durationMs:12,anomalies:[]};assert.equal(recordValid(r,s,m),true);
 for(const change of [{sourceHash:'other'},{id:'bad'},{anomalies:null},{durationMs:null}])assert.throws(()=>recordValid({...r,...change},s,m),/invalid/);
});
test('RSS is KiB converted to bytes; attribution excludes unrelated browser processes',()=>{
 const rows=parsePs('10 1 100 2.0 node benchmark\n20 10 200 4.0 Google Chrome for Testing --user-data-dir=test\n21 20 300 5.0 Google Chrome Helper\n99 1 9000 99.0 Google Chrome unrelated');
 assert.equal(rows[1].rssBytes,204800);assert.deepEqual(attributable(rows,10).map(r=>r.pid),[20,21]);
});
test('resource stop conditions distinguish critical pressure from warning and persistent growth',()=>{
 const limits={minDiskBytes:5,maxBrowserProcesses:10,processGrowthSamples:3};
 assert.equal(stopReason({diskAvailableBytes:10,memoryPressureLevel:2},limits,0),null);
 assert.match(stopReason({diskAvailableBytes:4,memoryPressureLevel:1},limits,0),/disk/);
 assert.match(stopReason({diskAvailableBytes:10,memoryPressureLevel:4},limits,0),/critical/);
 assert.match(stopReason({diskAvailableBytes:10,memoryPressureLevel:1},limits,3),/persistent/);
});
test('captured assessment, navigation and intended-page verification remain distinct',()=>{
 const x=outcomes({status:'blocked',navigation:{httpStatus:403,blocked:{}},extension:{assessment:{dataStatus:'complete'}}});assert.equal(x.assessmentCaptured,true);assert.equal(x.navigationAccepted,true);assert.equal(x.restriction,true);assert.equal(x.unrestrictedVisit,false);assert.equal(x.intendedPageVerified,false);
 assert.equal(outcomes({status:'ok',navigation:{httpStatus:503}}).unrestrictedVisit,false);
 assert.equal(outcomes({navigation:{error:'net::ERR_NAME_NOT_RESOLVED'}}).dnsError,true);
 assert.equal(outcomes({navigation:{error:'Timeout 25000ms'}}).timeout,true);
});
test('runner refuses concurrency changes and invalid resource limits',()=>{assert.throws(()=>args(['--concurrency','2']),/Unknown/);assert.throws(()=>args(['--min-disk-gb','0']),/Positive/);assert.equal(args(['--phase','smoke']).phase,'smoke');});
test('CDP comparison requires actual protocol evidence and complete retained mixed windows',()=>{
 const {consistency}=require('./analyze.cjs');
 const base={headers:[{extensionPresent:false,equal:true}],protocol:{extensionUsesHTTPS:true,cdpUsesHTTPS:null},comparableFinalNavigation:true,droppedRequestDetails:1,mixedContent:{extensionAttemptCount:0,cdpAttemptCount:0}};
 let result=consistency([base]);assert.equal(result.protocol.pairs,0);assert.equal(result.mixed.pairs,0);assert.equal(result.headers.pairs,1);
 result=consistency([{...base,droppedRequestDetails:0,protocol:{extensionUsesHTTPS:true,cdpUsesHTTPS:true}}]);assert.equal(result.protocol.equal,1);assert.equal(result.mixed.equal,1);assert.equal(result.mixed.cdpPositive,0);
});
