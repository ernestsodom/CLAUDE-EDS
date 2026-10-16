import json,datetime
data=json.dumps(json.load(open('final.json')),ensure_ascii=False)
html='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Departamentos Las Condes · Estudio de mercado</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--tx:#1d2330;--mu:#667085;--ac:#0b6e4f;--bd:#e3e6ec;--ok:#0b6e4f;--no:#b42318}
@media(prefers-color-scheme:dark){:root{--bg:#10131a;--card:#181c25;--tx:#e9ecf3;--mu:#98a2b3;--bd:#2a3040;--ac:#3ecf98;--ok:#3ecf98;--no:#f97066}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,sans-serif}
header{padding:20px 16px 8px;max-width:1200px;margin:auto}h1{margin:0 0 4px;font-size:22px}header p{margin:0;color:var(--mu)}
.bar{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--bd);padding:10px 16px}
.bar div{max-width:1200px;margin:auto;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
label{display:flex;gap:6px;align-items:center;font-size:14px}select,input[type=range]{font:inherit}
main{max-width:1200px;margin:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.gal{position:relative;aspect-ratio:3/2;background:#0002}.gal img{width:100%;height:100%;object-fit:cover;display:block}
.gal button{position:absolute;top:50%;transform:translateY(-50%);border:0;background:#000a;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:18px}
.gal .p{left:8px}.gal .n{right:8px}.gal span{position:absolute;right:8px;bottom:8px;background:#000a;color:#fff;font-size:12px;padding:2px 8px;border-radius:10px}
.body{padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex:1}
.pr{font-size:22px;font-weight:700}.pr small{font-weight:400;color:var(--mu);font-size:13px}
.sp{display:flex;gap:12px;flex-wrap:wrap;color:var(--mu);font-size:14px}.sp b{color:var(--tx)}
.tags{display:flex;gap:6px;flex-wrap:wrap}.t{font-size:12px;padding:2px 8px;border-radius:10px;border:1px solid var(--bd)}
.t.ok{color:var(--ok);border-color:var(--ok)}.t.no{color:var(--no);border-color:var(--no);text-decoration:line-through}
.metro{font-size:13px}.d{font-size:13px;color:var(--mu);max-height:4.4em;overflow:hidden}
details{font-size:12.5px;color:var(--mu)}a.b{margin-top:auto;display:inline-block;text-align:center;background:var(--ac);color:#fff;padding:8px;border-radius:8px;text-decoration:none;font-weight:600}
.badge{font-size:12px;font-weight:600;color:var(--ac)}footer{max-width:1200px;margin:auto;padding:8px 16px 40px;color:var(--mu);font-size:13px}
</style></head><body>
<header><h1>Departamentos en venta · Las Condes</h1>
<p>≤ 8.500 UF · ≥100 m² útiles · ≥3 dormitorios · ≥2 baños · terraza, jardín y piscina · cerca de Los Dominicos, Hernando de Magallanes, Manquehue y Escuela Militar. Fuentes: iCasas y Goplaceit (sin duplicados), extraído el __DATE__. Portal Inmobiliario no pudo consultarse (bloqueo anti-bot).</p></header>
<div class="bar"><div>
<label>Cumple <select id="lvl"><option value="3">las 3 (terraza+jardín+piscina)</option><option value="2">al menos 2 de 3</option><option value="0">todos los que cumplen lo base</option></select></label>
<label>Metro ≤ <input type="range" id="dist" min="300" max="3000" step="100" value="1500"><b id="dv">1500 m</b></label>
<label>Estación <select id="st"><option value="">Todas</option><option>Los Dominicos</option><option>Hernando de Magallanes</option><option>Manquehue</option><option>Escuela Militar</option></select></label>
<label>Portal <select id="pt"><option value="">Todos</option><option>iCasas</option><option>Goplaceit</option></select></label>
<label>Orden <select id="ord"><option value="d">Distancia al metro</option><option value="p">Precio ↑</option><option value="a">m² ↓</option></select></label>
<b id="cnt"></b></div></div>
<main id="m"></main>
<footer>Distancia = línea recta desde las coordenadas del aviso a la estación (a pie suele ser ~25 % más). Terraza/jardín/piscina se detectan por texto del aviso y sus características: revisa el detalle ("evidencia") y confirma con el corredor — "jardín" puede ser jardín común del edificio. Cobertura: iCasas y Goplaceit; faltan los avisos exclusivos de Portal Inmobiliario.</footer>
<script>
const D=__DATA__;const $=i=>document.getElementById(i);
const nf=n=>n.toLocaleString('es-CL');
function card(x,i){const a=['terraza','jardin','piscina'];
const tg=a.map(k=>`<span class="t ${x.ev[k]?'ok':'no'}">${k=='jardin'?'Jardín':k[0].toUpperCase()+k.slice(1)}</span>`).join('');
const ev=a.filter(k=>x.ev[k]).map(k=>`<div><b>${k}:</b> ${x.ev[k]}</div>`).join('');
return `<article class="card" data-i="${i}"><div class="gal">${x.imgs.length?'':'<div style="height:100%;display:grid;place-items:center;color:var(--mu)">Sin fotos en el aviso</div>'}<img style="${x.imgs.length?'':'display:none'}" loading="lazy" src="${x.imgs[0]||''}" onerror="if(this.dataset.f!=='1'&&this.dataset.alt){this.dataset.f='1';this.src=this.dataset.alt}else this.style.opacity=.2" data-alt="${x.imgs[1]||''}">${x.imgs.length>1?`<button class="p">‹</button><button class="n">›</button><span>1/${x.imgs.length}</span>`:''}</div>
<div class="body"><div class="pr">${nf(x.price)} UF <small>${x.agency||''}</small></div><div class="badge">${x.portal}</div>
<div class="sp"><span><b>${x.area}</b> m² útiles</span><span><b>${x.rooms}</b> dorm.</span><span><b>${x.baths}</b> baños</span></div>
<div class="tags">${tg}</div><div class="metro">🚇 <b>${x.metro}</b> · ${nf(x.metro_m)} m en línea recta (~${Math.round(x.metro_m*1.25/80)} min a pie)</div>
<div class="d">${x.desc}</div><details><summary>Evidencia y características</summary>${ev}<div>${x.feat.join(' · ')}</div></details>
<a class="b" href="${x.url}" target="_blank" rel="noopener">Ver en ${x.portal} (ref. ${x.ref||'—'})</a></div></article>`}
function render(){const l=+$('lvl').value,d=+$('dist').value,s=$('st').value,pt=$('pt').value;$('dv').textContent=d+' m';
let r=D.map((x,i)=>[x,i]).filter(([x])=>(!pt||x.portal==pt)&&Object.values(x.ev).filter(Boolean).length>=l&&(s?x.metros[s]<=d:x.metro_m<=d));
const o=$('ord').value;r.sort((a,b)=>o=='p'?a[0].price-b[0].price:o=='a'?b[0].area-a[0].area:(s?a[0].metros[s]-b[0].metros[s]:a[0].metro_m-b[0].metro_m));
$('cnt').textContent=r.length+' propiedades';$('m').innerHTML=r.map(([x,i])=>{if(s){x=Object.assign({},x,{metro:s,metro_m:x.metros[s]})}return card(x,i)}).join('')||'<p>Sin resultados con estos filtros.</p>'}
document.addEventListener('click',e=>{const b=e.target.closest('.gal button');if(!b)return;const c=b.closest('.card'),x=D[c.dataset.i],g=c.querySelector('.gal'),im=g.querySelector('img');
let k=(+(g.dataset.k||0)+(b.classList.contains('n')?1:-1)+x.imgs.length)%x.imgs.length;g.dataset.k=k;im.src=x.imgs[k];g.querySelector('span').textContent=(k+1)+'/'+x.imgs.length});
['lvl','dist','st','ord','pt'].forEach(i=>$(i).addEventListener('input',render));render();
</script></body></html>'''
open('departamentos-las-condes.html','w').write(html.replace('__DATA__',data).replace('__DATE__',datetime.date.today().strftime('%d-%m-%Y')))
