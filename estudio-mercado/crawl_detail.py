import re, json, time, html, base64, sys
sys.argv=['x']
exec(open('crawl_list.py').read().split('res={}')[0])
lst=json.load(open('list_f.json'))
out=[]
def strip(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<br\s*/?>','. ',re.sub(r'<[^>]+>',' ',s)))).strip()
for n,it in enumerate(lst):
    t=get(it['url']); time.sleep(1)
    if not t: continue
    d=dict(it)
    m=re.search(r'<p class="description long_text"[^>]*>(.*?)</p>',t,re.S)
    d['desc_full']=strip(m.group(1)) if m else it['desc']
    d['features']=[strip(x) for x in re.findall(r'<li class="tick">(.*?)</li>',t,re.S)]
    d['address']=strip((re.search(r'class="location_info"[^>]*>(.*?)</span>',t,re.S) or [0,''])[1])
    d['ref']=(re.search(r'Número de referencia:\s*(\w+)',strip(t)) or [0,''])[1]
    urls=list(dict.fromkeys(re.findall(r'https://img\.resemmedia\.com/[A-Za-z0-9+/=_-]+',t)))
    seen={};
    for u in urls:
        try: k=json.loads(base64.b64decode(u.rsplit('/',1)[1]+'==')).get('key')
        except Exception: k=u
        seen.setdefault(k,u)
    d['imgs']=list(seen.values())[:12]
    out.append(d); print(n,len(d['imgs']),len(d['features']),flush=True)
json.dump(out,open('detail.json','w'),ensure_ascii=False)
