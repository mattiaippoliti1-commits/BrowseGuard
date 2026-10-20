const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {X509Certificate}=require('node:crypto');
function generate(dir){
 const ca=path.join(dir,'root.crt'),caKey=path.join(dir,'root.key'),cert=path.join(dir,'localhost.crt'),key=path.join(dir,'localhost.key');
 const invoke=args=>execFileSync('openssl',args,{stdio:'ignore'});
 invoke(['req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=BrowserGuard ephemeral localhost CA',
   '-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign',
   '-addext','nameConstraints=critical,permitted;DNS:localhost,permitted;IP:127.0.0.1/255.255.255.255',
   '-keyout',caKey,'-out',ca]);
 const csr=path.join(dir,'leaf.csr'),ext=path.join(dir,'leaf.ext');
 invoke(['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=localhost','-keyout',key,'-out',csr]);
 fs.writeFileSync(ext,'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n');
 invoke(['x509','-req','-in',csr,'-CA',ca,'-CAkey',caKey,'-CAcreateserial','-days','2','-extfile',ext,'-out',cert]);
 for(const file of [key,caKey])fs.chmodSync(file,0o600);
 invoke(['verify','-CAfile',ca,'-verify_hostname','localhost',cert]);
 const leaf=new X509Certificate(fs.readFileSync(cert)),root=new X509Certificate(fs.readFileSync(ca));
 return {ca,key,cert,publicMetadata:{rootSha256:root.fingerprint256,leafSha256:leaf.fingerprint256,subjectAltNames:leaf.subjectAltName,validTo:leaf.validTo}};
}
module.exports={generate};
