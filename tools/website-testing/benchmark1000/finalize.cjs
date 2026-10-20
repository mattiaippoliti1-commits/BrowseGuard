// Run only after collection; all actions are local and outputs remain separable.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {guardProduction,loadCorpus}=require('./core.cjs'),{atomicJson}=require('../storage.cjs');
const base=path.resolve(__dirname,'..'),root=path.resolve(base,'../..'),out=path.join(base,'runs/benchmark1000');
function invoke(name,command,args){
 const result=spawnSync(command,args,{cwd:root,env:process.env,encoding:'utf8',maxBuffer:8*1024*1024});
 fs.writeFileSync(path.join(out,name+'.log'),(result.stdout||'')+(result.stderr||''),{mode:0o600});
 if(result.status!==0)throw Error(name+' failed; see local '+name+'.log');
 console.log(name,'PASS');return result.stdout;
}
function main(){
 guardProduction();loadCorpus();
 if(fs.existsSync(path.join(out,'.lock')))throw Error('Collector still owns output');
 const checkpoint=JSON.parse(fs.readFileSync(path.join(out,'checkpoint.json')));if(checkpoint.completed!==1000||checkpoint.fatalError)throw Error('Collection incomplete or fatal; preserve partial evidence and investigate');
 const stages=[];
 try{
  invoke('offline-enrichment',process.execPath,[path.join(__dirname,'analyze.cjs')]);stages.push('offline-enrichment');
  invoke('python-analysis',path.join(base,'analysis/.venv/bin/python'),[path.join(base,'analysis/analyze.py'),'--input',out,'--output',path.join(base,'analysis/output/benchmark1000'),'--categories',path.join(base,'datasets/benchmark1000.csv')]);stages.push('python-analysis');
  invoke('final-audit',process.execPath,[path.join(__dirname,'audit.cjs')]);stages.push('final-audit');
  invoke('markdown-reports',process.execPath,[path.join(__dirname,'write_reports.cjs')]);stages.push('markdown-reports');
  invoke('publication',process.execPath,[path.join(__dirname,'publish.cjs')]);stages.push('publication');
  invoke('link-and-publication-audit',process.execPath,[path.join(__dirname,'check_publication.cjs')]);stages.push('link-and-publication-audit');
  atomicJson(path.join(out,'finalization.json'),{stages,completedAt:new Date().toISOString(),status:'complete-reports-audit-publication'});
 }catch(e){atomicJson(path.join(out,'finalization.json'),{stages,status:'incomplete',error:e.message});throw e;}
 guardProduction();
}
if(require.main===module){try{main();}catch(e){console.error(e.stack);process.exitCode=1;}}
