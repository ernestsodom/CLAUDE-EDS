import json,re,math,html
ST={"Los Dominicos":(-33.40788611,-70.54488333),"Hernando de Magallanes":(-33.408217,-70.556111),"Manquehue":(-33.408783,-70.567183),"Escuela Militar":(-33.414267,-70.58465)}
UF_CLP=947.790073/0.024251381662611
def hav(a,b,c,e):
    p=math.radians;x=math.sin(p(c-a)/2)**2+math.cos(p(a))*math.cos(p(c))*math.sin(p(e-b)/2)**2
    return 2*6371000*math.asin(math.sqrt(x))
PAT={"terraza":r"terraz","jardin":r"jard[ií]n|antejard|patio","piscina":r"piscina|pileta"}
def strip(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<br\s*/?>','. ',re.sub(r'<[^>]+>',' ',s or '')))).strip()
LI={x['id']:x for x in json.load(open('gp_list.json'))}
ic=[x for x in json.load(open('final.json')) if x.get('portal','iCasas')=='iCasas']
for x in ic: x.setdefault('portal','iCasas')
gp=[]
for d in json.load(open('gp_detail.json')):
    price=d['precio']; 
    if d['currency']['codigo_moneda']=='CLP': price=price/UF_CLP
    price=round(price)
    desc=strip(d.get('descripcion')); feats=[f['nombre'] for f in d.get('property_features',[])]
    if d.get('estacionamientos'): feats.append(f"Estacionamientos: {d['estacionamientos']}")
    if d.get('bodega'): feats.append('Bodega')
    if d.get('year'): feats.append(f"Año: {d['year']}")
    if d.get('orientacion'): feats.append(f"Orientación: {d['orientacion']}")
    if d.get('gastos_comunes'): feats.append(f"Gastos comunes: {int(d['gastos_comunes']):,}".replace(',','.'))
    txt=(desc+' | '+' ; '.join(feats)+' | '+(d.get('titulo') or '')).lower()
    ev={}
    for k,p in PAT.items():
        m=re.search(p,txt); ev[k]=("…"+re.sub(r'\s+',' ',txt[max(0,m.start()-70):m.end()+70])+"…") if m else None
    lat,lon=d['ubicacion']['lat'],d['ubicacion']['lng']
    if not lat: continue
    ds={n:round(hav(lat,lon,*c)) for n,c in ST.items()};n=min(ds,key=ds.get)
    imgs=[i.get('imagen_960x720') or i['imagen'] for i in sorted(d.get('property_images',[]),key=lambda i:i.get('orden',0))][:12]
    if not imgs and LI.get(d['id'],{}).get('imagen'): imgs=[LI[d['id']]['imagen'].replace('220x220_','960x720_'),LI[d['id']]['imagen']]
    if not (price<=8500 and d['dimension_propiedad']>=100 and d['habitaciones']>=3 and d['banos']>=2): continue
    gp.append(dict(url=f"https://www.goplaceit.com/cl/propiedad/venta/departamento/las-condes/{d['id']}",ref=str(d['id']),price=price,area=int(d['dimension_propiedad']),
      rooms=d['habitaciones'],baths=d['banos'],addr=(d.get('titulo') or '').replace('Departamento en Venta en ','').title(),agency=d.get('portal_origen') or (d.get('enterprise') or {}).get('nombre'),
      desc=desc[:600],feat=feats,imgs=imgs,metro=n,metro_m=ds[n],metros=ds,ev=ev,lat=str(lat),lon=str(lon),portal='Goplaceit'))
print('goplaceit cumplen base:',len(gp))
def dup(a,b):
    return abs(a['price']-b['price'])<=60 and abs(a['area']-b['area'])<=3 and a['rooms']==b['rooms'] and a['baths']==b['baths'] and a['lat'] and b['lat'] and hav(float(a['lat']),float(a['lon']),float(b['lat']),float(b['lon']))<250
new=[g for g in gp if not any(dup(g,i) for i in ic)]
print('duplicados con iCasas:',len(gp)-len(new))
allp=sorted(ic+new,key=lambda x:x['metro_m'])
json.dump(allp,open('final.json','w'),ensure_ascii=False)
for lv in(3,2,0): print(lv,sum(1 for x in allp if sum(1 for v in x['ev'].values() if v)>=lv and x['metro_m']<=1500),'| solo Goplaceit:',sum(1 for x in new if sum(1 for v in x['ev'].values() if v)>=lv and x['metro_m']<=1500))
