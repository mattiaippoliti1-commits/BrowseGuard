const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,scenarios}=require('./scenarios.cjs');
const {options}=require('./run.cjs');
const {evaluate}=require('./evaluate.cjs');
const {report}=require('./report.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('configuration rejects invalid selection, timeout and incomplete TLS pair',()=>{
 for(const args of [['--scenario','S99'],['--timeout','NaN'],['--observe','-1'],['--cert','test'],['--output'],['--unknown']])assert.throws(()=>options(args));
 assert.equal(options(['--scenario','S18','--require-complete']).requireComplete,true);
});
test('mixed-content fixtures have no competing CSP and distinct HTTP targets',()=>{
 const urls={http:'http://127.0.0.1:42',externalHttp:'http://assets.controlled.test:42'};
 for(const id of ['S06','S07'])assert.equal(fixture(id,urls).headers['Content-Security-Policy'],undefined);
 assert.match(fixture('S06',urls).html,/127\.0\.0\.1:42/);
 assert.match(fixture('S07',urls).html,/assets\.controlled\.test:42/);
});
test('counter scenario actually configures 24 distinct executable resources',()=>{
 const f=fixture('S11',{externalHttp:'http://assets.controlled.test:42'});
 const urls=[...f.html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(urls).size,24);assert.equal(f.headers['Content-Security-Policy'],undefined);
});
test('missing actual extension output is INCONCLUSIVE, never a fabricated PASS',()=>{
 assert.equal(evaluate(scenarios[0],{extension:null}).status,'INCONCLUSIVE');
});
test('report preserves status denominators and CSV escaping',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg-controlled-report-'));
 try{
   const rows=['PASS','FAIL','NOT_OBSERVABLE','INCONCLUSIVE','SKIPPED'].map((status,n)=>({id:'S0'+n,name:'=unsafe,formula',status,category:'runtime',checks:[],expectation:'literal',durationMs:0}));
   const source={hash:'identical'};
   const stats=report(dir,{startedAt:'test',scenarios:rows,environment:{},sourceBefore:source,sourceAfter:source,engine:[],cleanup:{}});
   assert.equal(stats.executed,4);assert.equal(stats.passPercentAll,20);assert.equal(stats.passPercentExecuted,25);
   assert.match(fs.readFileSync(path.join(dir,'results.csv'),'utf8'),/'=unsafe,formula/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a CDP-only blocked attempt is NOT_OBSERVABLE, while a contradictory counter remains FAIL',()=>{
 const scenario=scenarios.find(s=>s.id==='S07');
 const r={url:'https://localhost/scenario/S07',resourceExecuted:0,serverReceipts:[],fixture:{scriptURLs:['http://assets.controlled.test/resource/S07/0.js']},independent:{requests:[{url:'http://assets.controlled.test/resource/S07/0.js'}],failures:[{blockedReason:'mixed-content'}]},
   extension:{activeTab:{url:'https://localhost/scenario/S07'},inputs:{networkActivity:{totalRequests:1,firstPartyRequests:1,thirdPartyRequests:0,sameEntityThirdPartyRequests:0,externalThirdPartyRequests:0,unknownThirdPartyRequests:0,trackerRequests:0,trackerDomainCount:0},pageAnalysis:{},webSecurity:{mixedContent:{requestCount:0}},runtimePrivacy:{}},assessment:{dataStatus:'complete',missingSources:[]}}};
 assert.equal(evaluate(scenario,r).status,'NOT_OBSERVABLE');
 r.extension.inputs.networkActivity.totalRequests=9;
 assert.equal(evaluate(scenario,r).status,'FAIL');
});
