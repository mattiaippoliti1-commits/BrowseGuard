const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {fingerprint}=require('../run.cjs');
const {idFor}=require('../config.cjs');
const EXPECTED='0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc';
const CATEGORY_IDS=['news','ecommerce','technology','education','government','finance','social','entertainment','travel','technical'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function guardProduction(){const actual=fingerprint();if(actual.hash!==EXPECTED)throw Error(`PRODUCTION_MISMATCH expected ${EXPECTED}; actual ${actual.hash}`);return actual;}
function publicHostname(host){const h=host.toLowerCase().replace(/\.$/,'');return h.includes('.')&&!h.includes(':')&&!net.isIP(h)&&h!=='localhost'&&!/\.(localhost|local|internal|test|invalid|example)$/.test(h);}
function validateCorpus(corpus,text){
 if(!Array.isArray(corpus.sites)||corpus.sites.length!==1000)throw Error('CORPUS_GATE requires exactly 1000 sourced sites; got '+corpus.sites?.length);
 const urls=new Set(),hosts=new Set(),counts={};
 for(const r of corpus.sites){const u=new URL(r.url),host=u.hostname.replace(/^www\./,'').toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!publicHostname(u.hostname))throw Error('Invalid public HTTPS corpus URL '+r.url);
  if(urls.has(r.url)||hosts.has(host))throw Error('Duplicate URL or www-normalized hostname '+r.url);
  const wikidata=/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/.test(r.source)&&r.sourceProperty==='P856';
  const curlie=/^https:\/\/curlie\.org\/en\//.test(r.source)&&r.sourceKind==='curlie-directory'&&r.sourceLicense==='CC-BY-3.0'&&r.sourceArchiveSha256===corpus.curlie?.sha256&&typeof r.sourceCategoryPath==='string';
  if(!CATEGORY_IDS.includes(r.category)||!(wikidata||curlie)||!r.verificationStatus||r.id!==idFor(r.url))throw Error('Invalid provenance/ID '+r.url);
  urls.add(r.url);hosts.add(host);counts[r.category]=(counts[r.category]||0)+1;
 }
 if(CATEGORY_IDS.some(c=>counts[c]!==100))throw Error('Category quotas must be 100 each');
 const lines=text.trim().split(/\r?\n/);if(lines.length!==1000||lines.some((v,i)=>v!==corpus.sites[i].url))throw Error('Text corpus differs from JSON order');
 return {urls:urls.size,normalizedHostnames:hosts.size,categoryCounts:counts,txtSha256:sha(text),jsonSha256:sha(JSON.stringify(corpus)),verification:'Provenance, syntax and normalized-host uniqueness; reachability deferred to real navigation.'};
}
function loadCorpus(){const base=path.join(__dirname,'../datasets'),json=fs.readFileSync(path.join(base,'benchmark1000.json')),text=fs.readFileSync(path.join(base,'benchmark1000.txt'),'utf8'),corpus=JSON.parse(json);return {corpus,identity:{...validateCorpus(corpus,text),jsonFileSha256:sha(json)}};}
function recordValid(record,site,manifest){
 if(record.schemaVersion!==1||record.id!==site.id||record.url!==site.url||record.sourceHash!==manifest.sourceHash||!Array.isArray(record.anomalies)||typeof record.status!=='string'||!Number.isFinite(record.durationMs))throw Error('Completed record is invalid or incompatible: '+site.id);
 return true;
}
function outcomes(r){const status=r.navigation?.httpStatus,error=[r.navigation?.error,r.collectionError].filter(Boolean).join(' ');
 return {assessmentCaptured:Boolean(r.extension?.assessment),partial:r.extension?.assessment?.dataStatus==='partial',
  navigationAccepted:!r.navigation?.error&&Number.isInteger(status),unrestrictedVisit:['ok','partial'].includes(r.status)&&!(status>=400),
  intendedPageVerified:false,intendedPageNote:'No semantic content verification. A 2xx or captured assessment does not establish the intended page.',
  http401:status===401,http403:status===403,http429:status===429,http5xx:status>=500&&status<600,
  restriction:Boolean(r.navigation?.blocked),timeout:/timeout/i.test(error),tlsError:/ERR_CERT_|ERR_SSL_|SSL_ERROR/i.test(error),dnsError:/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/i.test(error),
  navigationError:Boolean(r.navigation?.error),collectionError:Boolean(r.collectionError),assessmentUnavailable:!r.extension?.assessment};}
module.exports={EXPECTED,CATEGORY_IDS,sha,guardProduction,publicHostname,validateCorpus,loadCorpus,recordValid,outcomes};
