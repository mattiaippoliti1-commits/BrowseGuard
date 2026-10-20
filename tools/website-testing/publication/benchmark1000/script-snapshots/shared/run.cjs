const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { configFromArgs, idFor } = require('./config.cjs');
const { atomicJson, redact } = require('./storage.cjs');
const { independentCollector, extractPopup } = require('./collect.cjs');
const { validate } = require('./validate.cjs');
const { report } = require('./report.cjs');
const root = path.resolve(__dirname,'../..');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function fingerprint() {
  const files = ['manifest.json','data/tracker-data.js', ...['background','content','modules','popup'].flatMap(dir => {
    function walk(d) { return fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]); }
    return walk(dir);
  })];
  const hashes = Object.fromEntries(files.sort().map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
  return { files: hashes, hash: crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex') };
}
function harnessFingerprint() {
  const files = ['config.cjs','storage.cjs','collect.cjs','validate.cjs','report.cjs','run.cjs','package.json','package-lock.json'];
  return crypto.createHash('sha256').update(files.map(f => f + '\n' + fs.readFileSync(path.join(__dirname,f))).join('\n')).digest('hex');
}
async function launch(config, profiles) {
  const { chromium } = require('playwright');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'browserguard-field-')); profiles.add(profile);
  const context = await chromium.launchPersistentContext(profile, { channel:'chromium', headless:config.headless,
    acceptDownloads:false, timeout:config.analysisTimeoutMs,
    ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`] });
  try {
    const worker = context.serviceWorkers().find(w=>w.url().endsWith('/background/service-worker.js')) ||
      await context.waitForEvent('serviceworker',{predicate:w=>w.url().endsWith('/background/service-worker.js'),timeout:config.analysisTimeoutMs});
    const ready = await worker.evaluate(async () => {
      await allStatesReady;
      return chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest) &&
        chrome.webRequest.onHeadersReceived.hasListener(handleHeadersReceived);
    });
    if (!ready) throw Error('BrowserGuard collection listeners are not ready');
    for (const p of context.pages()) await p.close();
    return { context, worker, profile };
  } catch(e) { await context.close(); throw e; }
}
async function visit(browser, url, config, manifest) {
  const start = Date.now();
  const r = { schemaVersion:1, id:idFor(url), url, startedAt:new Date().toISOString(),
    sourceHash:manifest.sourceHash, navigation:{ requestedUrl:url }, extension:null,
    independent:null, collectionError:null, anomalies:[] };
  let page, collector;
  try {
    page = await browser.context.newPage();
    page.setDefaultTimeout(config.analysisTimeoutMs);
    collector = await independentCollector(browser.context,page,config.maxRequests);
    r.independent = collector.data;
    try {
      const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:config.navigationTimeoutMs});
      r.navigation.httpStatus = response?.status() ?? null;
    } catch(e) { r.navigation.error = e.message; }
    await collector.settle(config);
    r.navigation.finalUrl = page.url();
    r.navigation.usesHTTPS = page.url().startsWith('https:');
    // Observe restriction indicators only. No solving, clicking, logins, retries or stealth.
    const title = await page.title().catch(()=> '');
    const restriction = /captcha|access denied|just a moment|verify (?:you are|you're)|checking your browser|sign in|log in/i.test(title);
    if ([401,403,429].includes(r.navigation.httpStatus) || restriction) r.navigation.blocked = {
      httpStatus:r.navigation.httpStatus, titleIndicator:restriction,
      caveat:'Heuristic restriction detection; not an exhaustive anti-bot detector.' };
    r.extension = await extractPopup(browser.context,browser.worker,page,config);
  } catch(e) { r.collectionError = e.message; }
  finally {
    if (collector) await collector.stop();
    if (page) await page.close().catch(()=>{});
  }
  r.durationMs = Date.now()-start; r.endedAt = new Date().toISOString();
  // Validate raw in-memory snapshots before URL query redaction changes any evidence.
  try { r.anomalies = validate(r); }
  catch(e) { r.anomalies = [{code:'validator_failure',priority:'high',classification:'harness-error',evidence:{error:e.message},investigation:'Inspect the harness validator and raw record schema.'}]; }
  r.status = r.anomalies.some(a=>a.code==='validator_failure') ? 'validation-error' : r.collectionError || !r.extension?.assessment ? 'collection-error' : r.navigation.error ? 'navigation-error' :
    r.navigation.blocked ? 'blocked' : r.extension.assessment.dataStatus === 'partial' ? 'partial' : 'ok';
  return redact(r);
}
async function main() {
  const {config,urls,signature,resume} = configFromArgs(process.argv.slice(2));
  fs.mkdirSync(config.output,{recursive:true,mode:0o700});
  const lockFile = path.join(config.output,'.lock');
  let lock;
  try { lock=fs.openSync(lockFile,'wx',0o600); } catch { throw Error('Run directory is locked. If a process crashed, verify it has exited before removing .lock.'); }
  const profiles=new Set(); let stopping=false, cursor=0, fatal=null;
  const stop=()=>{stopping=true;console.log('Stopping after in-flight websites; completed records will be retained.');};
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
  try {
    const source=fingerprint(), harnessHash=harnessFingerprint(), manifestFile=path.join(config.output,'manifest.json');
    let manifest;
    if (fs.existsSync(manifestFile)) {
      if (!resume) throw Error('Output already contains a run; use --resume or a new output directory.');
      manifest=JSON.parse(fs.readFileSync(manifestFile));
      if (manifest.signature!==signature || manifest.sourceHash!==source.hash || manifest.harnessHash!==harnessHash) throw Error('Resume refused: configuration, URL order, extension sources, or harness changed.');
    } else {
      if (resume) throw Error('No manifest exists to resume.');
      let commit=null; try {commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
      manifest={schemaVersion:1,startedAt:new Date().toISOString(),signature,sourceHash:source.hash,harnessHash,sourceFiles:source.files,
        gitCommit:commit,config:{...config,urlsFile:path.basename(config.urlsFile)},urlCount:urls.length,
        node:process.version,platform:process.platform,arch:process.arch,playwright:require('playwright/package.json').version,
        measurementLimitations:['CDP and extension snapshots have different observation windows.','Popup is instrumented in an extension tab, not a toolbar flyout.','Queries/fragments/URL credentials are redacted in saved output.','No response bodies, request headers, cookies, screenshots or page content are recorded.']};
      atomicJson(manifestFile,manifest);
    }
    fs.mkdirSync(path.join(config.output,'records'),{recursive:true,mode:0o700});
    const pending=urls.filter(url=>{
      const id=idFor(url), file=path.join(config.output,'records',id+'.json');
      if (!fs.existsSync(file)) return true;
      const record=JSON.parse(fs.readFileSync(file));
      if (record.id!==id || record.sourceHash!==manifest.sourceHash || record.schemaVersion!==1 || !Array.isArray(record.anomalies))
        throw Error('Invalid completed record: '+file);
      return false;
    });
    async function work(index) {
      let browser;
      try {
        for (let count=0;!stopping && cursor<pending.length;count++) {
          const url=pending[cursor++];
          if (!browser || count%config.recycleEvery===0) {
            if (browser) { await browser.context.close(); fs.rmSync(browser.profile,{recursive:true,force:true}); profiles.delete(browser.profile); }
            browser=await launch(config,profiles);
            console.log(`[worker ${index+1}] BrowserGuard listeners ready`);
            if (!manifest.browserVersion) { manifest.browserVersion=browser.context.browser().version(); atomicJson(manifestFile,manifest); }
          }
          const r=await visit(browser,url,config,manifest);
          atomicJson(path.join(config.output,'records',r.id+'.json'),r);
          console.log(`[worker ${index+1}] ${r.status} ${r.url} (${r.anomalies.length} anomalies)`);
          await sleep(config.delayMs);
        }
      } catch(e) { fatal=e; stopping=true; }
      finally { if(browser) await browser.context.close().catch(()=>{}); }
    }
    await Promise.all(Array.from({length:Math.min(config.concurrency,pending.length)},(_,i)=>work(i)));
    const stats=await report(config.output);
    atomicJson(path.join(config.output,'checkpoint.json'),{updatedAt:new Date().toISOString(),completed:stats.websitesTested,
      planned:urls.length,interrupted:stopping,fatalError:fatal?.message||null});
    console.log(JSON.stringify(stats,null,2));
    if(fatal) throw fatal;
    if(stopping) process.exitCode=130;
  } finally {
    for(const p of profiles) fs.rmSync(p,{recursive:true,force:true});
    process.off('SIGINT',stop);process.off('SIGTERM',stop);
    if(lock!==undefined) {fs.closeSync(lock);fs.unlinkSync(lockFile);}
  }
}
if(require.main===module) main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fingerprint,visit};
