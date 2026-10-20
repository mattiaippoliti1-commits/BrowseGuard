#!/usr/bin/env python3
"""Combine sourced Wikidata entries with the licensed, offline Curlie export."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import urllib.parse
from build_corpus import BASE,DATA,CATEGORIES,clean_url,host_key

ARCHIVE=BASE/'source-cache/curlie-rdf-all.tar.gz'
ATTRIBUTION='With content from Curlie.org - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.'

def category_for(path):
    if path.startswith('Computers/Software'):return 'technology'
    if path.startswith('Reference/Education/Colleges_and_Universities'):return 'education'
    if '/Government' in '/'+path and path.startswith(('Society/Government','Regional/')):return 'government'
    if path.startswith('Business/Financial_Services/Banking_Services'):return 'finance'
    if path.startswith(('Computers/Internet/On_the_Web/Online_Communities','Computers/Internet/On_the_Web/Message_Boards')) or path.endswith('/Chats_and_Forums'):return 'social'
    if path.startswith(('Arts/Television/Stations','Arts/Radio','Arts/Music/Sound_Files')):return 'entertainment'
    if path.startswith('Recreation/Travel'):return 'travel'
    if path.startswith('Computers/Programming/') and any(s in path for s in ['/Resources','/Documentation','/Reference','/FAQs,_Help,_and_Tutorials','/Languages/']):return 'technical'
    return None

def build():
    original=DATA/'benchmark1000-wikidata-partial.json'
    if not original.exists():original.write_bytes((DATA/'benchmark1000.json').read_bytes())
    wikidata=json.loads(original.read_text());meta=json.loads(ARCHIVE.with_suffix('.provenance.json').read_text())
    ids={};category_counts={}
    with tarfile.open(ARCHIVE,'r|gz') as archive:
        for member in archive:
            if not member.isfile() or not member.name.endswith('-s.tsv'):continue
            for row in csv.reader((line.decode('utf8') for line in archive.extractfile(member)),delimiter='\t',quoting=csv.QUOTE_NONE):
                if len(row)<2:continue
                cid,path=row[:2];category=category_for(path)
                if category:ids[cid]=(path,category);category_counts[category]=category_counts.get(category,0)+1
    print('Matched category nodes:',category_counts,flush=True)
    pools={c:[] for c,_,_ in CATEGORIES};labels={c:l for c,l,_ in CATEGORIES};seen=set()
    with tarfile.open(ARCHIVE,'r|gz') as archive:
        for member in archive:
            if not member.isfile() or not member.name.endswith('-c.tsv'):continue
            for row in csv.reader((line.decode('utf8') for line in archive.extractfile(member)),delimiter='\t',quoting=csv.QUOTE_NONE):
                if len(row)<4 or row[-1] not in ids:continue
                url=clean_url(row[0])
                if not url:continue
                category_path,category=ids[row[-1]]
                host=urllib.parse.urlsplit(url).hostname
                if category=='government' and not re.search(r'\.(?:gov(?:\.[a-z]{2})?|go\.[a-z]{2}|gouv\.[a-z]{2}|gob\.[a-z]{2}|govt\.[a-z]{2}|gc\.ca|admin\.ch|bund\.de)$',host):continue
                key=(url,category)
                if key in seen:continue
                seen.add(key)
                pools[category].append({'url':url,'category':category,'categoryLabel':labels[category],'name':row[1],
                    'source':'https://curlie.org/en/'+urllib.parse.quote(category_path,safe='/,_-'),
                    'sourceKind':'curlie-directory','sourceProperty':'directory-listed-url','sourceCategoryPath':category_path,'sourceCategoryId':row[-1],
                    'sourceURL':row[0],'sourceArchiveSha256':meta['sha256'],'sourceLicense':'CC-BY-3.0',
                    'verificationStatus':'licensed curated source URL; HTTPS/syntax/public-hostname validated; reachability deferred',
                    'notes':'URL copied from directory, not generated/upgraded. Category assigned by documented path rules; no safety assertion.'})
    for rows in pools.values():rows.sort(key=lambda r:(r['url'],r.get('sourceCategoryPath','')))
    for r in wikidata['sites']:
        if r['category'] in ['news','ecommerce']:
            r['sourceKind']='wikidata-P856';r['sourceLicense']='CC0-1.0';pools[r['category']].append(r)
    print('Eligible unique hosts:',{k:len({host_key(urllib.parse.urlsplit(r['url']).hostname) for r in v}) for k,v in pools.items()},flush=True)
    aliases={}
    for file in (BASE.parent/'runs/benchmark100/records').glob('*.json'):
        r=json.loads(file.read_text())
        try:
            u=urllib.parse.urlsplit(r['url']);f=urllib.parse.urlsplit(r['navigation']['finalUrl'])
            if u.hostname and f.hostname and f.scheme in ('http','https'):aliases[host_key(u.hostname)]=host_key(f.hostname)
        except (KeyError,ValueError):pass
    used=set();selected={}
    order=sorted(pools,key=lambda c:len({host_key(urllib.parse.urlsplit(r['url']).hostname) for r in pools[c]}))
    for category in order:
        selected[category]=[]
        for row in pools[category]:
            host=host_key(urllib.parse.urlsplit(row['url']).hostname);canonical=aliases.get(host,host)
            if canonical in used:continue
            used.add(canonical);row['knownRedirectCanonicalHost']=canonical
            row['id']=hashlib.sha256(row['url'].encode()).hexdigest();selected[category].append(row)
            if len(selected[category])==100:break
    sites=[]
    for n in range(100):
        for category,_,_ in CATEGORIES:
            if n<len(selected[category]):sites.append(selected[category][n])
    counts={c:len(selected[c]) for c,_,_ in CATEGORIES}
    result={'name':'BrowserGuard sourced 1000-site HTTPS corpus','licenses':['CC0-1.0 (Wikidata entries)','CC-BY-3.0 (Curlie entries)'],'attribution':ATTRIBUTION,
        'selection':'Purposive deterministic category-balanced source sample, scarce categories allocated first; Wikidata source order for news/ecommerce, lexicographic Curlie URLs otherwise. Not representative of the web.',
        'curlie':meta,'wikidataSources':[s for s in wikidata['sources'] if s['category'] in ('news','ecommerce')],
        'categoryRules':{'technology':'Computers/Software','education':'Reference/Education/Colleges_and_Universities','government':'Government directory path plus public-government hostname suffix','finance':'Business/Financial_Services/Banking_Services','social':'Online_Communities, Message_Boards, or Chats_and_Forums paths','entertainment':'Arts/Television/Stations, Arts/Radio, Arts/Music/Sound_Files','travel':'Recreation/Travel','technical':'Computers/Programming resources, documentation, reference, tutorials, languages'},
        'categoryCounts':counts,'sites':sites,'missing':1000-len(sites),'reachabilityPolicy':'No website preflight requests. Source inclusion is not proof of present availability or intended-page visibility. Errors and restrictions are retained as benchmark outcomes.'}
    (DATA/'benchmark1000.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    text=''.join(r['url']+'\n' for r in sites);(DATA/'benchmark1000.txt').write_text(text)
    columns=['id','url','category','categoryLabel','name','source','sourceKind','sourceProperty','sourceCategoryPath','sourceClass','sourceLicense','verificationStatus','notes','knownRedirectCanonicalHost']
    with (DATA/'benchmark1000.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(sites)
    print(json.dumps({'total':len(sites),'missing':1000-len(sites),'counts':counts,'sha256':hashlib.sha256(text.encode()).hexdigest()},indent=2),flush=True)
if __name__=='__main__':build()
