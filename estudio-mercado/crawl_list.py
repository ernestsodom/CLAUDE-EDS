import re, json, time, html, sys, urllib.request, ssl
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
BASE="https://www.icasas.cl/venta/departamentos/santiago/condes"
def get(u):
    for i in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=30).read().decode("utf8","ignore")
        except Exception as e:
            time.sleep(2*(i+1)); err=e
    print("FAIL",u,err,file=sys.stderr); return ""
def parse(t):
    out=[]
    for blk in re.split(r'<li class="serp-snippet',t)[1:]:
        blk=blk.split('</li>')[0]
        g=lambda p: (re.search(p,blk,re.S) or [None,None])[1]
        href=g(r'class="detail-redirection" href="([^"]+)"')
        if not href: continue
        price=g(r'class="price">\s*([^<]*?)\s*<')
        imgs=re.findall(r'(?:src|data-lazy)="(https://img\.resemmedia\.com/[^"]+)"',blk)
        out.append(dict(url="https://www.icasas.cl"+href,price=(price or "").strip(),
          title=html.unescape(g(r'class="title"><a[^>]*>(.*?)</a>') or ""),
          desc=html.unescape(g(r'class="description ?">(.*?)</p>') or ""),
          area=g(r'class="areaBuilt">(\d+)'),rooms=g(r'class="rooms">(\d+)'),baths=g(r'class="bathrooms">(\d+)'),
          lat=g(r'itemprop="latitude" content="([^"]+)"'),lon=g(r'itemprop="longitude" content="([^"]+)"'),
          agency=g(r'itemprop="name" content="([^"]+)"'),imgs=list(dict.fromkeys(imgs))[:1]))
    return out
res={};p=1
while True:
    t=get(BASE if p==1 else f"{BASE}/p_{p}")
    items=parse(t)
    new=[i for i in items if i["url"] not in res]
    for i in items: res[i["url"]]=i
    print(p,len(items),len(new),len(res),flush=True)
    if not items or not new or p>=400: break
    p+=1; time.sleep(1)
json.dump(list(res.values()),open("list.json","w"),ensure_ascii=False)
