// Actual signal interruption/resume proof, using a frozen, complete corpus only.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {sha,loadCorpus,guardProduction}=require('./core.cjs');
const {atomicJson}=require('../storage.cjs');
const directory=path.resolve(__dirname,'../runs/benchmark1000-smoke');
function files(){return fs.readdirSync(path.join(directory,'records')).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).sort();}
async function execute(resume,interrupt){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(__dirname,'run.cjs'),'--phase','smoke',...(resume?['--resume']:[])],{stdio:['ignore','pipe','inherit'],env:process.env});
  let buffer='',sent=false;
  child.stdout.on('data',chunk=>{process.stdout.write(chunk);buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);const match=line.match(/^RECORD (\d+) /);if(interrupt&&match&&+match[1]>=5&&!sent){sent=true;child.kill('SIGTERM');}}});
  child.on('error',reject);child.on('exit',code=>resolve({code,signalSent:sent}));
 });
}
async function main(){
 guardProduction();const {corpus,identity}=loadCorpus();
 if(fs.existsSync(path.join(directory,'manifest.json')))throw Error('Smoke output exists; do not silently rerun the interruption experiment. Inspect it explicitly.');
 const first=await execute(false,true);if(first.code!==130||!first.signalSent)throw Error('Smoke did not exercise the actual interruption handler');
 const prior=files().map(file=>({file,sha256:sha(fs.readFileSync(path.join(directory,'records',file))),mtimeMs:fs.statSync(path.join(directory,'records',file)).mtimeMs}));
 const checkpoint=JSON.parse(fs.readFileSync(path.join(directory,'checkpoint.json')));if(!checkpoint.interrupted||checkpoint.completed!==prior.length)throw Error('Interrupted checkpoint inconsistent');
 atomicJson(path.join(directory,'resume-proof-before.json'),{first,checkpoint,records:prior});
 const second=await execute(true,false);if(second.code!==0)throw Error('Smoke resume failed');
 for(const r of prior){const file=path.join(directory,'records',r.file);if(sha(fs.readFileSync(file))!==r.sha256||fs.statSync(file).mtimeMs!==r.mtimeMs)throw Error('Resume rewrote a previously completed record');}
 const rows=files().map(file=>JSON.parse(fs.readFileSync(path.join(directory,'records',file))));
 if(rows.length!==20||new Set(rows.map(r=>r.id)).size!==20||rows.some(r=>!r.extension?.assessment||r.collectionError))throw Error('Smoke collection failed; investigate without replacing sites');
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
 const expected=corpus.sites.slice(0,20);if(expected.some(s=>!rows.some(r=>r.id===s.id)))throw Error('Smoke selection mismatch');
 const end=JSON.parse(fs.readFileSync(path.join(directory,'checkpoint.json')));if(end.completed!==20||end.fatalError||end.interrupted)throw Error('Smoke completion checkpoint invalid');
 const proof={passed:true,generatedAt:new Date().toISOString(),sourceHash:manifest.sourceHash,corpusSha256:identity.txtSha256,config:manifest.config,limits:manifest.limits,harnessHash:manifest.harnessHash,interruptedAfter:prior.length,finalRecords:20,previousRecordHashesAndMtimesUnchanged:true,first,second,recordHashes:Object.fromEntries(files().map(file=>[file,sha(fs.readFileSync(path.join(directory,'records',file)))]))};
 atomicJson(path.join(directory,'smoke-verification.json'),proof);console.log('SMOKE AND REAL RESUME VERIFIED');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
