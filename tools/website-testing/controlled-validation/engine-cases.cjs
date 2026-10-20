const {assessBrowserState}=require('../../../modules/assessment/assessment-engine.js');
const assert=require('node:assert/strict');
function baseline(){return {urlAnalysis:{usesHTTPS:true,protocol:'https'},pageAnalysis:{},webSecurity:{pageUrl:'https://localhost/',https:{enabled:true}},networkActivity:{totalRequests:100,trackerRequests:0,trackerDomainCount:0},runtimePrivacy:{categories:{}}};}
const cases=[];
function add(name,dimension,expected,change){cases.push({name,dimension,expected,input:change(baseline())});}
function privacy(name,d,q,expected){add(name,'privacy',expected,s=>{Object.assign(s.networkActivity,{trackerDomainCount:d,trackerRequests:q});return s;});}
for(const [d,e] of [[1,'low'],[2,'moderate'],[3,'moderate'],[4,'moderate'],[5,'elevated'],[6,'elevated']]) privacy('tracker domains '+d,d,6,e+'-activity');
for(const [q,e] of [[9,'low'],[10,'moderate'],[11,'moderate'],[29,'moderate'],[30,'elevated'],[31,'elevated']]) privacy('tracker requests '+q,q>=29?2:1,q,e+'-activity');
privacy('30 requests single domain is only Moderate',1,30,'moderate-activity');
function sensitive(s,count){s.runtimePrivacy.categories={};if(count>=1)s.runtimePrivacy.categories.canvas={detected:true,details:['toDataURL:']};if(count>=2)s.runtimePrivacy.categories.audio={detected:true,details:['OfflineAudioContext:']};if(count>=3)s.runtimePrivacy.categories.webgl={detected:true,details:['getParameter:UNMASKED_RENDERER_WEBGL']};return s;}
for(const [n,e] of [[1,'low'],[2,'moderate'],[3,'moderate']]) add('sensitive surfaces '+n,'privacy',e+'-activity',s=>sensitive(s,n));
add('Moderate trackers plus correlated surfaces','privacy','elevated-activity',s=>{s.networkActivity.trackerDomainCount=2;return sensitive(s,2);});
add('ordinary WebGL plus navigator informational','privacy','low-activity',s=>{s.runtimePrivacy.categories={webgl:{detected:true,details:['getParameter:getParameter']},navigator:{detected:true,details:['platform:']}};return s;});
function network(name,total,q,d,e){add(name,'network',e+'-third-party-activity',s=>{Object.assign(s.networkActivity,{totalRequests:total,externalThirdPartyRequests:q,externalThirdPartyDomainCount:d,thirdPartyRequests:q,thirdPartyDomainCount:d});return s;});}
// Every expected level is a literal from PLAN.md, not a second engine invocation.
for(const [q,e] of [[4,'low'],[5,'moderate'],[6,'moderate']]) network('moderate ratio request floor '+q,20,q,1,e);
for(const [t,e] of [[21,'low'],[20,'moderate'],[19,'moderate']]) network('moderate ratio boundary total '+t,t,5,1,e);
for(const [q,e] of [[9,'moderate'],[10,'high'],[11,'high']]) network('high ratio request floor '+q,20,q,1,e);
for(const [t,e] of [[21,'moderate'],[20,'high'],[19,'high']]) network('high ratio boundary total '+t,t,10,1,e);
for(const [d,e] of [[4,'low'],[5,'moderate'],[6,'moderate']]) network('moderate domain boundary '+d,100,6,d,e);
for(const [d,e] of [[14,'moderate'],[15,'high'],[16,'high']]) network('high domain boundary '+d,100,16,d,e);
for(const [q,e] of [[19,'low'],[20,'moderate'],[21,'moderate']]) network('moderate volume floor '+q,200,q,1,e);
for(const [t,e] of [[201,'low'],[200,'moderate'],[199,'moderate']]) network('moderate volume ratio '+t,t,20,1,e);
for(const [q,e] of [[74,'moderate'],[75,'high'],[76,'high']]) network('high volume floor '+q,296,q,1,e);
for(const [t,e] of [[301,'moderate'],[300,'high'],[299,'high']]) network('high volume ratio '+t,t,75,1,e);
add('unknown entities never confirmed external','network','low-third-party-activity',s=>{Object.assign(s.networkActivity,{thirdPartyRequests:90,unknownThirdPartyRequests:90,thirdPartyDomainCount:20,unknownThirdPartyDomainCount:20});return s;});
add('Security baseline','security','no-major-issues',s=>s);
add('HTTP','security','attention',s=>{s.urlAnalysis.usesHTTPS=false;s.urlAnalysis.protocol='http';s.webSecurity.pageUrl='http://localhost/';s.webSecurity.https.enabled=false;return s;});
add('insecure password action','security','attention',s=>{s.pageAnalysis.insecurePasswordForms=1;return s;});
add('external password action','security','observations',s=>{s.pageAnalysis.externalPasswordForms=1;return s;});
add('suspicious link','security','observations',s=>{s.pageAnalysis.suspiciousMismatchedLinks=1;s.pageAnalysis.mismatchedLinks=1;s.pageAnalysis.totalLinks=1;return s;});
for(const [type,e] of [['script','attention'],['sub_frame','attention'],['image','observations']]) add('mixed attempt '+type,'security',e,s=>{s.webSecurity.mixedContent={requestCount:1,types:{[type]:1}};return s;});
for(const n of [2,3,4]) add('informational link count '+n,'security','no-major-issues',s=>{Object.assign(s.pageAnalysis,{mismatchedLinks:n,totalLinks:100});return s;});
for(const n of [24,25,26]) add('informational link ratio '+n,'security','no-major-issues',s=>{Object.assign(s.pageAnalysis,{mismatchedLinks:n,totalLinks:100});return s;});
for(const [total,present] of [[5,false],[4,true],[3,true]]) {
 add('link ratio only total '+total,'security','no-major-issues',s=>{Object.assign(s.pageAnalysis,{mismatchedLinks:1,totalLinks:total});return s;});
 cases.at(-1).reasonExpected=present;
}
for(const absent of [undefined,null,{available:false}]) {
 const input=baseline();input.networkActivity=absent;
 cases.push({name:'missing network '+JSON.stringify(absent),dimension:'dataStatus',expected:'partial',input});
}
cases.push({name:'null snapshot',dimension:'dataStatus',expected:'partial',input:null});
cases.push({name:'empty snapshot',dimension:'dataStatus',expected:'partial',input:{}});
for(const c of cases) {
 if(c.name.startsWith('informational link count ')) c.reasonExpected=Number(c.name.split(' ').at(-1))>=3;
 if(c.name.startsWith('informational link ratio ')) c.reasonExpected=true; // counts already exceed the independent >=3 branch
}
function runCase(c){const before=JSON.stringify(c.input);const actual=assessBrowserState(c.input);assert.equal(c.dimension==='dataStatus'?actual.dataStatus:actual[c.dimension].level,c.expected);if(c.reasonExpected!==undefined)assert.equal(actual.security.reasons.some(r=>r.id==='mismatched-link-destinations'),c.reasonExpected);assert.equal(JSON.stringify(c.input),before,'engine mutated its inputs');return actual;}
module.exports={cases,runCase};
