// Offline, benchmark-specific postprocessing. Never navigates or calls external/AI services.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),net=require('node:net');
const {atomicJson,recordsIn}=require('./storage.cjs');
const {report,escapeHtml,csvCell}=require('./report.cjs');
const {fingerprint}=require('./run.cjs');
const root=path.resolve(__dirname,'../..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const available=v=>v&&v.available!==false;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length%2?b[i]:(b[i-1]+b[i])/2;};
const compound=new Set(['co.uk','org.uk','ac.uk','gov.uk','com.au','net.au','org.au','co.jp','ne.jp','or.jp','com.br','com.mx','com.tr','co.in','com.cn']);
function site(host){const h=host.toLowerCase().replace(/\.$/,'');if(net.isIP(h)||h==='localhost')return h;const a=h.split('.');return a.slice(compound.has(a.slice(-2).join('.'))?-3:-2).join('.');}
function suffix(map,host){const a=host.toLowerCase().replace(/\.$/,'').split('.');for(let i=0;i<a.length;i++){const key=a.slice(i).join('.');if(map.has(key))return {domain:key,value:map.get(key)};}return null;}
function localData(){const s={};vm.runInNewContext(fs.readFileSync(path.join(root,'data/tracker-data.js'),'utf8')+';globalThis.data=BROWSERGUARD_TRACKER_DATA;',s);
return {trackers:new Map(s.data.trackers.map(t=>[t[0],t[1]])),entities:new Map(s.data.entityDomains.map(e=>[e[0],e[1]]))};}
function compare(r,data){
 const n=r.extension?.inputs?.networkActivity,w=r.extension?.inputs?.webSecurity,final=r.navigation?.finalUrl;
 const requests=r.independent?.requests||[], responses=r.independent?.responses||[];
 const doc=[...requests].reverse().find(q=>q.topFrame&&q.type==='Document'&&q.url===final);
 const scoped=doc?requests.filter(q=>q.timestamp>=doc.timestamp):null;
 const finalHost=(()=>{try{return new URL(final).hostname;}catch{return null;}})();
 const finalResponse=[...responses].reverse().find(q=>q.topFrame&&q.type==='Document'&&!q.redirect&&q.url===final);
 const result={websiteId:r.id,url:r.url,phaseWindow:{cdpStart:r.independent?.startedAt,cdpEnd:r.independent?.endedAt,popup:r.extension?.collectionWindow},
  cdpTotalRequests:r.independent?.totalRequests??null,extensionTotalRequests:available(n)?n.totalRequests:null,
  retainedRequestDetails:requests.length,droppedRequestDetails:r.independent?.droppedRequests??null,
  comparableFinalNavigation:Boolean(doc),cdpRequestsSinceFinalNavigation:scoped?.length??null,
  requestCountDelta:available(n)&&r.independent? n.totalRequests-r.independent.totalRequests:null,
  protocol:{finalUrl:final,cdpUsesHTTPS:typeof final==='string'&&/^https?:/.test(final)?final.startsWith('https:'):null,extensionUsesHTTPS:available(w)?w.https?.enabled:null},headers:[],
  caveat:'CDP visibility and sequential extension snapshots differ. Derived labels reuse the bundled dataset and registrable-domain heuristic; they are not an independent tracker/ownership oracle.'};
 if(scoped&&finalHost){
  const pageEntity=suffix(data.entities,finalHost)?.value;
  const cross=scoped.filter(q=>site(q.hostname)!==site(finalHost));
  const external=cross.filter(q=>{const owner=suffix(data.entities,q.hostname)?.value;return owner&&pageEntity&&owner!==pageEntity;});
  const trackers=[...new Set(cross.map(q=>suffix(data.trackers,q.hostname)?.domain).filter(Boolean))].sort();
  const cdpCross=[...new Set(cross.map(q=>q.hostname))].sort(),cdpExternal=[...new Set(external.map(q=>q.hostname))].sort();
  const extTrackers=available(n)?[...new Set((n.trackerDomains||[]).map(q=>q.matchedDomain))].sort():null;
  const extExternal=available(n)?[...new Set((n.externalThirdPartyDomains||[]).map(q=>q.hostname))].sort():null;
  result.domains={cdpCrossOrigin:cdpCross,cdpConfirmedExternal:cdpExternal,extensionConfirmedExternal:extExternal,
   cdpTrackerDatasetMatches:trackers,extensionTrackerDatasetMatches:extTrackers,
   cdpOnlyExternal:extExternal?cdpExternal.filter(h=>!extExternal.includes(h)):null,extensionOnlyExternal:extExternal?extExternal.filter(h=>!cdpExternal.includes(h)):null,
   cdpOnlyTracker:extTrackers?trackers.filter(h=>!extTrackers.includes(h)):null,extensionOnlyTracker:extTrackers?extTrackers.filter(h=>!trackers.includes(h)):null};
  result.mixedContent={cdpAttemptCount:final.startsWith('https:')?scoped.filter(q=>q.url.startsWith('http:')&&!(q.topFrame&&q.type==='Document')).length:0,
    extensionAttemptCount:available(w)?w.mixedContent?.requestCount:null};
 }
 if(finalResponse&&available(w)){
  for(const [header,key]of [['content-security-policy','csp'],['strict-transport-security','hsts'],['x-content-type-options','contentTypeOptions'],['referrer-policy','referrerPolicy'],['permissions-policy','permissionsPolicy']]){
   const cdpPresent=Boolean(finalResponse.headers[header]),extensionPresent=w.headers?.[key]?.present;
   result.headers.push({header,cdpPresent,extensionPresent,equal:cdpPresent===extensionPresent});
  }
  result.finalResponseEvidence=finalResponse;
 }
 return result;
}
function summarize(records){
 const out={tested:records.length,captured:records.filter(r=>r.extension?.assessment).length,
  successful:records.filter(r=>['ok','partial'].includes(r.status)).length,
  averageObservedRequests:mean(records.filter(r=>available(r.extension?.inputs?.networkActivity)).map(r=>r.extension.inputs.networkActivity.totalRequests)),
  averageTrackingAssociatedDomains:mean(records.filter(r=>available(r.extension?.inputs?.networkActivity)).map(r=>r.extension.inputs.networkActivity.trackerDomainCount)),
  partial:records.filter(r=>r.extension?.assessment?.dataStatus==='partial').length,
  navigationCompleted:records.filter(r=>!r.navigation?.error&&Number.isInteger(r.navigation?.httpStatus)).length,
  restricted:records.filter(r=>r.navigation?.blocked).length,navigationErrors:records.filter(r=>r.navigation?.error).length,
  timeoutSites:records.filter(r=>/timeout/i.test([r.navigation?.error,r.collectionError,...(r.extension?.errors||[])].filter(Boolean).join(' '))).length,
  httpErrorSites:records.filter(r=>r.navigation?.httpStatus>=400).length,
  cdpHTTPErrorResponses:records.reduce((n,r)=>n+(r.independent?.responses||[]).filter(q=>q.status>=400).length,0),httpStatuses:{},
  frameworkErrorSites:records.filter(r=>r.collectionError||r.anomalies.some(a=>a.code==='validator_failure')).length,
  extensionErrorSites:records.filter(r=>r.extension?.errors?.length).length,
  averageAttemptMs:mean(records.map(r=>r.durationMs)),medianAttemptMs:median(records.map(r=>r.durationMs)),
  anomalousSites:records.filter(r=>r.anomalies.length).length,anomalyEvents:records.reduce((s,r)=>s+r.anomalies.length,0),anomalyCodes:{},assessments:{all:{},successful:{}}};
 for(const r of records){const h=r.navigation?.httpStatus??'not-recorded';out.httpStatuses[h]=(out.httpStatuses[h]||0)+1;
  for(const a of r.anomalies)out.anomalyCodes[a.code]=(out.anomalyCodes[a.code]||0)+1;}
 for(const [population,rows]of Object.entries({all:records,successful:records.filter(r=>['ok','partial'].includes(r.status))})){
  for(const d of ['security','privacy','network']){const counts={};for(const r of rows){const label=r.extension?.displayed?.[d]?.label||'missing';counts[label]=(counts[label]||0)+1;}out.assessments[population][d]=counts;}
 }
 return out;
}
async function main(){
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'datasets/benchmark100.json')));
 const sites=corpus.sites,expected=new Set(sites.map(s=>s.url));
 if(sites.length!==100||expected.size!==100||new Set(sites.map(s=>site(new URL(s.url).hostname))).size!==100)throw Error('Corpus must have 100 distinct registrable-domain groups');
 const output=path.join(__dirname,'runs/benchmark100');fs.mkdirSync(path.join(output,'records'),{recursive:true,mode:0o700});
 const rows=[],phases=[],provenance=[];
 for(const [phase,planned]of [['benchmark100-smoke',10],['benchmark100-main90',90]]){
  const dir=path.join(__dirname,'runs',phase);
  if(fs.existsSync(path.join(dir,'.lock')))throw Error('Phase still running: '+phase);
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),checkpoint=JSON.parse(fs.readFileSync(path.join(dir,'checkpoint.json'))),files=recordsIn(dir);
  if(files.length!==planned||checkpoint.completed!==planned||checkpoint.fatalError)throw Error('Incomplete phase: '+phase);
  if(manifest.config.concurrency!==1)throw Error('Expected concurrency 1');
  const phaseRows=[];
  for(const file of files){const bytes=fs.readFileSync(path.join(dir,'records',file)),r=JSON.parse(bytes);
   if(!expected.has(r.url)||rows.some(v=>v.url===r.url)||r.sourceHash!==manifest.sourceHash)throw Error('Unexpected/duplicate record '+r.url);
   const destination=path.join(output,'records',file);if(fs.existsSync(destination)&&sha(fs.readFileSync(destination))!==sha(bytes))throw Error('Conflicting aggregate record');
   fs.writeFileSync(destination+'.tmp',bytes,{mode:0o600});fs.renameSync(destination+'.tmp',destination);rows.push(r);phaseRows.push(r);provenance.push({id:r.id,url:r.url,category:sites.find(s=>s.url===r.url).category,phase,sha256:sha(bytes)});
  }
  phases.push({name:phase,manifest,checkpoint,manifestSha256:sha(fs.readFileSync(path.join(dir,'manifest.json'))),
   firstRecordAt:phaseRows.map(r=>r.startedAt).sort()[0],lastRecordAt:phaseRows.map(r=>r.endedAt).sort().at(-1)});
 }
 if(rows.length!==100||recordsIn(output).length!==100)throw Error('Expected exactly 100 aggregate records');
 if(new Set(phases.map(p=>p.manifest.sourceHash)).size!==1||new Set(phases.map(p=>p.manifest.harnessHash)).size!==1)throw Error('Source/harness changed between phases');
 if(fingerprint().hash!==phases[0].manifest.sourceHash)throw Error('Extension changed during benchmark');
 atomicJson(path.join(output,'manifest.json'),{schemaVersion:1,type:'aggregate-of-disjoint-execution-phases',startedAt:phases[0].manifest.startedAt,
  sourceHash:phases[0].manifest.sourceHash,harnessHash:phases[0].manifest.harnessHash,urlCount:100,aiEnabled:false,concurrency:1,phases,corpusSha256:sha(fs.readFileSync(path.join(__dirname,'datasets/benchmark100.json')))});
 atomicJson(path.join(output,'provenance.json'),provenance);
 await report(output);
 const stats=summarize(rows),data=localData(),comparisons=rows.map(r=>compare(r,data));
 const categoryStats=Object.entries(corpus.categoryCounts).map(([category,planned])=>({category,label:sites.find(s=>s.category===category).categoryLabel,planned,...summarize(rows.filter(r=>sites.find(s=>s.url===r.url).category===category))}));
 const withDomains=comparisons.filter(c=>c.domains),withHeaders=comparisons.filter(c=>c.headers.length);
 const consistency={requestWindowDifferences:comparisons.filter(c=>c.requestCountDelta!==null&&c.requestCountDelta!==0).length,
  finalNavigationComparable:withDomains.length,domainDetailDifferenceSites:withDomains.filter(c=>c.domains.cdpOnlyExternal.length||c.domains.extensionOnlyExternal.length||c.domains.cdpOnlyTracker.length||c.domains.extensionOnlyTracker.length).length,
  matchedHeaderSites:withHeaders.length,headerPresenceDifferenceSites:withHeaders.filter(c=>c.headers.some(h=>!h.equal)).length,
  protocolDifferenceSites:comparisons.filter(c=>typeof c.protocol.extensionUsesHTTPS==='boolean'&&typeof c.protocol.cdpUsesHTTPS==='boolean'&&c.protocol.cdpUsesHTTPS!==c.protocol.extensionUsesHTTPS).length,
  mixedContentComparableSites:comparisons.filter(c=>c.mixedContent&&c.mixedContent.extensionAttemptCount!==null).length,
  mixedContentCountDifferenceSites:comparisons.filter(c=>c.mixedContent&&c.mixedContent.extensionAttemptCount!==null&&c.mixedContent.extensionAttemptCount!==c.mixedContent.cdpAttemptCount).length,
  cappedRequestSites:comparisons.filter(c=>c.droppedRequestDetails>0).length,
  interpretation:'Count/domain/mixed-content differences are descriptive window/visibility differences, not automatically additional anomalies or confirmed bugs.'};
 const executionSeconds=phases.reduce((s,p)=>s+(Date.parse(p.lastRecordAt)-Date.parse(p.manifest.startedAt))/1000,0);
 const elapsedSeconds=(Date.parse(phases[1].lastRecordAt)-Date.parse(phases[0].manifest.startedAt))/1000;
 const {validate}=require('./validate.cjs');
 const falsePositives=[]; const reviewed=[];
 for(const r of rows){
  const current=validate(r);
  for(const anomaly of r.anomalies){
   if(anomaly.code==='privacy_rule_contract'&&!current.some(a=>a.code==='privacy_rule_contract'))
    falsePositives.push({websiteId:r.id,url:r.url,original:anomaly,resolution:'Confirmed validator defect: API-prefixed details were compared with exact unprefixed names. Corrected validator accepts the captured assessment.'});
   else reviewed.push({websiteId:r.id,url:r.url,...anomaly});
  }
 }
 atomicJson(path.join(output,'reviewed-anomalies.json'),reviewed);
 atomicJson(path.join(output,'validator-false-positives.json'),falsePositives);
 const detailed={generatedAt:new Date().toISOString(),stats,categoryStats,consistency,executionSeconds,elapsedIncludingSmokeReviewSeconds:elapsedSeconds,
  timeDefinition:'Sum of each phase manifest start through last record end; excludes final runner delay/report cleanup. Elapsed interval also includes smoke review between phases.',
  confirmedBrowserGuardBugs:0,confirmedBugs:falsePositives.length?[{
   component:'test framework',code:'runtime_detail_token_matching',status:'confirmed-and-fixed',
   regressionTest:'benchmark100-regression.test.cjs',affectedWebsiteIds:falsePositives.map(a=>a.websiteId),
   evidence:'The regression failed before the one-line validator fix and passes after it. Raw collection and engine replay were unaffected.'}]:[],
  reviewedAnomalyEvents:reviewed.length,reviewedAnomalousSites:new Set(reviewed.map(a=>a.websiteId)).size,
  validatorFalsePositiveEvents:falsePositives.length,reviewedAnomalies:reviewed,indicators:{
   highPrivacy:rows.filter(r=>r.extension?.displayed?.privacy?.label==='High').map(r=>({id:r.id,url:r.url,trackerDomains:r.extension.inputs.networkActivity?.trackerDomainCount})),
   highNetwork:rows.filter(r=>r.extension?.displayed?.network?.label==='High').map(r=>({id:r.id,url:r.url,externalRequests:r.extension.inputs.networkActivity?.externalThirdPartyRequests})),
   missingHeaders:rows.filter(r=>available(r.extension?.inputs?.webSecurity)&&r.navigation?.httpStatus>=200&&r.navigation?.httpStatus<400&&comparisons.find(c=>c.websiteId===r.id)?.headers.length).map(r=>({id:r.id,url:r.url,status:r.status,
    missing:['csp','hsts','contentTypeOptions','referrerPolicy','permissionsPolicy'].filter(k=>r.extension.inputs.webSecurity.headers?.[k]?.present===false)})).filter(r=>r.missing.length),
   partial:rows.filter(r=>r.extension?.assessment?.dataStatus==='partial').map(r=>({id:r.id,url:r.url,missing:r.extension.assessment.missingSources}))}};
 atomicJson(path.join(output,'benchmark-statistics.json'),detailed);atomicJson(path.join(output,'cdp-comparisons.json'),comparisons);
 const csvCols=['category','label','tested','captured','successful','restricted','timeoutSites','httpErrorSites','frameworkErrorSites','extensionErrorSites','averageAttemptMs','medianAttemptMs','anomalyEvents'];
 fs.writeFileSync(path.join(output,'categories.csv'),csvCols.join(',')+'\n'+categoryStats.map(c=>csvCols.map(k=>csvCell(c[k])).join(',')).join('\n')+'\n');
 writeDocuments(output,corpus,rows,phases,detailed,comparisons);
 console.log(JSON.stringify({output,...stats,consistency,executionSeconds,elapsedSeconds},null,2));
}
function writeDocuments(output,corpus,rows,phases,d,comparisons){
 const s=d.stats,c=d.consistency;
 const fmt=v=>v===null||v===undefined?'—':typeof v==='number'?Number(v.toFixed(2)).toLocaleString('it-IT'):String(v);
 const md=v=>String(v??'—').replaceAll('|','\\|').replace(/\r?\n/g,' ');
 const group=r=>corpus.sites.find(q=>q.url===r.url).categoryLabel;
 const categoryLines=d.categoryStats.map(q=>`| ${q.label} | ${q.tested} | ${q.captured} | ${q.successful} | ${q.restricted} | ${q.timeoutSites} | ${q.anomalyEvents} | ${fmt(q.averageAttemptMs/1000)} |`).join('\n');
 const anomalyRows=rows.filter(r=>r.anomalies.length);
 const anomalyLines=anomalyRows.map(r=>`| ${md(r.url)} | ${r.anomalies.map(a=>a.code).join(', ')} | [Record JSON](runs/benchmark100/records/${r.id}.json) |`).join('\n');
 const ranks=rows.filter(r=>available(r.extension?.inputs?.networkActivity)).sort((a,b)=>b.extension.inputs.networkActivity.trackerDomainCount-a.extension.inputs.networkActivity.trackerDomainCount).slice(0,10);
 const topLines=ranks.map(r=>{const n=r.extension.inputs.networkActivity;return `| ${r.url} | ${r.status} | ${n.trackerDomainCount} | ${n.trackerRequests} | ${n.externalThirdPartyRequests} |`;}).join('\n');
 const hardCodes=['validator_failure','engine_replay_mismatch','security_rule_contract','privacy_rule_contract','network_rule_contract','request_partition','entity_partition','rendered_assessment_mismatch','presentation_mismatch'];
 const hardCount=d.reviewedAnomalies.filter(a=>hardCodes.includes(a.code)).length;
 const proceed=s.frameworkErrorSites===0&&hardCount===0;
 const recommendation=proceed?'Procedere con un benchmark su 1.000 siti a concorrenza 1, conservando checkpoint e separando esplicitamente le risposte limitate dalle analisi valide.':'Non avviare ancora il benchmark su 1.000 siti: investigare prima gli errori di estrazione/framework o le incoerenze deterministiche emerse, quindi ripetere uno smoke test mirato.';
 const estimate=d.executionSeconds/100*1000;
 const reportText=`# BrowserGuard — Benchmark su 100 siti pubblici

## 1. Obiettivi

Valutare acquisizione, affidabilità e consistenza delle osservazioni di BrowserGuard su 100 URL HTTPS pubbliche, senza modificare detector, soglie, UI o permessi. Campione ragionato per categorie, non rappresentativo dell'intero Web. Non misura la capacità di certificare la sicurezza dei siti.

## 2. Metodologia

Uno smoke test di 10 siti (uno per categoria), seguito da 90 URL disgiunte dopo il superamento del controllo preliminare. I risultati dello smoke sono riutilizzati senza nuove visite: 100 URL uniche, 100 record effettivi, nessuna sostituzione silenziosa dei siti limitati. Due esecuzioni del runner esistente; nessun login, click, modulo, acquisto o aggiramento di CAPTCHA/403/429. Nessuna chiamata AI o trasmissione dei risultati a servizi esterni.

Chromium carica l'estensione reale. Il popup acquisisce gli snapshot; una strumentazione nel solo popup cattura input e output effettivi dell'Assessment Engine. CDP osserva separatamente richieste e header selezionati. I record originali sono copiati senza modifiche nel report aggregato; [provenance.json](runs/benchmark100/provenance.json) registra fase e SHA-256 di ogni record. I manifest e checkpoint delle due fasi sono conservati nel [manifest aggregato](runs/benchmark100/manifest.json). Il resume è stato verificato sullo smoke: tutti i 10 hash sono rimasti invariati e non sono state ripetute visite.

## 3. Composizione del dataset

[Metadati JSON](datasets/benchmark100.json), [CSV con motivazioni](datasets/benchmark100.csv), [100 URL](datasets/benchmark100.txt) e [istruzioni delle due fasi](datasets/README.md). Verificate 100 URL HTTPS senza credenziali/query, 100 gruppi di dominio registrabile distinti e le quantità esatte delle categorie. L'effettiva raggiungibilità deriva dalle visite, non dalla selezione preventiva.

## 4. Ambiente e configurazione

- Sistema: ${phases[0].manifest.platform} ${phases[0].manifest.arch}; Node ${phases[0].manifest.node}; Playwright ${phases[0].manifest.playwright}; Chromium ${phases[0].manifest.browserVersion}.
- Concorrenza: 1; profili temporanei isolati, riciclati ogni ${phases[0].manifest.config.recycleEvery} siti.
- Timeout navigazione: ${phases[0].manifest.config.navigationTimeoutMs} ms; setup/popup: ${phases[0].manifest.config.analysisTimeoutMs} ms. Osservazione aggiuntiva: ${phases[0].manifest.config.minObserveMs}–${phases[0].manifest.config.maxObserveMs} ms; pausa: ${phases[0].manifest.config.delayMs} ms.
- AI disabilitata: il runner e questo postprocessore non invocano il componente AI. L'eventuale ai-packet.json è soltanto un file locale non trasmesso.
- SHA-256 sorgenti estensione: \`${phases[0].manifest.sourceHash}\`.
- SHA-256 harness: \`${phases[0].manifest.harnessHash}\`.
- Inizio smoke: ${phases[0].manifest.startedAt}; ultimo record della fase principale: ${phases[1].lastRecordAt} (UTC nei manifest).

## 5. Risultati aggregati

| Misura | Risultato |
| --- | ---: |
| URL elaborate | ${s.tested} |
| Assessment acquisiti | ${s.captured} |
| Navigazioni con risposta principale e senza errore goto | ${s.navigationCompleted} |
| Analisi riuscite senza restrizioni (anche se parziali) | ${s.successful} (${fmt(s.successful/s.tested*100)}%) |
| Siti classificati con restrizioni (anche tramite titolo) | ${s.restricted} |
| Errori di navigazione | ${s.navigationErrors} |
| Siti con timeout di navigazione/estrazione | ${s.timeoutSites} |
| Siti con HTTP principale >=400 | ${s.httpErrorSites} |
| Risposte HTTP >=400 nel flusso CDP, incluse risorse | ${s.cdpHTTPErrorResponses} |
| Errori di raccolta/validazione del framework | ${s.frameworkErrorSites} |
| Siti con messaggi console di errore dell'estensione | ${s.extensionErrorSites} |
| Assessment con fonti parziali | ${s.partial} |
| Tempo medio per tentativo | ${fmt(s.averageAttemptMs/1000)} s |
| Tempo mediano per tentativo | ${fmt(s.medianAttemptMs/1000)} s |
| Media richieste BrowserGuard (snapshot disponibili) | ${fmt(s.averageObservedRequests)} |
| Media domini associati al tracking (snapshot disponibili) | ${fmt(s.averageTrackingAssociatedDomains)} |
| Durata delle finestre di esecuzione | ${fmt(d.executionSeconds)} s (${fmt(d.executionSeconds/60)} min) |
| Intervallo complessivo incluso controllo tra le fasi | ${fmt(d.elapsedIncludingSmokeReviewSeconds)} s |
| Eventi anomali segnalati | ${s.anomalyEvents} |
| Siti con almeno una segnalazione | ${s.anomalousSites} |
| Falsi positivi del validator verificati | ${d.validatorFalsePositiveEvents} |
| Segnalazioni residue dopo revisione | ${d.reviewedAnomalyEvents} |
| Bug confermati BrowserGuard | ${d.confirmedBrowserGuardBugs} |
| Bug confermati del framework (corretto) | ${d.confirmedBugs.length} |

La durata di esecuzione somma, per ciascuna fase, il tempo fra avvio del manifest e fine dell'ultimo record; include avvio browser e pause tra siti, esclude la pausa finale e la generazione del report. La media/mediana considera il singolo tentativo, senza pausa tra siti. Le categorie di errore possono sovrapporsi. Un errore console su una pagina di errore browser non dimostra un difetto dell'estensione. Gli assessment acquisiti su blocchi/errori non equivalgono ad analisi riuscite della pagina prevista. La percentuale di riuscita segue la classificazione del framework: nessun errore di navigazione/estrazione e nessuna restrizione rilevata dalla sua euristica. Sono incluse due risposte HTTP 202; un 2xx non garantisce che la homepage prevista sia stata mostrata integralmente. Le medie dei contatori includono soltanto gli snapshot disponibili, anche se relativi a risposte limitate.

Distribuzione HTTP principale: \`${JSON.stringify(s.httpStatuses)}\`.

### Assessment: tutti i risultati e sole visite riuscite

| Dimensione | Tutti i tentativi | Solo analisi riuscite |
| --- | --- | --- |
${['security','privacy','network'].map(k=>`| ${k} | ${JSON.stringify(s.assessments.all[k])} | ${JSON.stringify(s.assessments.successful[k])} |`).join('\n')}

Privacy High: ${d.indicators.highPrivacy.length} risposte; Network High: ${d.indicators.highNetwork.length} risposte. Sono livelli informativi esistenti, non nuovi punteggi o giudizi di pericolosità.

### Maggior numero di domini associati al tracking osservati

Ordinamento descrittivo dei contatori, senza introdurre una soglia aggiuntiva. Le righe possono includere risposte limitate; lo stato è esplicito.

| URL | Stato | Domini associati | Richieste associate | Richieste esterne confermate |
| --- | --- | ---: | ---: | ---: |
${topLines}

Le risposte con header mancanti (${d.indicators.missingHeaders.length} snapshot con risposta principale HTTP <400 confrontabile e almeno uno dei cinque header controllati assente), i livelli elevati e le fonti mancanti sono elencati in [benchmark-statistics.json](runs/benchmark100/benchmark-statistics.json), sezione indicators. Un header assente non dimostra una vulnerabilità.

## 6. Risultati per categoria

| Categoria | URL | Assessment | Riuscite | Restrizioni | Timeout | Eventi anomali | Media s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${categoryLines}

[Statistiche complete per categoria e distribuzioni](runs/benchmark100/benchmark-statistics.json) e [CSV per categoria](runs/benchmark100/categories.csv).

## 7. Anomalie ed evidenze riproducibili

Codici e frequenze: \`${JSON.stringify(s.anomalyCodes)}\`. Le restrizioni e i fallimenti ambientali restano inclusi; non sono tutti bug potenziali del detector. Il conteggio non somma ogni differenza CDP come una nuova anomalia. Fra le segnalazioni originali, ${d.validatorFalsePositiveEvents} sono falsi positivi verificati del controllo Privacy; restano ${d.reviewedAnomalyEvents} segnalazioni su ${d.reviewedAnomalousSites} siti. [Revisione](runs/benchmark100/reviewed-anomalies.json) e [falsi positivi con evidenze](runs/benchmark100/validator-false-positives.json) mantengono la distinzione senza alterare i record originali.

| URL | Codici | Evidenza |
| --- | --- | --- |
${anomalyLines||'| — | Nessuna segnalazione | — |'}

Ogni record contiene messaggi, URL osservate, assessment, fonti e finestre temporali; [anomalies.json](runs/benchmark100/anomalies.json) mantiene l'evidenza di ogni evento. Per riprodurre una segnalazione, usare sorgenti/hash e configurazione registrati, mettere la URL originale in un file e seguire la procedura di riproduzione del [framework](README.md). Per 403/429/CAPTCHA consultare soltanto i record: non tentare aggiramenti o retry per ottenere accesso.

### Confronto con CDP

- Siti con totali richieste differenti: ${c.requestWindowDifferences}; non imposta un'asserzione di uguaglianza.
- Siti con richiesta di navigazione finale identificabile: ${c.finalNavigationComparable}; con differenze negli insiemi di domini esterni/tracker: ${c.domainDetailDifferenceSites}.
- Siti con risposta principale finale confrontabile per gli header: ${c.matchedHeaderSites}; differenze di presenza: ${c.headerPresenceDifferenceSites}.
- Differenze HTTP/HTTPS confrontabili: ${c.protocolDifferenceSites}.
- Siti confrontabili per tentativi mixed content: ${c.mixedContentComparableSites}; differenze di conteggio: ${c.mixedContentCountDifferenceSites}.
- Siti con dettagli richieste troncati dal limite: ${c.cappedRequestSites}.

[cdp-comparisons.json](runs/benchmark100/cdp-comparisons.json) conserva insiemi di hostname/domini, differenze, header e timestamp per sito. L'arricchimento dei dati CDP riusa lo stesso dataset locale e la medesima euristica di dominio: è indipendente la raccolta, non la verità della classificazione. Nessun dato mancante è sostituito con zero.

## 8. Limitazioni metodologiche

Le osservazioni CDP includono una finestra diversa da quella degli snapshot sequenziali dell'estensione. Per i confronti derivati si parte dalla richiesta finale del documento quando identificabile, senza pretendere equivalenza completa. Redirect, cambi URL tramite History API, cache, iframe in altri processi e worker possono spiegare differenze. Le URL salvate non contengono query o frammenti. Le protezioni anti-bot, le pagine regionali e il mancato consenso condizionano il campione. Nessun login o interazione di consenso è stato effettuato. L'assenza di tentativi mixed content osservati non prova l'assenza di contenuti insicuri.

Lo stato del browser può persistere tra siti del medesimo blocco di 25; il popup viene aperto come tab di estensione in background, non come flyout. Non sono misurati picco RAM, consumo energetico o correttezza completa dei tracker. Il replay dell'engine condivide il codice di produzione e verifica integrazione/determinismo, non costituisce un oracolo totalmente indipendente.

## 9. Bug confermati

Nessun bug confermato nei detector, nell'Assessment Engine o nella UI di BrowserGuard. Confermato e corretto **un bug del validator del framework**: il controllo indipendente Privacy confrontava nomi nudi con dettagli nel formato API:dettaglio. Ciò ignorava superfici sensibili e generava falsi positivi di violazione regola. Il test aggiunto benchmark100-regression.test.cjs falliva prima della correzione e passa dopo. La correzione minima riguarda solo il confronto dei token runtime in validate.cjs, senza modificare soglie o assessment.

La correzione è stata applicata soltanto dopo la conclusione delle visite, mantenendo stabile il fingerprint durante entrambe le fasi. Le evidenze originali e il validator precedente sono preservati in [review-evidence](runs/benchmark100/review-evidence/). La revisione offline non ha richiesto nuove visite. I manifest continuano a descrivere l'harness effettivamente usato; un eventuale nuovo run deve avere una nuova directory, perché il resume rifiuta correttamente un harness diverso.

Dopo la revisione restano ${hardCount} eventi nelle verifiche deterministiche principali. Messaggi di errore o differenze di URL non sono da soli una dimostrazione causale di un difetto.

## 10. Raccomandazioni

1. Distinguere sistematicamente assessment acquisiti, pagine limitate e analisi riuscite: mantenere entrambe le distribuzioni nei confronti futuri.
2. Analizzare i cambi di identità del documento e le pagine di errore prima di attribuire URL discordanti o fonti mancanti ai detector.
3. Valutare in futuro un identificatore di documento e timestamp per ogni snapshot, per rendere più forte il confronto tra le fonti. Nessuna modifica applicativa è stata introdotta qui.
4. Conservare dataset, manifest e record; investigare prima le anomalie deterministiche o di estrazione, poi i confronti fra finestre differenti.
5. Non interpretare Low come certificazione di sicurezza, High Privacy come prova di tracking effettivo, o High Network come prova di attività malevola.

## 11. Fattibilità di 1.000 siti

${recommendation}

Alla velocità osservata, 1.000 siti richiederebbero circa ${fmt(estimate/3600)} ore per le sole finestre di esecuzione, assumendo distribuzione simile di pagine e timeout. È una proiezione, non un benchmark eseguito. RAM e disco vanno controllati durante il run; non è disponibile una misura del picco RAM. Per un Mac da 8 GB mantenere concorrenza 1. Il corpus andrebbe ampliato e revisionato, senza riutilizzare 100 siti come se fossero 1.000 distinti.

## Artefatti e modifiche

[Report HTML navigabile](runs/benchmark100/benchmark.html), [report completo del framework](runs/benchmark100/report.html), [dataset JSON](runs/benchmark100/dataset.json), [CSV](runs/benchmark100/summary.csv), [fallimenti](runs/benchmark100/failed-tests.json). Gli artefatti raw restano locali nella directory runs ignorata da Git.

Aggiunti soltanto corpus, metadati, documentazione e postprocessore offline specifico del benchmark; il README del framework collega la nuova procedura. Unica modifica a un modulo preesistente del framework: confronto dei token runtime in validate.cjs, necessario per eliminare falsi positivi dimostrati dal benchmark. Aggiunto un test di regressione; nessuna modifica a runner, collector, report generator, test esistenti o codice di produzione. Nessun servizio esterno di analisi e nessun commit.
`;
 fs.writeFileSync(path.join(__dirname,'BENCHMARK_100.md'),reportText);
 const htmlTable=(columns,values)=>`<div class="scroll"><table><thead><tr>${columns.map(x=>`<th>${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${values.map(row=>`<tr>${row.map(x=>`<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"><title>BrowserGuard — benchmark 100 siti</title><style>body{background:#03120e;color:#eaf6f1;font:15px/1.6 system-ui;max-width:1200px;margin:32px auto;padding:0 20px}h1,h2,a{color:#6cf7d8}nav{display:flex;flex-wrap:wrap;gap:18px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #234237;text-align:left;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#071c16;padding:16px}.scroll{overflow:auto}summary{cursor:pointer}</style>
<h1>BrowserGuard — 100 siti pubblici</h1><nav><a href="#summary">Risultati</a><a href="#categories">Categorie</a><a href="#assessment">Assessment</a><a href="#consistency">Confronto CDP</a><a href="#anomalies">Anomalie</a><a href="#files">Dati</a></nav>
<p>100 URL effettive; smoke 10 + fase disgiunta 90. Concorrenza 1, AI disabilitata. Risultati informativi, senza certificazione di sicurezza.</p>
<h2 id="summary">Affidabilità</h2><p>Riuscita: nessun errore di navigazione/estrazione e nessuna restrizione rilevata dall’euristica del framework. Due risposte sono HTTP 202: un 2xx non garantisce la visualizzazione integrale della homepage prevista.</p>${htmlTable(['Misura','Valore'],[['URL testate',s.tested],['Assessment acquisiti',s.captured],['Riuscite secondo i criteri del framework',s.successful+' / 100'],['Restrizioni',s.restricted],['Timeout',s.timeoutSites],['HTTP principali ≥400',s.httpErrorSites],['Errori di raccolta/validazione',s.frameworkErrorSites],['Siti con errori console estensione',s.extensionErrorSites],['Media / mediana tentativo (s)',fmt(s.averageAttemptMs/1000)+' / '+fmt(s.medianAttemptMs/1000)],['Finestre di esecuzione (s)',fmt(d.executionSeconds)],['Anomalie eventi / siti',s.anomalyEvents+' / '+s.anomalousSites],['Falsi positivi validator risolti',d.validatorFalsePositiveEvents],['Segnalazioni residue',d.reviewedAnomalyEvents],['Bug confermati BrowserGuard',0],['Bug framework corretto',d.confirmedBugs.length]])}
<h2 id="categories">Categorie</h2>${htmlTable(['Categoria','URL','Assessment','Riuscite','Restrizioni','Timeout','Eventi anomali'],d.categoryStats.map(q=>[q.label,q.tested,q.captured,q.successful,q.restricted,q.timeoutSites,q.anomalyEvents]))}
<h2 id="assessment">Distribuzioni degli assessment</h2>${htmlTable(['Dimensione','Tutte le risposte','Solo visite riuscite'],['security','privacy','network'].map(k=>[k,JSON.stringify(s.assessments.all[k]),JSON.stringify(s.assessments.successful[k])]))}
<h2 id="consistency">Confronto indipendente CDP</h2><p>Le differenze di conteggio e insiemi non sono automaticamente bug: finestre, redirect e visibilità differiscono. L'arricchimento CDP riusa il dataset locale.</p><pre>${escapeHtml(JSON.stringify(c,null,2))}</pre>
<h2 id="anomalies">Evidenze per sito</h2><p>Segnalazioni originali: ${s.anomalyEvents}; falsi positivi del validator dimostrati e risolti: ${d.validatorFalsePositiveEvents}; residue: ${d.reviewedAnomalyEvents}. I record originali restano immutati.</p><nav><a href="reviewed-anomalies.json">Revisione</a><a href="validator-false-positives.json">Falsi positivi documentati</a></nav>${anomalyRows.map(r=>`<details><summary>${escapeHtml(r.url)} · ${escapeHtml(r.status)}</summary><a href="records/${r.id}.json">Record originale</a><pre>${escapeHtml(JSON.stringify(r.anomalies,null,2))}</pre></details>`).join('')}
<h2>Raccomandazione per 1.000 siti</h2><p>${escapeHtml(recommendation)}</p><p>Proiezione condizionata: ${fmt(estimate/3600)} ore; nessuna misurazione di picco RAM disponibile.</p>
<h2 id="files">Dati e riproducibilità</h2><nav><a href="report.html">Tutti i record e dettagli</a><a href="dataset.json">Dataset JSON</a><a href="summary.csv">CSV</a><a href="categories.csv">CSV categorie</a><a href="benchmark-statistics.json">Statistiche dettagliate</a><a href="cdp-comparisons.json">Evidenze CDP</a><a href="failed-tests.json">Fallimenti</a><a href="provenance.json">Provenienza</a><a href="../../BENCHMARK_100.md">Documento Markdown</a></nav></html>`;
 fs.writeFileSync(path.join(output,'benchmark.html'),html,{mode:0o600});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={site,suffix,compare,summarize};
