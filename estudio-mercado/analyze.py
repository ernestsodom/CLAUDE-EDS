import json,re,math
d=json.load(open('detail.json'))
ST={"Los Dominicos":(-33.40788611,-70.54488333),"Hernando de Magallanes":(-33.408217,-70.556111),"Manquehue":(-33.408783,-70.567183),"Escuela Militar":(-33.414267,-70.58465)}
def hav(a,b,c,e):
    R=6371000;p=math.radians
    x=math.sin(p(c-a)/2)**2+math.cos(p(a))*math.cos(p(c))*math.sin(p(e-b)/2)**2
    return 2*R*math.asin(math.sqrt(x))
KW={"terraza":r"terraz","jardin":r"jard[ií]n|patio|antejard","piscina":r"piscina|pileta|alberca"}
rows=[]
for x in d:
    txt=(x['desc_full']+' | '+' ; '.join(x['features'])+' | '+x['title']).lower()
    x['price_uf']=int(re.sub(r'\D','',x['price']) or 0)
    x['area']=int(x['area'] or 0);x['rooms']=int(x['rooms'] or 0);x['baths']=int(x['baths'] or 0)
    ev={}
    for k,p in KW.items():
        m=re.search(p,txt)
        ev[k]=re.sub(r'\s+',' ',txt[max(0,m.start()-60):m.end()+60]) if m else None
    x['ev']=ev
    if x['lat'] and x['lon']:
        ds={n:hav(float(x['lat']),float(x['lon']),*c) for n,c in ST.items()}
        n=min(ds,key=ds.get);x['metro']=n;x['metro_m']=round(ds[n]);x['metros']={k:round(v) for k,v in ds.items()}
    else: x['metro']=None;x['metro_m']=None
    rows.append(x)
base=[x for x in rows if x['price_uf']<=8500 and x['area']>=100 and x['rooms']>=3 and x['baths']>=2]
print('base',len(rows),'->',len(base))
for k in KW: print(k,sum(1 for x in base if x['ev'][k]))
for x in sorted(base,key=lambda x:x['metro_m'] or 9e9):
    print(x['price_uf'],x['area'],x['rooms'],x['baths'],x['metro'],x['metro_m'],[k[0] for k in KW if x['ev'][k]],x['url'][-12:])
json.dump(rows,open('analyzed.json','w'),ensure_ascii=False)
