/** Dependency-free Chrome rendering smoke test. Uses mocked Chrome APIs and local fixtures.
 * Run: node scripts/check-popup-layout.js [output-directory]
 * Override the browser executable with BROWSERGUARD_CHROME if necessary.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'browserguard-ui-v2-'));
fs.mkdirSync(output, {recursive:true});
const chrome = process.env.BROWSERGUARD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(chrome)) throw new Error('Set BROWSERGUARD_CHROME to a local Chromium/Chrome executable.');
const historical = JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/governo-historical.json')));
function clean() {
    const s=structuredClone(historical);
    Object.assign(s.networkActivity,{totalRequests:100,firstPartyRequests:100,thirdPartyRequests:0,thirdPartyDomainCount:0,
        externalThirdPartyRequests:0,unknownThirdPartyRequests:0,unknownThirdPartyDomainCount:0,trackerDomainCount:0,trackerRequests:0,trackerDomains:[]});
    return s;
}
const scenarios = [];
scenarios.push({name:'low',expected:['Low','Low','Low'],snapshot:clean()});
let s=structuredClone(historical); s.networkActivity.trackerDomainCount=5; s.networkActivity.trackerRequests=30;
scenarios.push({name:'unknown-network',expected:['Low','High','—'],snapshot:s});
s=clean(); s.pageAnalysis.externalPasswordForms=1; s.networkActivity.trackerDomainCount=2; s.networkActivity.trackerRequests=12;
scenarios.push({name:'moderate',expected:['Moderate','Moderate','Low'],snapshot:s});
s=clean(); s.pageAnalysis.insecurePasswordForms=1;
Object.assign(s.networkActivity,{firstPartyRequests:30,trackerDomainCount:5,trackerRequests:40,thirdPartyRequests:70,thirdPartyDomainCount:12,externalThirdPartyRequests:70,externalThirdPartyDomainCount:12});
scenarios.push({name:'high',expected:['High','High','High'],snapshot:s});
scenarios.push({name:'unavailable',expected:['—','—','—'],snapshot:{}});
// Exercise actual popup initialization and DOM event listeners, replacing only Chrome's external APIs.
const bootstrap = `
const layoutScenarios=${JSON.stringify(scenarios)};
const layoutErrors=[];
window.addEventListener('error',e=>layoutErrors.push(e.message));
window.addEventListener('unhandledrejection',e=>layoutErrors.push(String(e.reason)));
const layoutInitial=layoutScenarios[0].snapshot;
const chrome={
 storage:{local:{get(key,callback){const value={appearanceTheme:'dark','browserguard.onboarding.v1':true};callback?.(value);return Promise.resolve(value);},set(){return Promise.resolve();}}},
 runtime:{sendMessage:async message=>({success:true,data:layoutInitial[{'GET_NETWORK_ACTIVITY':'networkActivity','GET_RUNTIME_PRIVACY':'runtimePrivacy','GET_WEB_SECURITY':'webSecurity'}[message.type]]})},
 tabs:{query:async()=>[{id:1,url:'https://example.test/'}],sendMessage:async(id,message)=>message.type==='BROWSERGUARD_PING'?{ready:true}:{success:true,data:layoutInitial.pageAnalysis}}
};`;
const checks = `
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 const byId=id=>document.getElementById(id);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const mount=scenario=>{
   const s=clone(scenario.snapshot);
   analyzeURL('https://example.test/');
   updatePageAnalysis(s.pageAnalysis); updateNetworkActivity(s.networkActivity);
   updateRuntimePrivacy(s.runtimePrivacy); updateWebSecurity(s.webSecurity,s.pageAnalysis);
   updateAssessment(BrowserGuardAssessmentEngine.assessBrowserState(s));
 };
 try {
   assert(currentAssessment!==null,'Initial popup analysis did not render');
   for(const scenario of layoutScenarios){
     mount(scenario);
     assert(!/undefined|NaN/.test(document.querySelector('main').textContent),'Unrendered missing data: '+scenario.name);
     for(const theme of ['dark','light']){
       applyTheme(theme);
       for(const width of [400,432,440]){
         document.body.style.width=width+'px';
         const cards=[...document.querySelectorAll('.assessment-card')];
         assert(cards.map(c=>c.querySelector('strong').textContent).join('|')===scenario.expected.join('|'),'Status mismatch: '+scenario.name);
         const rects=cards.map(c=>c.getBoundingClientRect());
         assert(rects.every(r=>r.top===rects[0].top&&Math.abs(r.height-rects[0].height)<1),'Unaligned cards');
         for(const card of cards){
           const strong=card.querySelector('strong');
           assert(strong.scrollWidth<=card.clientWidth-18,'Status overflow: '+strong.textContent);
           assert(card.getAttribute('aria-label').includes(strong.textContent==='—'?'Unavailable':strong.textContent),'Accessible status missing');
         }
         assert(document.documentElement.scrollWidth<=window.innerWidth,'Horizontal overflow');
       }
     }
     const cards=[...document.querySelectorAll('.assessment-card')];
     for (const dimension of ['security','privacy','network']) {
       cards.find(c=>c.dataset.dimension===dimension).click();
       assert(!byId('technical-details-content').hidden,'Category did not open details');
       assert(!byId('panel-'+dimension).hidden,'Wrong category opened');
       assert(document.activeElement.id===dimension+'-findings-title','Category evidence not focused');
     }
     for(const tab of ['overview','security','privacy','network']){
       byId('tab-'+tab).click();
       assert(byId('tab-'+tab).getAttribute('aria-selected')==='true','Selected tab missing');
       assert(!byId('panel-'+tab).hidden,'Selected panel hidden');
       assert(document.querySelectorAll('.technical-panel:not([hidden])').length===1,'More than one technical panel visible');
     }
     byId('tab-network').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
     assert(document.activeElement.id==='tab-overview','ArrowRight wrap failed');
     byId('tab-overview').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
     assert(document.activeElement.id==='tab-network','End navigation failed');
     byId('tab-network').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
     assert(document.activeElement.id==='tab-overview','Home navigation failed');
     focusTechnicalDetailsSection('privacy'); assert(!byId('panel-privacy').hidden&&document.activeElement.id==='privacy-findings-title','Evidence link focus failed');
     byId('technical-details-trigger').click();
   }
   // Home stays compact, secondary metrics remain in details, and descriptions are visible.
   assert(document.querySelector('.quick-insights').closest('#panel-overview'),'Metrics leaked onto homepage');
   for (const scenario of layoutScenarios) {
     mount(scenario);
     byId('technical-details-content').hidden=true;
     for (const width of [400,432,440]) {
       document.body.style.width=width+'px';
       assert(document.querySelector('main').getBoundingClientRect().height<=520,'Home exceeds compact popup height');
       for (const description of document.querySelectorAll('.assessment-description')) {
         assert(description.getBoundingClientRect().height>0,'Description hidden');
         assert(description.scrollWidth<=description.clientWidth,'Description overflow');
       }
     }
   }
   updateSiteFavicon('data:image/png;base64,invalid');
   byId('site-favicon').dispatchEvent(new Event('error'));
   assert(byId('site-favicon').hidden&&!byId('site-favicon-fallback').hasAttribute('hidden'),'Favicon fallback missing');
   updateUrlUnavailable();
   assert(byId('hostname').textContent==='—','Unavailable hostname is not compact');
   mount(layoutScenarios[1]);
   assert(byId('network-external-third-party').textContent==='—','Unknown ownership shown as zero');
   assert(byId('network-external-third-party-detail').textContent==='0','Confirmed zero lower-bound missing from technical details');
   const host='very-long-subdomain.'.repeat(14)+'example.test';updateText('hostname',host);
   assert(byId('hostname').title===host,'Full hostname unavailable');
   assert(getComputedStyle(byId('hostname')).textOverflow==='ellipsis'&&byId('hostname').scrollWidth>byId('hostname').clientWidth,'Long hostname not truncated');
   const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert(new Set(ids).size===ids.length,'Duplicate IDs');
   assert(!document.querySelector('pre'),'Raw JSON in UI');
   byId('help-button').click();assert(byId('onboarding').open,'Help did not open');
   byId('onboarding').dispatchEvent(new Event('cancel',{cancelable:true}));
   assert(!document.querySelector('.summary-panel'),'Overall verdict rendered');
   assert(!layoutErrors.length,layoutErrors.join('; '));
   // Leave a selected fixture visible for the screenshot, after the interaction checks.
   const parts=location.hash.slice(1).split('/');
   const selected=layoutScenarios.find(s=>s.name===parts[0])||layoutScenarios[0];
   mount(selected); applyTheme(parts[1]||'dark');document.body.style.width='432px';
   selectTechnicalTab('overview',false);byId('technical-details-content').hidden=true;byId('technical-details-trigger').setAttribute('aria-expanded','false');
   if(parts[2]==='details'){focusTechnicalDetailsSection('network');}
   window.scrollTo(0,0);
   document.body.dataset.layoutCheck='passed';
 } catch(error){document.body.dataset.layoutCheck='failed';document.body.dataset.layoutError=error.message;}
},100));`;
let html=fs.readFileSync(path.join(root,'popup/popup.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="popup.css">','<style>'+fs.readFileSync(path.join(root,'popup/popup.css'),'utf8')+'</style>');
html=html.replace('../assets/icons/Logo.png',pathToFileURL(path.join(root,'assets/icons/Logo.png')).href);
html=html.replace(/<script src="[^"]+"><\/script>/g,'');
const sources=['modules/assessment/assessment-engine.js','popup/presentation.js','popup/experience.js','popup/popup.js'];
const scripts=[bootstrap,...sources.map(file=>fs.readFileSync(path.join(root,file),'utf8')),checks];
html=html.replace('</body>',scripts.map(code=>'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>').join('\n')+'</body>');
const htmlPath=path.join(output,'popup-check.html');fs.writeFileSync(htmlPath,html);
for(const name of ['low','unknown-network','moderate','high','unavailable','low/light','unknown-network/dark/details']) {
    const stem=name.replaceAll('/','-');
    const args=['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check',
        '--user-data-dir='+path.join(output,'chrome-profile'),'--window-size=460,720','--force-device-scale-factor=1','--virtual-time-budget=1000',
        '--screenshot='+path.join(output,stem+'.png'),'--dump-dom',pathToFileURL(htmlPath).href+'#'+name];
    const result=spawnSync(chrome,args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
    fs.writeFileSync(path.join(output,stem+'.html'),result.stdout||'');
    if(result.error||result.status!==0||!result.stdout.includes('data-layout-check="passed"')) {
        const failure=(result.stdout||'').match(/data-layout-error="([^"]*)"/);
        throw new Error(name+': '+(failure?.[1]||result.error?.message||result.stderr));
    }
    console.log('PASS '+name);
}
console.log('Screenshots and DOM reports: '+output);
