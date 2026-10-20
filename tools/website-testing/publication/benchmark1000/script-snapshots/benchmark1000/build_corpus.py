#!/usr/bin/env python3
"""Source official HTTPS URLs from CC0 Wikidata statements, not generated domains."""
import csv
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

BASE=Path(__file__).resolve().parent
DATA=BASE.parent/'datasets'
CACHE=BASE/'source-cache'
# Direct P31 classes, verified against Wikidata. No undocumented model categorization.
CATEGORIES=[
 ('news','Informazione e giornali',['Q11032']),
 ('ecommerce','E-commerce',['Q4382945']),
 ('technology','Tecnologia e software',['Q7397']),
 ('education','Università e istruzione',['Q3918']),
 ('government','Pubblica amministrazione',['Q327333']),
 ('finance','Banche e servizi finanziari',['Q22687']),
 ('social','Social network e community',['Q3220391','Q168210']),
 ('entertainment','Intrattenimento e streaming',['Q2001305','Q14350']),
 ('travel','Viaggi e turismo',['Q217107','Q46970','Q27686']),
 ('technical','Siti tecnici e documentazione',['Q9143']),
]
UA='BrowserGuardBenchmark/1.0 (academic local browser benchmark; Wikidata CC0 corpus preparation)'
LICENSE='https://www.wikidata.org/wiki/Wikidata:Licensing'

def host_key(host):
 return re.sub(r'^www\.', '', host.lower().rstrip('.'))

def clean_url(raw):
 try:
  u=urllib.parse.urlsplit(raw)
  host=(u.hostname or '').encode('idna').decode('ascii').lower()
  if u.scheme!='https' or u.username or u.password or u.query or u.fragment or u.port not in (None,443): return None
  if '.' not in host or host.endswith(('.local','.localhost','.test','.invalid','.example','.internal')) or host=='localhost':return None
  try:
   ipaddress.ip_address(host)
   return None  # Prefer actual public DNS hostnames, never numeric/IP literals.
  except ValueError:pass
  if any(part in u.path.lower() for part in ['/login','/signin','/sign-in','/account','/checkout','/payment','/submit','/register']):return None
  if re.search(r'\.(pdf|zip|exe|dmg|jpg|png|gif|mp4|mp3)$',u.path,re.I):return None
  if len([p for p in u.path.split('/') if p])>2:return None
  return urllib.parse.urlunsplit(('https',host,u.path or '/','',''))
 except (ValueError,UnicodeError):return None

def query_for(classes):
 values=' '.join('wd:'+q for q in classes)
 return f'''SELECT DISTINCT ?item ?website ?type ?name WHERE {{
 VALUES ?type {{ {values} }}
 ?item wdt:P31 ?type; wdt:P856 ?website.
 FILTER(STRSTARTS(STR(?website), "https://"))
 FILTER NOT EXISTS {{ ?item wdt:P576 ?end }}
 OPTIONAL {{ ?item rdfs:label ?name. FILTER(LANG(?name)="en") }}
 BIND(xsd:integer(STRAFTER(STR(?item),"entity/Q")) AS ?order)
 }} ORDER BY ?order STR(?website) LIMIT 1000'''

def build(offline=False):
 CACHE.mkdir(parents=True,exist_ok=True);DATA.mkdir(exist_ok=True)
 candidates={};sources=[]
 for category,label,classes in CATEGORIES:
  query=query_for(classes); file=CACHE/(category+'.json')
  queryfile=CACHE/(category+'.rq');queryfile.write_text(query+'\n')
  if not file.exists():
   if offline:
    sources.append({'category':category,'classes':classes,'status':'not-retrieved-source-service-unavailable'});candidates[category]=[];continue
   stamp=CACHE/'last-request.txt'
   if stamp.exists():
    wait=65-(time.time()-float(stamp.read_text()))
    if wait>0:
     print(category,'respecting endpoint rate limit; wait',round(wait),'seconds',flush=True);time.sleep(wait)
   stamp.write_text(str(time.time()))
   url='https://query.wikidata.org/sparql?'+urllib.parse.urlencode({'query':query,'format':'json'})
   request=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/sparql-results+json'})
   try:
    with urllib.request.urlopen(request,timeout=65) as response:
     data=json.load(response)
    file.write_text(json.dumps(data,ensure_ascii=False)+'\n')
   except Exception as e:
    print(category,type(e).__name__,str(e),flush=True)
    sources.append({'category':category,'status':'retrieval-error','error':str(e),'classes':classes});candidates[category]=[]
    if isinstance(e,urllib.error.HTTPError) and e.code==429:
     print('Endpoint throttled; stop retrieval and preserve sourced subset. Resume only after the documented waiting period.',flush=True)
     break
    continue
   time.sleep(2)
  data=json.loads(file.read_text());rows=data['results']['bindings']
  source={'category':category,'classes':classes,'endpoint':'https://query.wikidata.org/sparql','query':query,'license':'CC0-1.0','licenseURL':LICENSE,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(file.stat().st_mtime)),'responseSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'returnedRows':len(rows)}
  sources.append(source);candidates[category]=[]
  for row in rows:
   raw=row['website']['value'];url=clean_url(raw)
   if not url:continue
   item=row['item']['value'].rsplit('/',1)[-1]
   candidates[category].append({'url':url,'category':category,'categoryLabel':label,'name':row.get('name',{}).get('value',item),'source':'https://www.wikidata.org/wiki/'+item,'sourceProperty':'P856','sourceClass':row['type']['value'].rsplit('/',1)[-1],'sourceURL':raw,'verificationStatus':'source-stated-official-HTTPS; syntax/public-DNS-name validated; reachability deferred','notes':'Direct Wikidata P31 category; no authentication attempted; landing-page visibility assessed during navigation.'})
  print(category,'source rows',len(rows),'eligible',len(candidates[category]),'hosts',len({host_key(urllib.parse.urlsplit(r['url']).hostname) for r in candidates[category]}),flush=True)
 # Known redirect aliases from the unchanged historical benchmark; no new HTTP probes.
 aliases={}
 historical=BASE.parent/'runs/benchmark100/records'
 if historical.exists():
  for file in sorted(historical.glob('*.json')):
   record=json.loads(file.read_text())
   try:
    original=urllib.parse.urlsplit(record['url']).hostname; final=urllib.parse.urlsplit(record['navigation']['finalUrl']).hostname
    if original and final and clean_url(record['navigation']['finalUrl']):aliases[host_key(original)]=host_key(final)
   except (KeyError,ValueError):pass
 # Allocate scarcer categories first, with stable within-category Wikidata order.
 used=set();selected={}
 order=sorted(CATEGORIES,key=lambda c:len({host_key(urllib.parse.urlsplit(r['url']).hostname) for r in candidates.get(c[0],[])}))
 for category,_,_ in order:
  chosen=[]
  for row in candidates.get(category,[]):
   raw_host=host_key(urllib.parse.urlsplit(row['url']).hostname)
   host=aliases.get(raw_host,raw_host)
   row['knownRedirectCanonicalHost']=host
   if host in used:continue
   used.add(host);chosen.append(row)
   if len(chosen)==100:break
  selected[category]=chosen
 sites=[]
 # Round-robin order balances every 10/20/100 prefix without observing outcomes.
 for n in range(100):
  for category,_,_ in CATEGORIES:
   if n<len(selected.get(category,[])):
    row=selected[category][n].copy();row['id']=hashlib.sha256(row['url'].encode()).hexdigest();sites.append(row)
 counts={c:len(selected.get(c,[])) for c,_,_ in CATEGORIES}
 result={'name':'BrowserGuard public 1000-site sourced benchmark','license':'CC0-1.0 (Wikidata structured URL/type/name statements)','licenseURL':LICENSE,'selection':'Purposive deterministic source sample, direct P31 classes, numerically ordered Wikidata IDs, scarce categories allocated first, round-robin execution; no claim of representativeness.','sources':sources,'categoryCounts':counts,'knownRedirectSource':'Unchanged runs/benchmark100/records; www-normalized final host aliases when available','sites':sites,'missing':1000-len(sites),'reachabilityPolicy':'No preflight website requests. Operational failures and restrictions remain results, not replacement candidates.'}
 (DATA/'benchmark1000.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
 content=''.join(r['url']+'\n' for r in sites);(DATA/'benchmark1000.txt').write_text(content)
 cols=['id','url','category','categoryLabel','name','source','sourceProperty','sourceClass','sourceURL','verificationStatus','notes','knownRedirectCanonicalHost']
 with (DATA/'benchmark1000.csv').open('w',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=cols);writer.writeheader();writer.writerows(sites)
 print(json.dumps({'total':len(sites),'missing':1000-len(sites),'categories':counts,'sha256':hashlib.sha256(content.encode()).hexdigest()},indent=2),flush=True)
 return result
if __name__=='__main__':build(offline='--offline' in sys.argv)
