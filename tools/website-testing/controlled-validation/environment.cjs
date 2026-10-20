const http=require('node:http'), https=require('node:https'), fs=require('node:fs');
const path=require('node:path'), os=require('node:os'), {execFileSync}=require('node:child_process');
const {fixture}=require('./scenarios.cjs');
async function environment(options={}) {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bg-controlled-tls-'));
 const receipts=[], servers=[], urls={};
 async function close() {
   await Promise.all(servers.map(s=>new Promise(r=>{s.close(r);s.closeAllConnections();})));
   fs.rmSync(temp,{recursive:true,force:true});
 }
 try {
   let key,cert,material;
   if (options.profileTrust) {
     material=require('./certificates.cjs').generate(temp);
     key=fs.readFileSync(material.key);cert=fs.readFileSync(material.cert);
   } else if (options.cert && options.key) { cert=fs.readFileSync(options.cert); key=fs.readFileSync(options.key); }
   else {
     const keyFile=path.join(temp,'key.pem'),certFile=path.join(temp,'cert.pem');
     execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
       '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',keyFile,'-out',certFile],{stdio:'ignore'});
     fs.chmodSync(keyFile,0o600);key=fs.readFileSync(keyFile);cert=fs.readFileSync(certFile);
   }
   function handler(req,res) {
     const pathname=new URL(req.url,'http://localhost').pathname;
     receipts.push({method:req.method,host:req.headers.host,path:pathname,timestamp:new Date().toISOString()});
     res.setHeader('Cache-Control','no-store');
     if (pathname.startsWith('/resource/')) {res.writeHead(200,{'Content-Type':'application/javascript'});res.end('window.fixtureResourceExecuted=(window.fixtureResourceExecuted||0)+1;');return;}
     if (pathname.startsWith('/frame/')) {res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Controlled frame</title>Frame');return;}
     const id=pathname.split('/')[2] || 'S02'; const f=fixture(id,urls);
     if(pathname.startsWith('/api/')) {
       const api=fixture(id.replace(/\.js$/,''),urls);
       res.writeHead(200,{'Content-Type':'application/javascript'});res.end(api.script);return;
     }
     res.writeHead(200,{'Content-Type':'text/html',...f.headers});res.end(f.html);
   }
   const plain=http.createServer(handler), secure=https.createServer({key,cert},handler);
   secure.on('tlsClientError',()=>{});
   servers.push(plain,secure);
   for(const server of servers) await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   urls.http=`http://127.0.0.1:${plain.address().port}`;
   urls.https=`https://localhost:${secure.address().port}`;
   urls.externalHttp=`http://assets.controlled.test:${plain.address().port}`;
   return {urls,receipts,close,temporaryCertificate:!options.cert,caFile:material?.ca,certificate:material?.publicMetadata};
 } catch(e) {await close();throw e;}
}
module.exports={environment};
