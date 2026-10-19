// Live extension integration: controlled local page, profile isolation, concurrency and resume.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
async function invoke(args){
  const child=spawn(process.execPath,[path.join(__dirname,'run.cjs'),...args],{stdio:'inherit',env:process.env});
  const timer=setTimeout(()=>child.kill('SIGTERM'),90000);
  try {const exit=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});assert.equal(exit,0);}
  finally{clearTimeout(timer);}
}
async function main(){
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'none'",'X-Content-Type-Options':'nosniff'});
    res.end('<!doctype html><title>BrowserGuard local fixture</title><h1>Local fixture</h1><form><input type="password"></form>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg-live-smoke-'));
  try {
    for(const count of [1,2]){
      const run=path.join(dir,'run-'+count),file=path.join(dir,'urls-'+count+'.txt');
      fs.writeFileSync(file,Array.from({length:count},(_,i)=>`http://127.0.0.1:${server.address().port}/${i}?token=must-not-persist`).join('\n'));
      const args=['--urls',file,'--limit',String(count),'--concurrency',String(count),'--output',run];
      await invoke(args);
      const records=JSON.parse(fs.readFileSync(path.join(run,'dataset.json')));
      assert.equal(records.length,count);
      for(const r of records){
        assert.equal(r.status,'ok');assert.equal(r.extension.displayed.security.label,'High');
        assert.equal(r.extension.inputs.pageAnalysis.passwordFieldCount,1);
        assert.equal(r.extension.inputs.webSecurity.headers.csp.present,true);
        assert.ok(r.independent.totalRequests>=1);assert.equal(r.anomalies.length,0,JSON.stringify(r.anomalies));
        assert.ok(!JSON.stringify(r).includes('must-not-persist'));
      }
      const files=fs.readdirSync(path.join(run,'records'));
      const mtimes=files.map(f=>fs.statSync(path.join(run,'records',f)).mtimeMs);
      await invoke([...args,'--resume']);
      assert.deepEqual(files.map(f=>fs.statSync(path.join(run,'records',f)).mtimeMs),mtimes,'Resume revisited completed records');
    }
    console.log('PASS real extension, concurrency 1/2, exact active tabs, redaction and resume: '+dir);
  } finally {server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
