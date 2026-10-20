// Additional live DOM regression; no form is submitted and no field value is read.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),https=require('node:https');
const {generate}=require('./certificates.cjs');
const {launch,observe}=require('./run.cjs');
const {fingerprint}=require('../run.cjs');
const {atomicJson}=require('../storage.cjs');
async function main(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bg-controlled-tls-'));
 const servers=[],rows=[],source=fingerprint();let browser;
 const run={environment:{}};
 try{
  const material=generate(directory);
  const handler=(req,res)=>{
   const protocol=req.socket.encrypted?'https':'http',host=req.headers.host;
   const sameHttp='http://localhost:'+servers[0].address().port+'/submit';
   const sameHttps='https://localhost:'+servers[1].address().port+'/submit';
   const actions=[null,'','/submit',sameHttp,sameHttps];
   const forms=actions.map(action=>'<form'+(action===null?'':` action="${action}"`)+'><input type="password" autocomplete="off"></form>').join('');
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
   res.end('<!doctype html><title>Controlled password defaults</title><link rel="icon" href="data:,"><h1>'+protocol+' '+host+'</h1>'+forms+'<form><input type="text"></form>');
  };
  servers.push(http.createServer(handler),https.createServer({key:fs.readFileSync(material.key),cert:fs.readFileSync(material.cert)},handler));
  servers[1].on('tlsClientError',()=>{});
  for(const server of servers)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  for(const protocol of ['http','https']){
   browser=await launch({timeout:15000},run,material.ca);
   const page=await browser.context.newPage();
   const port=servers[protocol==='http'?0:1].address().port;
   const r=await observe(browser,page,`${protocol}://localhost:${port}/forms`,{timeout:15000,observe:500});
   const native=await page.evaluate(()=>[...document.forms].map(f=>({actionAttribute:f.getAttribute('action'),resolvedAction:f.action,password:!!f.querySelector('input[type="password"]')})));
   const expected=protocol==='http'?4:1,p=r.extension?.inputs.pageAnalysis;
   const pass=!r.navigationError&&p?.formCount===6&&p.passwordFieldCount===5&&p.insecurePasswordForms===expected&&native.filter(f=>f.password&&new URL(f.resolvedAction).protocol==='http:').length===expected;
   rows.push({protocol,status:pass?'PASS':'FAIL',expectedInsecure:expected,native,observation:r});
   await browser.close();browser=null;
  }
 }finally{
  if(browser)await browser.close();
  await Promise.all(servers.map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));
  fs.rmSync(directory,{recursive:true,force:true});
 }
 const result={sourceHash:source.hash,sourceAfter:fingerprint().hash,cases:rows,cleanup:{contextsClosed:true,serversClosed:true,certificatesRemoved:true}};
 const output=path.resolve(process.argv[2]||path.join(__dirname,'output','password-live.json'));
 atomicJson(output,result);console.log(JSON.stringify(rows.map(r=>({protocol:r.protocol,status:r.status,expected:r.expectedInsecure,observed:r.observation.extension?.inputs.pageAnalysis?.insecurePasswordForms})),null,2));
 if(rows.some(r=>r.status!=='PASS')||result.sourceHash!==result.sourceAfter)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
