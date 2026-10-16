import numpy as np
from PIL import Image, ImageDraw, ImageFilter
def load(f): return np.asarray(Image.open(f+'.webp').convert('RGB')).astype(int)
def poly(shape, pts):
    m=Image.new('L',(shape[1],shape[0]),0); ImageDraw.Draw(m).polygon(pts,fill=255); return np.asarray(m)>0
def box(shape, b):
    m=np.zeros(shape[:2],bool); x0,y0,x1,y1=b; m[y0:y1,x0:x1]=True; return m
def dil(m,n):
    return np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(n)))>0
def soft(m):
    return np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6)))
CFG={
 '3d-full-vision': dict(
   floor=lambda r,g,b,L,S: (g-r>10)&(g-b>6)&(g>55),
   white_prof=True, lamps=[(275,20,345,90),(110,250,145,275),(815,220,885,245)],
   poles=[(232,28,340,364),(96,262,142,396)]),
 '3d-panoramic-pro': dict(
   floor=lambda r,g,b,L,S: (abs(r-g)<12)&(b-r>=-2)&(b-r<16)&(L>95)&(L<218),
   floorpoly=[(150,425),(260,418),(640,402),(1085,553),(420,798),(245,612),(150,525)],
   prof=lambda r,g,b,L,S: (b>120)&(b-r>35)&(b-g>12)&(r>50),
   lamps=[(200,25,250,75),(815,155,885,175)],
   poles=[(158,28,262,346)]),
 '3d-elite-pro': dict(
   floor=lambda r,g,b,L,S: (b>120)&(b-r>70),
   white_prof=True, lamps=[(255,20,330,90),(130,240,160,268),(840,228,905,248)],
   poles=[(212,22,326,368)]),
}
out={}
for f,c in CFG.items():
    a=load(f); r,g,b=a[...,0],a[...,1],a[...,2]
    L=0.299*r+0.587*g+0.114*b; S=a.max(-1)-a.min(-1)
    fl=c['floor'](r,g,b,L,S)
    if 'floorpoly' in c: fl&=poly(a.shape,c['floorpoly'])
    if 'floorpoly' in c:
        prk=c['prof'](r,g,b,L,S)
        fl=fl|(dil(fl,9)&(S<30)&(L>70)&(L<215)&~prk&poly(a.shape,c['floorpoly']))
        fl=fl|(dil(fl,5)&(L>70)&(L<215)&~dil(prk,3)&poly(a.shape,c['floorpoly']))
    lamps=np.zeros(a.shape[:2],bool)
    for bx in c['lamps']: lamps|=box(a.shape,bx)
    if c.get('white_prof'):
        pr=(L>170)&(S<40)&~dil(fl,9)&~lamps
    else:
        pr=c['prof'](r,g,b,L,S)&~fl
    po=np.zeros(a.shape[:2],bool)
    for bx in c['poles']: po|=box(a.shape,bx)
    po&=(L>16)&~(L>200)&~pr&~fl
    # quitar cualquier cosa de la malla de fondo dentro de las cajas: sólo píxeles neutros
    po&=(S<40)
    m=np.stack([soft(fl),soft(pr),soft(po)],-1).astype('uint8')
    Image.fromarray(m,'RGB').save(f+'-mask.png',optimize=True)
    ref=lambda mm: float(np.median(L[mm])) if mm.any() else 1
    out[f]=dict(floor=ref(fl),prof=ref(pr),pole=ref(po))
    print(f, fl.sum(), pr.sum(), po.sum(), out[f])
import json; json.dump(out,open('refs.json','w'))
