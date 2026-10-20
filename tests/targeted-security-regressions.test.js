const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {assessBrowserState}=require('../modules/assessment/assessment-engine');
const {present}=require('../popup/presentation');
function popupParser(){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){}});return nodes.get(id);};
 const document={addEventListener(){},getElementById:node,documentElement:{dataset:{},style:{},setAttribute(){}},querySelectorAll(){return [];}};
 const c=vm.createContext({console:{error(){}},document,window:{matchMedia:()=>({matches:false})},URL});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../popup/popup.js'),'utf8'),c);
 return {parse:u=>c.analyzeURL(u),node};
}
function forms(documentUrl,action,password=true,baseUrl=documentUrl){
 const url=new URL(documentUrl);
 const form={getAttribute:n=>n==='action'?action:null,querySelector:()=>password?{}:null};
 const c=vm.createContext({URL,console:{error(){}},document:{baseURI:baseUrl,querySelectorAll:s=>s==='form'?[form]:s==='input[type="password"]'&&password?[{}]:[]},
   window:{location:{href:url.href,hostname:url.hostname,protocol:url.protocol}},chrome:{runtime:{onMessage:{addListener(){}}}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../content/page-analysis.js'),'utf8'),c);
 return c.analyzeForms();
}
for(const [url,protocol] of [['http://localhost/','http'],['https://localhost/','https']])test('parser preserves '+protocol,()=>{
 const p=popupParser().parse(url);assert.equal(p.protocol,protocol);assert.notEqual(p.available,false);assert.equal(p.usesHTTPS,protocol==='https');
 const a=assessBrowserState({urlAnalysis:p});assert.equal(a.security.reasons.some(r=>r.id==='main-page-http'),protocol==='http');
});
const unsupported=['about:blank','about:srcdoc','chrome://version/','chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html','data:text/html,fixture','blob:https://localhost/00000000-0000-4000-8000-000000000000','file:///controlled.html'];
for(const url of unsupported)test('unsupported parser and engine: '+url,()=>{
 const h=popupParser(),p=h.parse(url);assert.equal(p.protocol,new URL(url).protocol.slice(0,-1));assert.equal(p.available,false);assert.equal(p.usesHTTPS,null);
 assert.notEqual(h.node('https-indicator').textContent,'HTTP');
 const a=assessBrowserState({urlAnalysis:p});assert.ok(a.missingSources.includes('urlAnalysis'));assert.equal(a.security.reasons.some(r=>r.id==='main-page-http'),false);assert.equal(present(a).cards.security.label,'—');
 const raw=assessBrowserState({urlAnalysis:{protocol:new URL(url).protocol,usesHTTPS:false}});assert.equal(raw.security.reasons.some(r=>r.id==='main-page-http'),false);assert.ok(raw.missingSources.includes('urlAnalysis'));
});
for(const value of [undefined,null,{}, {usesHTTPS:false}, {available:false,protocol:'http',usesHTTPS:false}])test('missing/unavailable URL does not imply HTTP: '+JSON.stringify(value),()=>{
 const a=assessBrowserState({urlAnalysis:value});assert.ok(a.missingSources.includes('urlAnalysis'));assert.equal(a.security.reasons.some(r=>r.id==='main-page-http'),false);assert.equal(present(a).cards.security.label,'—');
});
test('invalid parser input unavailable',()=>{for(const u of ['',null,undefined,'not a URL'])assert.equal(popupParser().parse(u),null);});
test('independent HTTP web evidence survives absent URL data',()=>{
 const a=assessBrowserState({webSecurity:{pageUrl:'http://localhost/'}});assert.equal(a.security.level,'attention');assert.ok(a.security.reasons.some(r=>r.id==='main-page-http'));
});
test('independent password and mixed findings survive unsupported URL',()=>{
 for(const signal of [{pageAnalysis:{insecurePasswordForms:1}},{webSecurity:{mixedContent:{requestCount:1,types:{script:1}}}}]){
  const a=assessBrowserState({urlAnalysis:{protocol:'about',usesHTTPS:false},...signal});assert.equal(a.security.level,'attention');assert.equal(a.security.reasons.some(r=>r.id==='main-page-http'),false);
 }
});
for(const protocol of ['http','https'])for(const [label,action] of [['absent',null],['empty',''],['relative','/submit'],['HTTP','http://destination.test/submit'],['HTTPS','https://destination.test/submit']])test(protocol+' password action '+label,()=>{
 const expected=action?.startsWith('http:') || !action?.startsWith('https:') && protocol==='http';
 const result=forms(protocol+'://localhost/document',action);
 assert.equal(result.insecurePasswordForms,expected?1:0);assert.equal(result.formCount,1);assert.equal(result.passwordFieldCount,1);
 assert.equal(result.externalForms,label==='HTTP'||label==='HTTPS'?1:0);assert.equal(result.externalPasswordForms,result.externalForms);
});
for(const action of [null,'','/submit','http://destination.test/','https://destination.test/','http://[','mailto:fixture@example.test','javascript:void(0)'])test('no-password form action '+String(action),()=>{
 assert.equal(forms('http://localhost/',action,false).insecurePasswordForms,0);
});
for(const action of ['http://[','mailto:fixture@example.test','javascript:void(0)'])test('password malformed/non-HTTP action '+action,()=>{
 assert.equal(forms('https://localhost/',action).insecurePasswordForms,0);
});
test('non-HTTP document with absent action is not an insecure HTTP target',()=>{
 assert.equal(forms('file:///controlled.html',null).insecurePasswordForms,0);
});
test('empty action uses document URL even if base is HTTPS',()=>{
 assert.equal(forms('http://localhost/document','',true,'https://destination.test/base/').insecurePasswordForms,1);
});
test('explicit relative action follows document base URI',()=>{
 const result=forms('http://localhost/document','submit',true,'https://destination.test/base/');assert.equal(result.insecurePasswordForms,0);assert.equal(result.externalPasswordForms,1);
});
