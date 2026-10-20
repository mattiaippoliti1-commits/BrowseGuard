const fs=require('node:fs'),path=require('node:path');
const {sha,guardProduction}=require('./core.cjs'),{atomicJson}=require('../storage.cjs');
const base=path.resolve(__dirname,'..'),pub=path.join(base,'publication/benchmark1000');
function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(pub,'publication-manifest.json'))),issues=[];
 for(const [name,hash]of Object.entries(manifest.artifacts)){
  const file=path.join(pub,name);if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==hash)issues.push('changed/missing '+name);
  if(/\.(pem|key|p12|pfx|log)$/.test(name)||/records\/|source-cache\/|profile/i.test(name))issues.push('disallowed publication file '+name);
 }
 const docs=[path.join(base,'BENCHMARK_1000.md'),path.join(base,'BENCHMARK_COMPARISON.md'),path.join(base,'datasets/DATASET_1000.md')];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.md'))docs.push(p);}}walk(pub);
 const seen=new Set();for(const file of docs){if(seen.has(file))continue;seen.add(file);const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const url=match[1].split('#')[0].trim().replace(/^<|>$/g,'');if(!url||/^[a-z]+:/i.test(url))continue;
  const dest=path.resolve(path.dirname(file),decodeURIComponent(url));if(!fs.existsSync(dest))issues.push(path.relative(base,file)+' → '+url);
 }}
 if(issues.length)throw Error('Publication audit failed: '+JSON.stringify(issues));guardProduction();
 const audit={passed:true,checkedArtifacts:Object.keys(manifest.artifacts).length,markdownDocuments:seen.size,brokenLinks:[],rawRecordsIncluded:false,commitOrPushPerformed:false};
 atomicJson(path.join(base,'runs/benchmark1000/publication-audit.json'),audit);console.log(JSON.stringify(audit));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={main};
