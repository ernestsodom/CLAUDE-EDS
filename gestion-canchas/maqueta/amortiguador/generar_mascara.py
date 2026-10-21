import numpy as np, colorsys
from PIL import Image, ImageFilter, ImageDraw
im=Image.open('amortiguador-original.webp').convert('RGB').crop((0,116,588,1164))
im.save('amortiguador-foto.png')
a=np.asarray(im).astype(float)/255
r,g,b=a[...,0],a[...,1],a[...,2]
mx=a.max(-1); mn=a.min(-1); sat=(mx-mn)/np.maximum(mx,1e-6)
# matiz
h=np.zeros_like(mx); d=np.maximum(mx-mn,1e-6)
h=np.where(mx==r, ((g-b)/d)%6, np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
yel=(h>46)&(h<74)&(sat>0.3)&(mx>0.12)
# excluir el poste del fondo (amarillo de la estructura)
ex=Image.new('L',im.size,0); dr=ImageDraw.Draw(ex)
dr.rectangle([136,0,215,392],fill=255)
yel&=~(np.asarray(ex)>0)
# tuerca dorada del resorte: dentro de su zona solo se excluyen los tonos dorados (más anaranjados)
nm=Image.new('L',im.size,0); ImageDraw.Draw(nm).polygon([(320,495),(412,495),(412,572),(372,572),(366,543),(320,528)],fill=255); nut=np.asarray(nm)>0
yel&=~(nut&(h<58))
inc=Image.new('L',im.size,0); di=ImageDraw.Draw(inc)
di.rectangle([25,495,415,835],fill=255); di.rectangle([105,355,245,475],fill=255)
yel&=np.asarray(inc)>0
m=Image.fromarray((yel*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
# recorte cuadrado: solo el amortiguador principal
SQ=(20,470,460,910)
m.crop(SQ).save('amortiguador-mascara.png',optimize=True)
im.crop(SQ).save('amortiguador-foto.webp',quality=85,method=6)
L=0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
print('ref', float(np.median(L[yel]))*255, yel.sum())
# vista previa en rojo y azul
mm=np.asarray(m).astype(float)[...,None]/255
def rec(t):
    t=np.array(t,float); f=np.clip(L*255/ (np.median(L[yel])*255),0,2)[...,None]
    n=np.where(f<=1,t*f,t+(255-t)*np.clip(f-1,0,1)*0.7)
    return Image.fromarray((a*255*(1-mm)+n*mm).clip(0,255).astype('uint8'))
c=Image.new('RGB',(588*3,1048)); c.paste(im,(0,0)); c.paste(rec((180,40,33)),(588,0)); c.paste(rec((34,113,179)),(1176,0))
c.resize((882,524)).save('amort-test.png')
