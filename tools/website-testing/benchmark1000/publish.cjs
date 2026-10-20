// Aggregate-only GitHub bundle. Raw execution records/caches/profiles are excluded.
const fs=require('node:fs'),path=require('node:path');
const {sha}=require('./core.cjs');
const base=path.resolve(__dirname,'..'),out=path.join(base,'runs/benchmark1000'),pub=path.join(base,'publication/benchmark1000');
function copy(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
function tree(from,to){for(const entry of fs.readdirSync(from,{withFileTypes:true})){const source=path.join(from,entry.name),target=path.join(to,entry.name);if(entry.isDirectory())tree(source,target);else copy(source,target);}}
function main(){
 const audit=JSON.parse(fs.readFileSync(path.join(out,'audit.json'))),stats=JSON.parse(fs.readFileSync(path.join(out,'benchmark-statistics.json')));if(!audit.passed||audit.completed!==1000)throw Error('Publication requires successful final audit');
 fs.mkdirSync(pub,{recursive:true});
 for(const name of ['benchmark1000.txt','benchmark1000.json','benchmark1000.csv','DATASET_1000.md'])copy(path.join(base,'datasets',name),path.join(pub,'corpus',name));
 tree(path.join(base,'analysis/output/benchmark1000/figures'),path.join(pub,'figures'));
 tree(path.join(base,'analysis/output/benchmark1000/tables'),path.join(pub,'tables'));
 copy(path.join(base,'analysis/output/benchmark1000/BENCHMARK_ANALYSIS.md'),path.join(pub,'ANALYSIS.md'));
 fs.writeFileSync(path.join(pub,'METHODS.md'),fs.readFileSync(path.join(__dirname,'README.md'),'utf8').replace('(../datasets/DATASET_1000.md)','(corpus/DATASET_1000.md)'));
 fs.writeFileSync(path.join(pub,'aggregate-statistics.json'),JSON.stringify(stats,null,2)+'\n');
 const fullReport=fs.readFileSync(path.join(base,'BENCHMARK_1000.md'),'utf8').replaceAll('datasets/DATASET_1000.md','corpus/DATASET_1000.md').replaceAll('analysis/output/benchmark1000/tables/','tables/').replaceAll('analysis/output/benchmark1000/figures/','figures/').replaceAll('analysis/output/benchmark1000/BENCHMARK_ANALYSIS.md','ANALYSIS.md').replaceAll('benchmark1000/README.md','METHODS.md').replaceAll('BENCHMARK_COMPARISON.md','COMPARISON.md');
 fs.writeFileSync(path.join(pub,'BENCHMARK_1000.md'),fullReport);
 fs.writeFileSync(path.join(pub,'COMPARISON.md'),fs.readFileSync(path.join(base,'BENCHMARK_COMPARISON.md'),'utf8').replaceAll('BENCHMARK_100.md','HISTORICAL_100.md'));
 const historical=JSON.parse(fs.readFileSync(path.join(base,'runs/benchmark100/benchmark-statistics.json'))).stats;
 fs.writeFileSync(path.join(pub,'HISTORICAL_100.md'),'# Historical 100-site aggregate reference\n\nDerived read-only from the unchanged original aggregate. Production: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`.\n\n'+JSON.stringify({tested:historical.tested,captured:historical.captured,successful:historical.successful,restricted:historical.restricted,navigationErrors:historical.navigationErrors,timeoutSites:historical.timeoutSites,medianAttemptMs:historical.medianAttemptMs,assessments:historical.assessments.all},null,2)+'\n\nThis is a companion summary, not a rewritten historical dataset or a causal comparison.\n');
 copy(path.join(out,'production-source.patch'),path.join(pub,'production-source.patch'));
 const scriptFiles=[];for(const name of fs.readdirSync(__dirname))if(/\.(cjs|py)$/.test(name)){copy(path.join(__dirname,name),path.join(pub,'script-snapshots/benchmark1000',name));scriptFiles.push(name);}
 for(const name of ['run.cjs','collect.cjs','validate.cjs','storage.cjs','report.cjs','config.cjs','package.json','package-lock.json'])copy(path.join(base,name),path.join(pub,'script-snapshots/shared',name));
 copy(path.join(base,'analyze-benchmark100.cjs'),path.join(pub,'script-snapshots/shared/analyze-benchmark100.cjs'));
 for(const name of fs.readdirSync(path.join(base,'analysis')).filter(name=>name.endsWith('.py')||name==='requirements.txt'))copy(path.join(base,'analysis',name),path.join(pub,'script-snapshots/analysis',name));
 const executionManifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
 const environment={gitCommit:executionManifest.gitCommit,harnessHash:executionManifest.harnessHash,sourceFiles:executionManifest.sourceFiles,node:executionManifest.node,playwright:executionManifest.playwright,chromium:executionManifest.browserVersion,platform:executionManifest.platform,arch:executionManifest.arch,physicalRamBytes:executionManifest.physicalRamBytes,configuration:Object.fromEntries(Object.entries(executionManifest.config).filter(([key])=>!['output','urlsFile'].includes(key))),resourceLimits:executionManifest.limits,executions:executionManifest.executions.map(e=>({startedAt:e.startedAt,endedAt:e.endedAt,stopped:e.stopped,reason:e.reason})),sourceHash:audit.sourceHash,corpusSha256:audit.corpusSha256,completed:audit.completed,totalTestsPassed:audit.totalTestsPassed,productionUnchanged:true,historicalOutputsUnchanged:true,resourceSemantics:stats.resources.semantics};
 fs.writeFileSync(path.join(pub,'reproducibility.json'),JSON.stringify(environment,null,2)+'\n');
 const lines=['# BrowserGuard: 1,000-site benchmark publication','',
 `Final audit passed; ${audit.completed} unique records; production \`${audit.sourceHash}\`. This bundle contains reviewed public corpus metadata and aggregates, not raw browsing records.`, '',
 '- [Full benchmark report](BENCHMARK_1000.md)',
 '- [100 vs 1000 comparison](COMPARISON.md)',
 '- [Corpus and source licenses](corpus/DATASET_1000.md)',
 '- [Statistical report with six PNG/SVG figures](ANALYSIS.md)',
 '- [Aggregate statistics](aggregate-statistics.json)',
 '- [Reproducibility identifiers](reproducibility.json)',
 '- [Methodology and commands](METHODS.md)', '',
 'The script-snapshots directory preserves testing source for review. The recorded Git commit had dirty production changes, so production-source.patch records the exact three-file delta; apply it to a fresh copy of that commit and verify the recorded fingerprint. Shared harness snapshots belong under tools/website-testing, benchmark snapshots under its benchmark1000 subdirectory. Execute the original scripts from tools/website-testing/benchmark1000 in the full repository with the recorded production version and pinned dependencies; these snapshots are not a standalone extension distribution.', '',
 'No raw request URLs/policies, browser profiles, full source dump, credentials, record logs or AI packets are automatically copied here. Raw per-site evidence remains under the ignored runs directory. Summed RSS can double-count shared pages and is not system physical RAM. CDP agreement is observation agreement, not detector accuracy or confirmed website safety.', '',
 'The source sample is purposive, not representative. Categories are directory topics and include related university/community/technical pages. The old and new versions/samples differ; the comparison is descriptive, not an A/B accuracy experiment.', '',
 'With content from [Curlie.org](https://curlie.org/) - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.',''];
 fs.writeFileSync(path.join(pub,'README.md'),lines.join('\n'));
 fs.appendFileSync(path.join(pub,'README.md'),'\nPython script snapshots belong under tools/website-testing/analysis. The only shared plotting change separates overlapping small-segment annotations; historical figures and statistics were not regenerated.\n');
 const artifacts={};function list(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())list(file);else if(e.name!=='publication-manifest.json')artifacts[path.relative(pub,file)]=sha(fs.readFileSync(file));}}list(pub);
 fs.writeFileSync(path.join(pub,'publication-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),sourceHash:audit.sourceHash,artifacts,rawRecordsIncluded:false,commitOrPushPerformed:false},null,2)+'\n');
 console.log('Publication artifacts:',Object.keys(artifacts).length);
}
if(require.main===module){try{main();}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={main};
