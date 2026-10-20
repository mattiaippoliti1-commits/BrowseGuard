// One-worker large benchmark. Reuses original visit()/popup/CDP semantics unchanged.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {visit}=require('../run.cjs'),{defaults}=require('../config.cjs'),{atomicJson}=require('../storage.cjs'),{report}=require('../report.cjs');
const {EXPECTED,sha,guardProduction,loadCorpus,recordValid,outcomes}=require('./core.cjs');
const {createMonitor}=require('./resources.cjs');
const root=path.resolve(__dirname,'../../..');
function args(argv){const o={phase:'main',resume:false,minDiskGb:5,maxBrowserProcesses:100,processGrowthSamples:3,sampleIntervalMs:15000};for(let i=0;i<argv.length;i++){
 const k=argv[i];if(k==='--resume'){o.resume=true;continue;}const key={'--phase':'phase','--output':'output','--min-disk-gb':'minDiskGb','--max-browser-processes':'maxBrowserProcesses','--process-growth-samples':'processGrowthSamples','--sample-interval-ms':'sampleIntervalMs'}[k];if(!key||!argv[i+1])throw Error('Unknown/incomplete flag '+k);o[key]=['phase','output'].includes(key)?argv[++i]:Number(argv[++i]);}
 if(!['main','smoke'].includes(o.phase))throw Error('phase must be main or smoke');for(const k of ['minDiskGb','maxBrowserProcesses','processGrowthSamples','sampleIntervalMs'])if(!Number.isFinite(o[k])||o[k]<=0)throw Error('Positive resource limit required: '+k);
 o.output=path.resolve(o.output||path.join(__dirname,'../runs',o.phase==='smoke'?'benchmark1000-smoke':'benchmark1000'));return o;}
function harnessHash(){const own=['run.cjs','core.cjs','resources.cjs'].map(f=>path.join(__dirname,f)),shared=['run.cjs','collect.cjs','validate.cjs','storage.cjs','report.cjs','config.cjs','package.json','package-lock.json'].map(f=>path.join(__dirname,'..',f));return sha([...own,...shared].map(f=>path.basename(f)+'\n'+fs.readFileSync(f)).join('\n'));}
async function launch(config,profiles){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'browserguard-large-'));profiles.add(profile);let context;
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,acceptDownloads:false,timeout:config.analysisTimeoutMs,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
  const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background/service-worker.js'))||await context.waitForEvent('serviceworker',{timeout:config.analysisTimeoutMs});
  const ready=await worker.evaluate(async()=>{await allStatesReady;return chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)&&chrome.webRequest.onHeadersReceived.hasListener(handleHeadersReceived);});
  if(!ready)throw Error('Extension listeners not ready');
  for(const p of context.pages())await p.close();
  return {context,worker,profile};
 }catch(e){if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});profiles.delete(profile);throw e;}
}
async function main(argv=process.argv.slice(2)){
 const o=args(argv),source=guardProduction(),{corpus,identity}=loadCorpus();
 const sites=o.phase==='smoke'?corpus.sites.slice(0,20):corpus.sites;
 if(o.phase==='smoke'&&new Set(sites.map(s=>s.category)).size!==10)throw Error('Smoke must include two sites per category');
 const config={...defaults,concurrency:1,limit:sites.length,output:o.output,urlsFile:path.resolve(__dirname,'../datasets/benchmark1000.txt')};
 const limits={minDiskBytes:o.minDiskGb*1024**3,maxBrowserProcesses:o.maxBrowserProcesses,processGrowthSamples:o.processGrowthSamples,sampleIntervalMs:o.sampleIntervalMs};
 const signature=sha(JSON.stringify({config,limits,identity,phase:o.phase,urls:sites.map(s=>s.url)})),harness=harnessHash();
 if(o.phase==='main'){
  const smoke=path.join(__dirname,'../runs/benchmark1000-smoke'),proofFile=path.join(smoke,'smoke-verification.json');
  if(!fs.existsSync(proofFile))throw Error('SMOKE_GATE requires a completed real interruption/resume smoke proof');
  const proof=JSON.parse(fs.readFileSync(proofFile));
  if(!proof.passed||proof.sourceHash!==EXPECTED||proof.corpusSha256!==identity.txtSha256||proof.harnessHash!==harness)throw Error('SMOKE_GATE proof differs from current source/corpus/harness');
  for(const k of ['navigationTimeoutMs','analysisTimeoutMs','minObserveMs','quietMs','maxObserveMs','delayMs','maxRequests','headless','recycleEvery','concurrency'])if(proof.config[k]!==config[k])throw Error('SMOKE_GATE changed methodology: '+k);
  if(JSON.stringify(proof.limits)!==JSON.stringify(limits))throw Error('SMOKE_GATE changed resource limits');
  for(const [file,hash]of Object.entries(proof.recordHashes))if(sha(fs.readFileSync(path.join(smoke,'records',file)))!==hash)throw Error('SMOKE_GATE smoke record mutated');
 }

 fs.mkdirSync(o.output,{recursive:true,mode:0o700});fs.mkdirSync(path.join(o.output,'records'),{recursive:true,mode:0o700});
 const lock=path.join(o.output,'.lock'),fd=fs.openSync(lock,'wx',0o600);fs.writeSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
 const manifestFile=path.join(o.output,'manifest.json'),profiles=new Set();let manifest,browser,timer,monitor,stopping=false,reason=null,fatal=null,completed=0;
 const stop=signal=>{stopping=true;reason=reason||signal;console.log('STOP requested:',reason);};
 const interrupt=()=>stop('signal-interruption');process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 const session={startedAt:new Date().toISOString(),pid:process.pid};
 const checkpoint=()=>atomicJson(path.join(o.output,'checkpoint.json'),{updatedAt:new Date().toISOString(),completed,planned:sites.length,sourceHash:EXPECTED,corpusSha256:identity.txtSha256,signature,harnessHash:harness,interrupted:stopping,reason,fatalError:fatal?.message||null});
 async function closeBrowser(){if(!browser)return;try{await browser.context.close();}finally{fs.rmSync(browser.profile,{recursive:true,force:true});profiles.delete(browser.profile);browser=null;}}
 function guard(){guardProduction();const current=loadCorpus().identity;if(JSON.stringify(current)!==JSON.stringify(identity))throw Error('CORPUS_IDENTITY_CHANGED');if(harnessHash()!==harness)throw Error('HARNESS_CHANGED');}
 try{
  if(fs.existsSync(manifestFile)){
   if(!o.resume)throw Error('Existing benchmark requires --resume');manifest=JSON.parse(fs.readFileSync(manifestFile));
   if(manifest.signature!==signature||manifest.sourceHash!==EXPECTED||manifest.harnessHash!==harness)throw Error('Resume rejected: source, corpus, config, limits or harness changed');
  }else{
   if(o.resume)throw Error('Resume requested without existing manifest');
   const version=execFileSync(chromium.executablePath(),['--version'],{encoding:'utf8'}).trim();if(!/\b145\./.test(version))throw Error('Expected validated Chromium 145, got '+version);
   manifest={schemaVersion:1,type:'browserguard-large-benchmark',startedAt:session.startedAt,signature,sourceHash:EXPECTED,sourceFiles:source.files,harnessHash:harness,corpus:identity,config,limits,urlCount:sites.length,phase:o.phase,aiEnabled:false,cdpEnabled:true,gitCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,playwright:require('playwright/package.json').version,browserVersion:version,platform:process.platform,arch:process.arch,physicalRamBytes:os.totalmem(),executions:[]};atomicJson(manifestFile,manifest);
  }
  manifest.executions.push(session);atomicJson(manifestFile,manifest);
  const pending=[];for(const site of sites){const file=path.join(o.output,'records',site.id+'.json');if(fs.existsSync(file)){try{recordValid(JSON.parse(fs.readFileSync(file)),site,manifest);}catch(e){throw Error('CORRUPT_OR_INVALID_COMPLETED_RECORD: '+file+'; '+e.message);}completed++;}else pending.push(site);}
  const extras=fs.readdirSync(path.join(o.output,'records')).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)&&!sites.some(s=>f===s.id+'.json'));if(extras.length)throw Error('Unexpected records not in frozen corpus');
  monitor=createMonitor(o.output,limits,(r,s)=>{if(!stopping)atomicJson(path.join(o.output,'resource-stop.json'),{reason:r,sample:s});stop(r);});timer=monitor.start();checkpoint();
  for(let n=0;n<pending.length&&!stopping;n++){
   if(n%25===0){guard();await closeBrowser();if(stopping)break;browser=await launch(config,profiles);checkpoint();console.log('BATCH ready:',completed,'/',sites.length);}
   const site=pending[n];const r=await visit(browser,site.url,config,manifest);
   if(guardProduction().hash!==r.sourceHash)throw Error('Production changed during collection');
   r.category=site.category;r.categoryLabel=site.categoryLabel;r.benchmarkOutcome=outcomes(r);
   atomicJson(path.join(o.output,'records',r.id+'.json'),r);
   recordValid(JSON.parse(fs.readFileSync(path.join(o.output,'records',r.id+'.json'))),site,manifest);completed++;
   console.log('RECORD',completed,site.category,r.status,site.url);
   if(completed%25===0)checkpoint();
   if(!stopping)await new Promise(resolve=>setTimeout(resolve,config.delayMs));
  }
 }catch(e){fatal=e;stop(e.message);}
 finally{
  if(timer)clearInterval(timer);
  try{await closeBrowser();}catch(e){fatal=fatal||e;stop('browser-cleanup-error');}
  for(const profile of profiles)fs.rmSync(profile,{recursive:true,force:true});
  if(monitor){monitor.sample();atomicJson(path.join(o.output,'resource-statistics-'+Date.now()+'.json'),monitor.stats);}
  if(manifest){session.endedAt=new Date().toISOString();session.completedRecords=completed;session.stopped=stopping;session.reason=reason;session.error=fatal?.message||null;atomicJson(manifestFile,manifest);checkpoint();
   const provenance=sites.filter(s=>fs.existsSync(path.join(o.output,'records',s.id+'.json'))).map(s=>({id:s.id,url:s.url,category:s.category,source:s.source}));atomicJson(path.join(o.output,'provenance.json'),provenance);
   try{await report(o.output);}catch(e){fatal=fatal||e;reason=reason||'report-generation-failed';checkpoint();}
  }
  process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);fs.closeSync(fd);fs.unlinkSync(lock);
 }
 console.log(JSON.stringify({completed,planned:sites.length,reason,fatalError:fatal?.message||null,output:o.output}));
 if(fatal)throw fatal;if(stopping)process.exitCode=130;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={args,harnessHash,main};
