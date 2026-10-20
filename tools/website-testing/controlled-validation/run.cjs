const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./scenarios.cjs');
const {environment}=require('./environment.cjs');
const {scenarios}=require('./scenarios.cjs');
const {independentCollector,extractPopup}=require('../collect.cjs');
const {atomicJson}=require('../storage.cjs');
const {fingerprint}=require('../run.cjs');
const {cases,runCase}=require('./engine-cases.cjs');
const {evaluate}=require('./evaluate.cjs');
const {report}=require('./report.cjs');
const root=path.resolve(__dirname,'../../..');
function options(argv){
 const o={output:path.join(__dirname,'output-'+new Date().toISOString().replace(/[:.]/g,'-')),timeout:15000,observe:1500,requireComplete:false,'tls-mode':'profile'};
 for(let n=0;n<argv.length;n++) {
   const k=argv[n];
   if(k==='--require-complete'){o.requireComplete=true;continue;}
   if(!['--output','--cert','--key','--scenario','--timeout','--observe','--tls-mode'].includes(k))throw Error('Unknown option '+k);
   const v=argv[++n];if(!v || v.startsWith('--'))throw Error('Missing value for '+k);
   o[k.slice(2)]=v;
 }
 for(const k of ['timeout','observe']){o[k]=Number(o[k]);if(!Number.isFinite(o[k])||o[k]<100||o[k]>120000)throw Error(k+' must be 100..120000 ms');}
 if(Boolean(o.cert)!==Boolean(o.key))throw Error('Provide both --cert and --key');
 if(!['profile','untrusted','provided'].includes(o['tls-mode']))throw Error('tls-mode must be profile, untrusted or provided');
 if(o.cert)o['tls-mode']='provided';
 if(o['tls-mode']==='provided'&&!o.cert)throw Error('provided TLS mode requires --cert and --key');
 if(o.scenario&&!scenarios.some(s=>s.id===o.scenario))throw Error('Unknown scenario '+o.scenario);
 o.output=path.resolve(o.output);return o;
}
async function launch(o,run,caFile){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bg-controlled-profile-'));
 let context;
 try {
   if(caFile){
     const version=execFileSync(chromium.executablePath(),['--version'],{encoding:'utf8'});
     const major=version.match(/(\d+)\.\d+\.\d+\.\d+/)?.[1];
     execFileSync('python3',[path.join(__dirname,'profile_trust.py'),'--profile',profile,'--ca',caFile,'--chromium-major',major||'0'],{stdio:'pipe'});
   }
   context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,acceptDownloads:false,
     timeout:o.timeout,ignoreDefaultArgs:['--disable-extensions'],
     args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--host-resolver-rules=MAP assets.controlled.test 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
   run.environment.chromium=context.browser()?.version() || run.environment.chromium;
   await context.route(/^https?:/,route=>['127.0.0.1','localhost','assets.controlled.test'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('blockedbyclient'));
   const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background/service-worker.js')) || await context.waitForEvent('serviceworker',{timeout:o.timeout});
   const ready=await worker.evaluate(async()=>{await allStatesReady;return chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)&&chrome.webRequest.onHeadersReceived.hasListener(handleHeadersReceived);});
   if(!ready)throw Error('Extension listeners not ready');
   return {context,worker,profile,async close(){try{await context.close();}finally{fs.rmSync(profile,{recursive:true,force:true});}}};
 } catch(e){if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});throw e;}
}
async function observe(browser,page,url,o){
 const collector=await independentCollector(browser.context,page,500);
 const record={url,independent:collector.data};
 try {
   try{const response=await page.goto(url,{waitUntil:'load',timeout:o.timeout});record.httpStatus=response?.status()??null;record.tls=response?await response.securityDetails():null;}
   catch(e){record.navigationError=e.message;}
   await collector.settle({minObserveMs:o.observe,maxObserveMs:o.observe+1000,quietMs:300});
   record.pageEvidence=await page.evaluate(()=>window.fixtureEvidence||null).catch(()=>null);
   record.resourceExecuted=await page.evaluate(()=>window.fixtureResourceExecuted||0).catch(()=>0);
   if(!record.navigationError)record.extension=await extractPopup(browser.context,browser.worker,page,{analysisTimeoutMs:o.timeout});
   return record;
 }finally{await collector.stop();}
}
async function main(argv=process.argv.slice(2)){
 const o=options(argv);
 fs.mkdirSync(o.output,{recursive:true,mode:0o700});
 // Never silently overwrite evidence from a previous run.
 if(fs.existsSync(path.join(o.output,'results.json')))throw Error('Output contains results; select a new --output directory.');
 const lock=path.join(o.output,'.lock');const fd=fs.openSync(lock,'wx',0o600);
 const run={schemaVersion:1,kind:'controlled-validation',startedAt:new Date().toISOString(),
   environment:{node:process.version,platform:process.platform,arch:process.arch,playwright:require('playwright/package.json').version},
   configuration:{timeoutMs:o.timeout,observeMs:o.observe,concurrency:1,trustedCertificateSupplied:Boolean(o.cert),tlsMode:o['tls-mode'],trustStore:o['tls-mode']==='profile'?'Disposable profile Default/ServerCertificate, schema v1; localhost and 127.0.0.1/32 only':'Existing browser trust or untrusted control'},
   harnessFingerprint:crypto.createHash('sha256').update(['run.cjs','environment.cjs','scenarios.cjs','evaluate.cjs','engine-cases.cjs','report.cjs','profile_trust.py','certificates.cjs'].map(f=>f+'\n'+fs.readFileSync(path.join(__dirname,f))).join('\n')).digest('hex'),
   sourceBefore:fingerprint(),scenarios:[],engine:[],tlsControls:[],cleanup:{profilesRemoved:true,contextsClosed:true,serversClosed:false}};
 let env,negative,browser,interrupted=false;
 const stop=()=>{interrupted=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
   for(const c of cases){try{runCase(c);run.engine.push({name:c.name,status:'PASS',expected:c.expected});}catch(e){run.engine.push({name:c.name,status:'FAIL',expected:c.expected,error:e.message});}}
   env=await environment({...o,profileTrust:o['tls-mode']==='profile'});
   run.certificate=env.certificate;
   if(env.caFile){
     browser=await launch(o,run);
     const clean=await browser.context.newPage();let error;
     try{await clean.goto(env.urls.https+'/scenario/S01',{timeout:o.timeout});}catch(e){error=e.message;}
     const rejected=Boolean(error&&/ERR_CERT_/.test(error));
     run.tlsControls.push({name:'generated CA rejected by clean profile',pass:rejected,error:error||null});
     if(!rejected)throw Error('Generated CA unexpectedly trusted outside the seeded profile');
     await browser.close();browser=null;
   }
   // A distinct untrusted leaf proves TLS validation has not been disabled, even with a supplied trusted fixture certificate.
   negative=await environment();browser=await launch(o,run,env.caFile);
   const positivePage=await browser.context.newPage();
   try{
     const response=await positivePage.goto(env.urls.https+'/scenario/S01',{timeout:o.timeout});
     const details=await response.securityDetails();
     const pass=response.status()===200&&Boolean(details?.protocol);
     run.tlsControls.push({name:'fixture certificate accepted',pass,httpStatus:response.status(),securityDetails:details});
     if(!pass)throw Error('Positive TLS control did not establish TLS');
   }catch(e){
     run.tlsControls.push({name:'fixture certificate accepted',pass:false,error:e.message});
     if(o['tls-mode']!=='untrusted')throw e;
   }
   const probe=await browser.context.newPage();let rejection;
   try{await probe.goto(negative.urls.https+'/scenario/S01',{timeout:o.timeout});}
   catch(e){rejection=e.message;}
   const tlsRejected=Boolean(rejection && /ERR_CERT_/.test(rejection));
   run.tlsControls.push({name:'independent untrusted leaf rejected',pass:tlsRejected,error:rejection||null});
   if(!tlsRejected)throw Error('Negative TLS control did not reject the untrusted leaf; refusing to run scenarios.');
   await browser.close();browser=null;await negative.close();negative=null;
   for(const s of scenarios.filter(s=>!o.scenario||s.id===o.scenario)){
     if(interrupted)break;
     const start=Date.now(),offset=env.receipts.length;
     let r={...s,startedAt:new Date().toISOString(),checks:[]};
     try{
       browser=await launch(o,run,env.caFile);
       const page=await browser.context.newPage();
       if(s.id==='S18')r.before=(await observe(browser,page,env.urls.http+'/scenario/A',o)).extension;
       const url=s.id==='S17'?'about:blank':(s.tls?env.urls.https:env.urls.http)+'/scenario/'+s.id;
       Object.assign(r,await observe(browser,page,url,o));
       r.serverReceipts=env.receipts.slice(offset);
       const configured=fixture(s.id,env.urls);
       r.fixture={headers:configured.headers,scriptURLs:[...configured.html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1])};
       if(s.tls && /ERR_CERT_/.test(r.navigationError||'')){
         r.status='SKIPPED';r.reason='Trusted local TLS prerequisite absent. Browser certificate rejection retained; no trust exceptions or protection overrides used.';
       }else Object.assign(r,evaluate(s,r));
     }catch(e){r.status='INCONCLUSIVE';r.reason=e.message;}
     finally{
       if(browser){try{await browser.close();}catch(e){run.cleanup.contextsClosed=false;run.cleanup.profilesRemoved=false;r.cleanupError=e.message;}browser=null;}
     }
     r.durationMs=Date.now()-start;r.endedAt=new Date().toISOString();run.scenarios.push(r);
     run.sourceAfter=fingerprint();report(o.output,run);
     console.log(`${s.id} ${r.status}${r.reason?' '+r.reason:''}`);
   }
   if(interrupted)run.interrupted=true;
 }catch(e){run.fatalError=e.message;}
 finally{
   if(browser)await browser.close().catch(e=>{run.cleanup.contextsClosed=false;run.cleanup.error=e.message;});
   if(negative)await negative.close();
   if(env){await env.close();run.cleanup.serversClosed=true;}
   run.sourceAfter=fingerprint();run.endedAt=new Date().toISOString();
   report(o.output,run);
   fs.closeSync(fd);fs.unlinkSync(lock);
   process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
 }
 const bad=run.fatalError||interrupted||run.sourceBefore.hash!==run.sourceAfter.hash||run.engine.some(r=>r.status==='FAIL')||Object.values(run.cleanup).some(v=>v===false)||run.scenarios.some(r=>['FAIL','INCONCLUSIVE'].includes(r.status))||o.requireComplete&&run.scenarios.some(r=>r.status!=='PASS');
 console.log(JSON.stringify({statistics:run.statistics,engineCases:run.engine.length,fatalError:run.fatalError||null,report:path.join(o.output,'CONTROLLED_VALIDATION.md')},null,2));
 if(bad)process.exitCode=1;
 return run;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={options,main,launch,observe};
