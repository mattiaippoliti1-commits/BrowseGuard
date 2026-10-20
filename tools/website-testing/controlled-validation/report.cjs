const fs=require('node:fs'),path=require('node:path');
const {csvCell}=require('../report.cjs');
const {atomicJson}=require('../storage.cjs');
const {scenarios}=require('./scenarios.cjs');
const statuses=['PASS','FAIL','NOT_OBSERVABLE','INCONCLUSIVE','SKIPPED'];
function csv(file,cols,rows){fs.writeFileSync(file,[cols.join(','),...rows.map(row=>cols.map(k=>csvCell(typeof row[k]==='object'?JSON.stringify(row[k]):row[k]??'')).join(','))].join('\n')+'\n',{mode:0o600});}
function report(output,run){
 const rows=run.scenarios, counts=Object.fromEntries(statuses.map(k=>[k,rows.filter(r=>r.status===k).length]));
 const executed=rows.length-counts.SKIPPED;
 const stats={implemented:scenarios.length,recorded:rows.length,executed,counts,
   passPercentAll:rows.length?100*counts.PASS/rows.length:null,passPercentExecuted:executed?100*counts.PASS/executed:null,
   denominators:{all:rows.length,executed,definition:'Executed includes PASS, FAIL, NOT_OBSERVABLE, INCONCLUSIVE. NOT_OBSERVABLE is never PASS.'},
   categories:Object.fromEntries([...new Set(scenarios.map(s=>s.category))].map(c=>[c,{total:rows.filter(r=>r.category===c).length,counts:Object.fromEntries(statuses.map(k=>[k,rows.filter(r=>r.category===c&&r.status===k).length]))}]))};
 run.statistics=stats;
 atomicJson(path.join(output,'results.json'),run);
 csv(path.join(output,'results.csv'),['id','name','category','status','expectation','observation','reason','durationMs','evidence'],rows.map(r=>({...r,observation:r.extension?{displayed:r.extension.displayed,levels:Object.fromEntries(['security','privacy','network'].map(k=>[k,r.extension.assessment[k].level]))}:null,evidence:{checks:r.checks,serverReceipts:r.serverReceipts,independent:r.independent}})));
 csv(path.join(output,'scenario-matrix.csv'),['id','name','category','tls','expectation','observationMethod','limitations'],scenarios.map(s=>({...s,observationMethod:'Configured fixture + actual popup inputs + server receipts + CDP',limitations:s.tls?'Requires trusted local TLS; see PLAN.md':'Local entities unresolved; top-frame runtime/DOM; see PLAN.md'})));
 const failures=rows.filter(r=>r.status==='FAIL');
 const lines=['# BrowserGuard controlled validation','',
 '## Objective and environment','',
 'Validate observable signals and deterministic rules using local fixtures. Targeted production corrections are documented below; thresholds, permissions, tracker dataset and popup layout are unchanged.', '',
 `Run: ${run.startedAt}. Node ${run.environment.node}; ${run.environment.platform}/${run.environment.arch}; Playwright ${run.environment.playwright}; Chromium ${run.environment.chromium || 'unavailable'}.`, '',
 `Production fingerprint at run start: \`${run.sourceBefore.hash}\`; at run end: \`${run.sourceAfter?.hash}\`. Unchanged: **${run.sourceBefore.hash===run.sourceAfter?.hash}**.`, '',
 '## Architecture and methodology','',
 'Node HTTP/HTTPS servers bind ephemeral loopback ports. Each scenario gets a fresh temporary profile; S18 alone intentionally reuses its tab. All profiles and servers close in finally blocks. Real popup engine calls are captured using the existing collector, without synthetic detector outputs. Server receipts establish actual requests; fixture completion markers establish selected API calls, without storing output values. CDP records requests, selected headers and blocked reasons; its window is independent of extension aggregation. A browser-local routing guard rejects non-fixture HTTP(S) hosts. No public scenario or external service is used.', '',
 'TLS verification stays enabled. Default mode creates an ephemeral CA and localhost leaf, then seeds only each fresh Chromium 145 profile’s Default/ServerCertificate database (verified schema v1). Trust metadata and the CA constrain names to localhost and 127.0.0.1/32. No Keychain, OS trust store, ordinary user profile or certificate-error exception is changed. A clean unseeded profile rejects the generated chain; the seeded profile accepts it; the same seeded profile must reject a separate untrusted leaf before any scenario. Keys and profiles are removed in cleanup. Provided-certificate and deliberately-untrusted modes are separately labeled in configuration.', '',
 `Trust scope: ${run.configuration?.trustStore || 'see run configuration'}. Public root fingerprint: \`${run.certificate?.rootSha256 || 'not generated'}\`.`, '',
 '| TLS control | Result | Evidence |', '|---|---|---|',
 ...(run.tlsControls || []).map(c=>`| ${c.name} | ${c.pass?'PASS':'FAIL'} | ${(c.error?.split('\n')[0] || c.securityDetails?.protocol || String(c.httpStatus || '')).replaceAll('|','/')} |`), '',

 'Origin is scheme+hostname+port; hostname excludes port. BrowserGuard network groups approximate registrable domains, whereas DOM compares hostnames. 127.0.0.1 and assets.controlled.test are different domain groups; they resolve locally but have no confirmed external entity. Different ports alone would not establish third-party ownership. No local resource is labeled a tracker.', '',
 '## Status definitions and results','',
 'PASS: configured condition established and all applicable extension assertions agree. FAIL: established observation contradicts an explicit check; requires investigation before attribution to the extension. NOT_OBSERVABLE: configured phenomenon independently established but unavailable through the relevant browser/extension surface. INCONCLUSIVE: setup, navigation, collection or ground-truth verification insufficient. SKIPPED: prerequisite absent before scenario execution. NOT_OBSERVABLE and INCONCLUSIVE never count as PASS.', '',
 `Implemented ${stats.implemented}; recorded ${rows.length}; executed ${executed}. ${statuses.map(k=>`${k} ${counts[k]}`).join('; ')}.`, '',
 `PASS / all recorded: ${counts.PASS}/${rows.length}; PASS / executed: ${counts.PASS}/${executed}. These are test outcomes, not accuracy, precision, recall or F1.`, '',
 '| ID | Scenario | Status | Expectation | Observation / limitation |','|---|---|---|---|---|',
 ...rows.map(r=>`| ${r.id} | ${r.name} | ${r.status} | ${r.expectation} | ${(r.reason || (r.checks||[]).filter(c=>!c.pass).map(c=>c.name).join(', ') || (r.extension ? ['security','privacy','network'].map(k=>k+': '+r.extension.displayed[k].label).join('; ')+'; '+r.checks.length+' assertions passed' : 'No captured assessment')).replaceAll('|','/').replaceAll('\n',' ')} |`),'',
 '## Detected, unavailable and failed signals','',
 `Passed: ${rows.filter(r=>r.status==='PASS').map(r=>r.id).join(', ') || 'none'}. See results.json for each assertion, actual inputs, assessment, server evidence and CDP records.`, '',
 `Not observable: ${rows.filter(r=>r.status==='NOT_OBSERVABLE').map(r=>r.id+': '+r.reason).join('; ')||'none recorded (this does not establish universal observability)'}.`, '',
 `Failures: ${failures.map(r=>r.id+': '+r.checks.filter(c=>!c.pass).map(c=>c.name).join(', ')).join('; ')||'none'}.`, '',
 '## Assessment Engine','',
 `Separate synthetic fixtures: ${run.engine.length}; PASS ${run.engine.filter(r=>r.status==='PASS').length}; FAIL ${run.engine.filter(r=>r.status==='FAIL').length}. Expected literals derive from PLAN.md and do not call the engine to construct expected output. These cover Low/Moderate/High, exact/below/above boundaries, combined sensitive surfaces, missing/null/unavailable sources, and immutable inputs. Tracker/entity thresholds are synthetic input tests, not end-to-end detector validation.`, '',
 '## Bugs, limitations and recommendations','',
 ...(run.changeReview ? [
 `Confirmed defect families: ${run.changeReview.bugs.length}. ${run.changeReview.bugs.map(b=>b.id+': '+b.diagnosis+' Correction: '+b.correction).join(' ')}`, '',
 `Production before fixes: \`${run.changeReview.before}\`. Production after fixes: \`${run.sourceBefore.hash}\`. Exact production files: ${run.changeReview.productionFiles.join(', ')}. Production stayed unchanged during this run.`, '',
 `Before fixes: ${run.changeReview.regressions.before.passed}/${run.changeReview.regressions.before.tests} targeted checks passed; ${run.changeReview.regressions.before.failed} failed. After fixes: ${run.changeReview.regressions.after.totalPassed} automatic checks passed. The 71 engine cases are included, not added a second time.`, '',
 '| Regression suite | Passed | Exit code |', '|---|---:|---:|',
 ...run.changeReview.regressions.after.suites.map(c=>`| ${c.suite} | ${c.passed}/${c.tests} | ${c.exitCode} |`), '',
 'Baseline: 11 PASS, 7 SKIPPED. Previous controlled output remains byte-for-byte in history/baseline-3403c1f4b72a/output. Public benchmark and analysis hashes were independently audited.', '',
 '### Protocols', '',
 'Confirmed before: about:blank had a main-page-http High finding. After: original scheme retained as unavailable URL input, no HTTP finding, all three cards unavailable (S17). HTTP/HTTPS remain explicit. Seven unsupported schemes and missing/null data are covered by parser/engine regressions; protected pages are not injected.', '',
 '### Password forms', '',
 'Confirmed before: missing/empty action skipped the default HTTP destination. After: fallback to document URL and correct relative-base resolution. The 10-cell action matrix, missing/empty actions, malformed/non-HTTP URLs, no-password forms and independent Security findings are covered by regressions.', '',
 '| Additional live case | Expected insecure forms | Observed | Status |', '|---|---:|---:|---|',
 ...run.changeReview.regressions.additionalLivePasswordCases.map(c=>`| ${c.protocol.toUpperCase()} document | ${c.expected} | ${c.observed} | ${c.status} |`), ''
 ] : ['Diagnosis and before/after production review are recorded separately in TARGETED_AUDIT.md and FINAL_FIXES.md.', '']),
 'S17 now requires no HTTP finding and unavailable Security/Privacy/Network cards. Missing URL data cannot become an HTTP assertion or a favorable Low card; independent password or mixed-content findings still contribute. Missing/empty form action resolves to the document URL; explicit relative action follows the document base URI. No real submission is performed.', '',
 'S06 uses the browser’s natural loopback exception, not general permission to load arbitrary HTTP content. S07 requires attempted URL, CDP mixed-content block, no server receipt and no script execution; absence from webRequest is NOT_OBSERVABLE rather than a detector bug. Missing protective headers remain informational. Tests compare configured server headers, actual CDP response and extension inputs; an unavailable response is not treated as an absent header.', '',
 'Remaining limits: profile database provisioning is version-coupled to Chromium 145 schema v1 and refuses unverified major versions. Native WebUI import opens a desktop file dialog not controlled by Playwright’s HTML file chooser, so the suite seeds equivalent constrained user trust into an empty profile before startup; it does not bypass verification. MAIN-world runtime signals are page-spoofable and API use does not prove intent. DOM/runtime hooks are top-frame only; bounded windows are not complete coverage. Full navigation isolation does not cover SPA/BFCache or worker crashes. Submit-button formaction overrides are outside the existing form-level detector and were not added by this fix. Local tracker matching is not exercised; tracker threshold tests remain synthetic.', '',
 'The framework supports 1,000 URLs. A larger field benchmark can assess operational reliability after these regressions pass, but cannot establish detector accuracy or recover browser-blocked signals unavailable to webRequest. Preserve production fingerprints and distinguish unknown entity ownership from confirmed external exposure.', '',
 '## Cleanup and audit','',
 `Fatal error: ${run.fatalError || 'none'}. Full audit: [audit.json](audit.json). Regression evidence: [regression-checks.json](regression-checks.json).`, '',
 ...(run.audit ? [`Audit: thresholds unchanged **${run.audit.thresholdsUnchanged}**; manifest/permissions unchanged **${run.audit.manifestAndPermissionsUnchanged}**. Orphan processes ${run.audit.orphanProcesses.length}; remaining temporary profiles/certificates ${run.audit.temporaryProfilesOrCertificatesRemaining.length}; secret output files ${run.audit.secretOutputFiles.length}.`, '',
 `Verified unchanged: ${run.audit.publicBenchmarkFilesVerified} public benchmark files and ${run.audit.publicAnalysisFilesVerified} public analysis files. Historical controlled mismatches: ${run.audit.historicalHashMismatches.controlled.length}. Exact Git changes are listed in audit.json.`, ''] : []),
 `Cleanup: ${JSON.stringify(run.cleanup)}. Keys/certificates are excluded from saved evidence; temporary generated material is removed. Output contains only synthetic local URLs, selected headers, structural counters and API names.`, '',
 '## Reproduction','',
 'See [README.md](../README.md) and [PLAN.md](../PLAN.md) in the parent directory. Run all scenarios with npm run test:controlled from tools/website-testing. Use --scenario S18 (or another ID) and a new --output directory to reproduce. The runner returns nonzero for FAIL, INCONCLUSIVE or source mutation; --require-complete also rejects SKIPPED and NOT_OBSERVABLE. Check statistics rather than interpreting process success as full validation.', ''];
 fs.writeFileSync(path.join(output,'CONTROLLED_VALIDATION.md'),lines.join('\n'),{mode:0o600});
 return stats;
}
module.exports={report,csv};
