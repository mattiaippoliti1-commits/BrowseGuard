const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {csvCell}=require('../report.cjs');
const columns=['timestamp','elapsedSeconds','nodeRssBytes','chromiumRssBytes','attributableRssSumBytes','nodeCpuPercent','chromiumCpuPercent','browserProcesses','memoryPressureLevel','diskAvailableBytes','outputBytes','sampleError'];
function outputBytes(directory){let n=0;for(const e of fs.readdirSync(directory,{withFileTypes:true})){const p=path.join(directory,e.name);n+=e.isDirectory()?outputBytes(p):e.isFile()?fs.statSync(p).size:0;}return n;}
function parsePs(text){return text.trim().split('\n').filter(Boolean).map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/);return m?{pid:+m[1],ppid:+m[2],rssBytes:+m[3]*1024,cpuPercent:+m[4],command:m[5]}:null;}).filter(Boolean);}
function attributable(rows,pid){const descendants=new Set([pid]);let change=true;while(change){change=false;for(const r of rows)if(descendants.has(r.ppid)&&!descendants.has(r.pid)){descendants.add(r.pid);change=true;}}return rows.filter(r=>descendants.has(r.pid)&&/Google Chrome|Chromium/i.test(r.command));}
function stopReason(sample,limits,highProcessSamples=0){
 if(sample.diskAvailableBytes<limits.minDiskBytes)return 'disk-space-below-configured-minimum';
 if(sample.memoryPressureLevel===4)return 'macos-critical-memory-pressure';
 if(highProcessSamples>=limits.processGrowthSamples)return 'persistent-excess-attributable-browser-processes';
 return null;
}
function createMonitor(output,limits,onStop){
 const file=path.join(output,'resource-monitoring.csv'),started=Date.now();let high=0,sampleErrors=0;
 if(!fs.existsSync(file))fs.writeFileSync(file,columns.join(',')+'\n',{mode:0o600});
 const stats={samples:0,peakNodeRssBytes:0,peakChromiumRssBytes:0,peakAttributableRssSumBytes:0,peakBrowserProcesses:0,minimumDiskAvailableBytes:null,physicalRamBytes:os.totalmem(),semantics:'RSS, not virtual memory; sum may double-count shared pages. ps CPU percentages can exceed 100 across cores. Chromium includes attributable descendants only; system-wide RAM is not measured by the sum.'};
 function sample(){
  const s={timestamp:new Date().toISOString(),elapsedSeconds:(Date.now()-started)/1000,nodeRssBytes:process.memoryUsage().rss};
  try{
   const rows=parsePs(execFileSync('ps',['-axo','pid=,ppid=,rss=,%cpu=,command='],{encoding:'utf8',timeout:3000,maxBuffer:4*1024*1024}));
   const browser=attributable(rows,process.pid),node=rows.find(r=>r.pid===process.pid);
   s.chromiumRssBytes=browser.reduce((a,r)=>a+r.rssBytes,0);s.attributableRssSumBytes=s.nodeRssBytes+s.chromiumRssBytes;
   s.nodeCpuPercent=node?.cpuPercent??null;s.chromiumCpuPercent=browser.reduce((a,r)=>a+r.cpuPercent,0);s.browserProcesses=browser.length;
   if(process.platform==='darwin')s.memoryPressureLevel=Number(execFileSync('/usr/sbin/sysctl',['-n','kern.memorystatus_vm_pressure_level'],{encoding:'utf8',timeout:2000}).trim());
   const disk=fs.statfsSync(output);s.diskAvailableBytes=disk.bavail*disk.bsize;s.outputBytes=outputBytes(output);
   high=s.browserProcesses>limits.maxBrowserProcesses?high+1:0;sampleErrors=0;
   stats.samples++;stats.peakNodeRssBytes=Math.max(stats.peakNodeRssBytes,s.nodeRssBytes);stats.peakChromiumRssBytes=Math.max(stats.peakChromiumRssBytes,s.chromiumRssBytes);
   stats.peakAttributableRssSumBytes=Math.max(stats.peakAttributableRssSumBytes,s.attributableRssSumBytes);stats.peakBrowserProcesses=Math.max(stats.peakBrowserProcesses,s.browserProcesses);
   stats.minimumDiskAvailableBytes=stats.minimumDiskAvailableBytes===null?s.diskAvailableBytes:Math.min(stats.minimumDiskAvailableBytes,s.diskAvailableBytes);
   const reason=stopReason(s,limits,high);if(reason)onStop(reason,s);
  }catch(e){s.sampleError=e.message;sampleErrors++;if(sampleErrors>=3)onStop('resource-monitor-unavailable-repeatedly',s);}
  fs.appendFileSync(file,columns.map(k=>csvCell(s[k])).join(',')+'\n');return s;
 }
 return {sample,stats,start(){sample();return setInterval(sample,limits.sampleIntervalMs);}};
}
module.exports={columns,outputBytes,parsePs,attributable,stopReason,createMonitor};
