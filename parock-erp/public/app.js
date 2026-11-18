/* PAROCK · Sistema de gestión — cliente web
   Lee todo desde /api/bootstrap y escribe vía /api/action. */
'use strict';

/* =========================================================
   ÍCONOS Y UTILIDADES
   ========================================================= */
const I={
 home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 crm:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
 doc:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
 truck:'<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
 stock:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 fc:'<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
 cart:'<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/>',
 inv:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
 fin:'<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 7s2.2 3 5 3.5 5 1.5 5 3.8-2.2 3.7-5 3.7-5-1.2-5-3"/>',
 cog:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 up:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
 dl:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 warn:'<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
 check:'<path d="m5 12 5 5 9-10"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 ai:'<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
 money:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
 tax:'<path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 9h6M9 13h4"/>'
};
const ic=(n,s='')=>`<svg viewBox="0 0 24 24" ${s}>${I[n]}</svg>`;
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('es-CL');
const N=v=>nf.format(Math.round(v));
const $$=v=>(v<0?'−$':'$')+nf.format(Math.abs(Math.round(v)));
const MM=v=>'$'+(v/1e6).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+' MM';
const pct=(v,d=1)=>v==null||!isFinite(v)?'N/D':v.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const pill=(t,c)=>`<span class="pill ${c}">${esc(t)}</span>`;
function pd(s){if(!s||s==='—')return null;const [d,m,y]=s.split('-').map(Number);return new Date(y,m-1,d)}
const TODAY=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const todayStr=()=>{const d=new Date();return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`};
const isoToday=()=>todayStr().split('-').reverse().join('-');
const MN=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MNL=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ym=(y,m)=>`${y}-${String(m).padStart(2,'0')}`;
const ymAdd=(k,n)=>{const [y,m]=k.split('-').map(Number);const d=new Date(y,m-1+n,1);return ym(d.getFullYear(),d.getMonth()+1)};
const ymLabel=(k,long)=>{const [y,m]=k.split('-').map(Number);return long?`${MNL[m-1]} ${y}`:`${MN[m-1]} ${String(y).slice(2)}`};
const ymOf=s=>{const d=pd(s);return d?ym(d.getFullYear(),d.getMonth()+1):null};
function toast(msg,bad){const t=el('toast');t.style.borderLeftColor=bad?'var(--bad)':'var(--gold-2)';t.innerHTML=ic(bad?'warn':'check','style="width:18px;height:18px;stroke:'+(bad?'#F3A6A6':'var(--gold-2)')+';fill:none;stroke-width:2.4;flex:none"')+esc(msg);t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),4200)}
function download(name,rows){const csv='﻿'+rows.map(r=>r.map(v=>{const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}).join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}

/* =========================================================
   API Y ESTADO
   ========================================================= */
let DB=null,U=null;
async function api(type,body={}){
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({type,...body})});
  const j=await r.json().catch(()=>({error:'Respuesta inválida del servidor'}));
  if(r.status===401){showLogin();throw new Error(j.error)}
  if(!r.ok){toast(j.error||'Error',true);throw new Error(j.error)}
  return j;
}
async function act(type,body,okMsg){try{const r=await api(type,body);await load();if(okMsg)toast(okMsg);return r}catch(e){return null}}
async function load(){
  const r=await fetch('/api/bootstrap',{credentials:'same-origin'});
  if(r.status===401){showLogin();return false}
  if(!r.ok){el('loading').textContent='No se pudo cargar el sistema. Reintenta en unos segundos.';return false}
  DB=await r.json();U=DB.me;derive();
  el('loading').style.display='none';el('login').style.display='none';el('app').style.display='';
  el('uimg').src=U.img||'assets/logo-parock.png';el('uname').textContent=U.name;el('urole').textContent=U.role;
  route();return true;
}
function showLogin(){el('loading').style.display='none';el('app').style.display='none';el('login').style.display='';closeAll()}

/* Derivados */
let USERS={},CLIENTS=[],SKUS=[],OCS=[],DESP=[],INVS=[],STOCK={},FCV=[],FCCUR='',FCM=[],FCK=[],CURM='',SALESM=[];
const S=k=>SKUS.find(s=>s.sku===k)||{sku:k,name:k,img:'',brand:''};
const C=id=>CLIENTS.find(c=>c.id===id)||{id,com:id,name:id,cds:[]};
function derive(){
  USERS=Object.fromEntries(DB.users.map(u=>[u.id,u]));
  CLIENTS=DB.clients;SKUS=DB.skus;OCS=DB.ocs;DESP=DB.desp;SALESM=DB.sales;
  OCS.forEach(o=>{o.units=o.lines.reduce((a,l)=>a+l[1],0);o.net=o.lines.reduce((a,l)=>a+l[1]*l[2],0)});
  // facturas: saldo = total − pagos − NC aplicadas
  const nc={};DB.invs.filter(f=>f.t===61&&f.ref).forEach(f=>nc[f.ref]=(nc[f.ref]||0)+(-f.tot));
  INVS=DB.invs.map(f=>{const pag=f.pays.reduce((a,p)=>a+p.amount,0);const o={...f,pag,nc:nc[f.fo]||0};
    if(f.t===61){o.saldo=0;o.est=f.ref?'Aplicada a F'+f.ref:'Nota de crédito'}
    else{o.saldo=Math.max(0,Math.round(f.tot-pag-(nc[f.fo]||0)));const v=pd(f.v);o.est=o.saldo===0?'Pagada':v&&v<TODAY()?'Vencida':pag>0?'Abono parcial':'Por cobrar'}
    return o});
  CURM=SALESM.length?SALESM[SALESM.length-1].m:ym(new Date().getFullYear(),new Date().getMonth()+1);
  CLIENTS.forEach(c=>{c.sales=SALESM.filter(s=>s.c===c.id&&s.m===CURM).reduce((a,s)=>a+s.net,0);c.ar=INVS.filter(f=>f.cli===c.id).reduce((a,f)=>a+f.saldo,0);
    const ds=DESP.filter(d=>d.cli===c.id&&d.desp>0);const sol=ds.reduce((a,d)=>a+d.sol,0);c.fr=sol?ds.reduce((a,d)=>a+d.acc,0)/sol*100:null;
    c.otif=ds.length?ds.filter(d=>d.acc>=d.sol&&pd(d.ent)<=pd(d.comp)).length/ds.length*100:null});
  FCV=DB.fcVersions;FCCUR=(FCV.find(v=>v.status==='borrador')||FCV[FCV.length-1]||{}).version;
  const fs=DB.cfg.forecast_start||ym(new Date().getFullYear(),new Date().getMonth()+2);
  FCK=Array.from({length:12},(_,i)=>ymAdd(fs,i));FCM=FCK.map(k=>ymLabel(k));
  STOCK={};for(const [k,s] of Object.entries(DB.stock)){const dem=fcRows(FCCUR).filter(r=>r.s===k).reduce((a,r)=>a+r.m.reduce((p,q)=>p+q,0),0)/12;
    STOCK[k]={...s,disp:s.asg-s.res,dem:Math.round(dem),cov:dem?(s.asg-s.res)/dem:null}}
  const last=DB.loads.find(l=>l.st.startsWith('Publicada'))||DB.loads[0];
  el('cutoff').textContent=last?last.cutoff:'—';
}
const fcRows=v=>(DB.fc[v]||[]);

/* Precio vigente: lista diferenciada del cliente o tarifa regular */
function priceInfo(cli,sku,at=isoToday()){
  const c=C(cli),p=S(sku).price;
  if(c.priceMode!=='especial')return {price:p,src:'regular'};
  const r=DB.clientPrices.find(x=>x.cli===cli&&x.sku===sku&&String(x.fromIso).slice(0,10)<=at);
  return r?{price:r.price,src:'especial',from:r.from}:{price:p,src:'regular'};
}
const fin=html=>U.fin?html:`<span class="masked">${html}</span>`;
const skuCell=k=>{const s=S(k);return `<div class="sku"><img src="${esc(s.img)}" alt=""><div><strong>${esc(s.name)}</strong><small>${esc(s.sku)} · ${esc(s.brand)}</small></div></div>`};
const hl=(l,k)=>`<div class="hl"><div class="l">${l}</div><div class="k num">${k}</div></div>`;
const kv=(k,v)=>`<div><div class="tiny muted" style="font-family:var(--fh);font-weight:600;letter-spacing:.06em;text-transform:uppercase">${k}</div><div class="small" style="margin-top:2px">${v}</div></div>`;
const hlc=(l,k,s)=>`<div class="card"><div class="lbl" style="font-family:var(--fh);font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">${l}</div><div class="num" style="font-family:var(--fh);font-weight:800;font-size:1.35rem;color:var(--navy);margin:6px 0 2px">${k}</div><div class="tiny muted">${s}</div></div>`;
const inp=(l,v,raw,attrs='')=>`<div><label class="tiny muted" style="font-family:var(--fh);font-weight:600;letter-spacing:.06em;text-transform:uppercase">${l}</label><div style="margin-top:4px">${raw?v:`<input class="inp" style="width:100%" value="${esc(v)}" ${attrs}>`}</div></div>`;
const clientOpts=(sel,filter=()=>true)=>CLIENTS.filter(filter).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');

/* =========================================================
   GRÁFICOS SVG
   ========================================================= */
function barLine(bars,line,labels,{w=640,h=220,barColor='var(--navy)',lineColor='var(--gold)',barFmt=v=>v,lineMax=40,lineMin=25,hiLast=true}={}){
  const pl=34,pr=34,pt=14,pb=26,ih=h-pt-pb,iw=w-pl-pr,n=bars.length||1,bw=iw/n*.56;
  const max=Math.max(10,Math.ceil(Math.max(...bars,0)/10)*10);let g='';
  for(let i=0;i<=4;i++){const y=pt+ih*i/4;g+=`<line x1="${pl}" x2="${w-pr}" y1="${y}" y2="${y}" stroke="#EFEAE1"/><text x="${pl-6}" y="${y+3}" text-anchor="end">${Math.round(max*(1-i/4))}</text>`}
  bars.forEach((v,i)=>{const x=pl+iw*(i+.5)/n-bw/2,bh=ih*Math.max(0,v)/max;g+=`<rect x="${x}" y="${pt+ih-bh}" width="${bw}" height="${bh}" rx="4" fill="${hiLast&&i===n-1?'var(--gold-2)':barColor}"><title>${labels[i]}: ${barFmt(v)}</title></rect><text x="${pl+iw*(i+.5)/n}" y="${h-8}" text-anchor="middle">${labels[i]}</text>`});
  if(line){const pts=line.map((v,i)=>[pl+iw*(i+.5)/n,pt+ih*(1-(Math.min(lineMax,Math.max(lineMin,v))-lineMin)/(lineMax-lineMin))]);
    g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.4" stroke-linejoin="round"/>`;
    pts.forEach((p,i)=>g+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="${lineColor}" stroke-width="2"><title>${pct(line[i])}</title></circle>`);
    for(let i=0;i<=4;i++){const y=pt+ih*i/4;g+=`<text x="${w-pr+6}" y="${y+3}">${Math.round(lineMax-(lineMax-lineMin)*i/4)}%</text>`}}
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${g}</svg>`;
}
function lines2(a,b,labels,{h=200,w=640,min=75,max=100,ca='var(--navy)',cb='var(--gold)'}={}){
  const pl=34,pr=12,pt=12,pb=26,ih=h-pt-pb,iw=w-pl-pr,n=a.length;let g='';
  for(let i=0;i<=5;i++){const v=max-(max-min)*i/5,y=pt+ih*i/5;g+=`<line x1="${pl}" x2="${w-pr}" y1="${y}" y2="${y}" stroke="#EFEAE1"/><text x="${pl-6}" y="${y+3}" text-anchor="end">${Math.round(v)}</text>`}
  const P=arr=>arr.map((v,i)=>[pl+iw*i/Math.max(1,n-1),pt+ih*(1-(v-min)/(max-min))]);
  [[a,ca],[b,cb]].forEach(([arr,c])=>{const p=P(arr);g+=`<path d="M${p.map(q=>q.join(',')).join('L')}L${p[n-1][0]},${pt+ih}L${p[0][0]},${pt+ih}Z" fill="${c}" opacity=".06"/><polyline points="${p.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="2.4"/>`;p.forEach((q,i)=>g+=`<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="#fff" stroke="${c}" stroke-width="2"><title>${labels[i]}: ${arr[i]}%</title></circle>`)});
  labels.forEach((l,i)=>g+=`<text x="${pl+iw*i/Math.max(1,n-1)}" y="${h-8}" text-anchor="middle">${l}</text>`);
  const y95=pt+ih*(1-(95-min)/(max-min));
  g+=`<line x1="${pl}" x2="${w-pr}" y1="${y95}" y2="${y95}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${w-pr}" y="${y95-4}" text-anchor="end" style="fill:var(--ok)">Meta 95%</text>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${g}</svg>`;
}
function donut(parts,{size=150,label='',sub=''}={}){
  const tot=parts.reduce((a,p)=>a+p.v,0)||1,r=56,cx=75,cy=75,L=2*Math.PI*r;let off=0,g='';
  parts.forEach(p=>{const len=L*p.v/tot;g+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.c}" stroke-width="18" stroke-dasharray="${Math.max(0,len-2)} ${L}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"><title>${p.l}</title></circle>`;off+=len});
  return `<svg viewBox="0 0 150 150" style="width:${size}px;height:${size}px;flex:none">${g}<text x="75" y="74" text-anchor="middle" style="font-family:var(--fh);font-weight:800;font-size:18px;fill:var(--navy)">${label}</text><text x="75" y="92" text-anchor="middle" style="font-size:9px;fill:#8A929C">${sub}</text></svg>`;
}
function projection(sku){
  const s=S(sku),st=STOCK[sku];if(!st)return null;
  const dem=FCK.map((_,i)=>fcRows(FCCUR).filter(r=>r.s===sku).reduce((a,r)=>a+r.m[i],0));
  const etaK=st.eta?ymOf(st.eta):null;let stock=st.disp;const arr=[],inc=[];
  FCK.forEach((k,i)=>{const add=(k===etaK?st.tr:0)+(Number(st.plan[k])||0);inc.push(add);stock+=add-dem[i];arr.push(stock)});
  return {s,st,dem,arr,inc};
}
function projChart(P){
  const {s,arr,inc}=P,w=640,h=220,pl=46,pr=12,pt=14,pb=26,ih=h-pt-pb,iw=w-pl-pr,n=12;
  const mx=Math.max(...arr,P.st.disp,s.ss,1)*1.1,mn=Math.min(0,...arr)*1.1;const Y=v=>pt+ih*(1-(v-mn)/(mx-mn));let g='';
  for(let i=0;i<=4;i++){const v=mx-(mx-mn)*i/4;g+=`<line x1="${pl}" x2="${w-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EFEAE1"/><text x="${pl-6}" y="${Y(v)+3}" text-anchor="end">${N(v)}</text>`}
  g+=`<rect x="${pl}" y="${Y(s.ss)}" width="${iw}" height="${Math.max(0,Y(0)-Y(s.ss))}" fill="var(--warn)" opacity=".08"/><line x1="${pl}" x2="${w-pr}" y1="${Y(s.ss)}" y2="${Y(s.ss)}" stroke="var(--warn)" stroke-dasharray="4 4"/><text x="${pl+4}" y="${Y(s.ss)-4}" style="fill:var(--warn)">Stock seguridad ${N(s.ss)}</text>`;
  g+=`<line x1="${pl}" x2="${w-pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--bad)"/>`;
  arr.forEach((v,i)=>{const x=pl+iw*(i+.5)/n,bw=iw/n*.5;const c=v<0?'var(--bad)':v<s.ss?'#D69E2E':'var(--navy)';g+=`<rect x="${x-bw/2}" y="${Math.min(Y(v),Y(0))}" width="${bw}" height="${Math.abs(Y(v)-Y(0))}" rx="3" fill="${c}"><title>${FCM[i]}: ${N(v)} un</title></rect><text x="${x}" y="${h-8}" text-anchor="middle">${FCM[i].split(' ')[0]}</text>`;if(inc[i])g+=`<text x="${x}" y="${Math.min(Y(v),Y(0))-6}" text-anchor="middle" style="fill:var(--gold);font-weight:700">+${N(inc[i])}</text>`});
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${g}</svg>`;
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
const ST={borrador:'p-mute','pendiente validación':'p-warn',aprobada:'p-info',preparación:'p-gold',parcial:'p-warn',entregada:'p-ok',cerrada:'p-navy',cancelada:'p-bad'};
const openSt=['pendiente validación','aprobada','preparación','parcial'];
function riskSkus(){return SKUS.map(s=>projection(s.sku)).filter(P=>P&&P.arr.some(v=>v<0))}
const NAV=[
 ['General',[['inicio','Inicio','home']]],
 ['Comercial',[['crm','Clientes y CRM','crm'],['productos','Productos y tarifas','box']]],
 ['Operación',[['oc','Órdenes de compra','doc',()=>OCS.filter(o=>['pendiente validación','borrador'].includes(o.st)).length],['despachos','Despachos y servicio','truck'],['inventario','Inventario ROVAL','stock']]],
 ['Planificación',[['forecast','Forecast','fc'],['abastecimiento','Abastecimiento','cart',()=>riskSkus().length]]],
 ['Finanzas',[['facturas','Facturas y cobranza','inv'],['finanzas','Finanzas e IVA','fin',null,'fin']]],
 ['Sistema',[['admin','Administración','cog',null,'admin']]]
];
const TITLES={inicio:['Panel general','Inicio'],crm:['Comercial','Clientes y CRM'],productos:['Comercial','Productos y tarifas'],oc:['Operación','Órdenes de compra'],despachos:['Operación','Despachos y nivel de servicio'],inventario:['Operación','Inventario ROVAL'],forecast:['Planificación','Forecast 12 meses'],abastecimiento:['Planificación','Abastecimiento'],facturas:['Finanzas','Facturas y cobranza'],finanzas:['Finanzas','Finanzas gerenciales e IVA'],admin:['Sistema','Administración']};
function renderNav(cur){
  el('nav').innerHTML=NAV.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([id,l,i,b,perm])=>{const locked=perm&&!U[perm];const n=b&&b();return `<a href="#${id}" class="${cur===id?'on':''} ${locked?'locked':''}">${ic(i)}${l}${locked?`<span class="bdg">${ic('lock','style="width:14px;height:14px"')}</span>`:n?`<span class="bdg">${n}</span>`:''}</a>`}).join('')).join('');
}
let CUR='inicio';
function route(){
  if(!DB)return;
  const id=(location.hash||'#inicio').slice(1).split('/')[0];const v=VIEWS[id]?id:'inicio';const changed=v!==CUR;CUR=v;
  renderNav(v);const [c,t]=TITLES[v];el('crumb').textContent='PAROCK · '+c;el('title').textContent=t;
  el('view').innerHTML=VIEWS[v]();(AFTER[v]||(()=>{}))();el('side').classList.remove('open');if(changed)window.scrollTo(0,0);
  el('bellDot').style.display=alerts().length?'':'none';
}
window.addEventListener('hashchange',route);
const VIEWS={},AFTER={};

/* =========================================================
   INICIO — período (mes, año a la fecha, año móvil) y multi-cliente
   ========================================================= */
const DF={period:null,clients:null};
function periodMonths(p){
  if(p==='ytd'){const y=CURM.slice(0,4);const out=[];for(let k=`${y}-01`;k<=CURM;k=ymAdd(k,1))out.push(k);return out}
  if(p==='r12')return Array.from({length:12},(_,i)=>ymAdd(CURM,i-11));
  return [p.slice(2)];
}
function periodLabel(p){if(p==='ytd')return `Año a la fecha · Ene–${MN[+CURM.slice(5)-1]} ${CURM.slice(0,4)}`;if(p==='r12')return `Año móvil · ${ymLabel(ymAdd(CURM,-11))} – ${ymLabel(CURM)}`;return ymLabel(p.slice(2),true)}
function alerts(){
  const a=[];
  riskSkus().forEach(P=>{const i=P.arr.findIndex(v=>v<0);a.push(['bad','warn',`Quiebre proyectado · ${P.s.name}`,`Desde ${FCM[i]} · lead time ${P.s.lead} días`,'abastecimiento'])});
  const over=INVS.filter(f=>f.est==='Vencida');if(over.length)a.push(['bad','inv',`${over.length} factura${over.length>1?'s':''} vencida${over.length>1?'s':''}`,over.map(f=>`F${f.fo} ${C(f.cli).com}`).join(' · '),'facturas']);
  OCS.filter(o=>o.st==='pendiente validación').forEach(o=>a.push(['warn','doc',`OC ${o.n} pendiente de validación`,`${C(o.cli).com} · ${N(o.units)} un`,'oc']));
  const last=DB.loads.find(l=>l.st.startsWith('Publicada'));if(last){const days=Math.floor((Date.now()-new Date(last.ts))/864e5);if(days>=(DB.cfg.params?.max_edad_stock_dias??2))a.push(['warn','stock',`Inventario ROVAL con ${days} días`,`Corte ${last.cutoff} · solicitar nueva carga`,'inventario'])}
  DESP.filter(d=>d.ent==='—'&&pd(d.comp)<TODAY()).forEach(d=>a.push(['warn','truck',`OC ${d.oc} fuera de fecha compromiso`,`Compromiso ${d.comp} · ${d.st}`,'despachos']));
  return a;
}
VIEWS.inicio=()=>{
  if(!DF.period)DF.period='m:'+CURM;
  if(!DF.clients)DF.clients=new Set(CLIENTS.map(c=>c.id));
  const sel=DF.clients,months=periodMonths(DF.period),prev=months.map(k=>ymAdd(k,-12));
  const sum=(ms,f)=>SALESM.filter(s=>ms.includes(s.m)&&sel.has(s.c)).reduce((a,s)=>a+f(s),0);
  const net=sum(months,s=>s.net),netP=sum(prev,s=>s.net),cost=U.fin?sum(months,s=>s.cost):0;
  const mg=U.fin&&net?(net-cost)/net*100:null;
  const open=OCS.filter(o=>openSt.includes(o.st)&&sel.has(o.cli));
  const ds=DESP.filter(d=>sel.has(d.cli)&&d.desp>0&&months.includes(ymOf(d.comp)));
  const sol=ds.reduce((a,d)=>a+d.sol,0),fr=sol?ds.reduce((a,d)=>a+d.acc,0)/sol*100:null;
  const otifN=ds.filter(d=>d.acc>=d.sol&&pd(d.ent)<=pd(d.comp)).length,otif=ds.length?otifN/ds.length*100:null;
  const ar=INVS.filter(f=>sel.has(f.cli)).reduce((a,f)=>a+f.saldo,0),over=INVS.filter(f=>sel.has(f.cli)&&f.est==='Vencida');
  const act=CLIENTS.filter(c=>sel.has(c.id)&&c.stage==='activo').length;
  const covs=Object.values(STOCK).filter(s=>s.cov!=null),cov=covs.length?covs.reduce((a,s)=>a+s.cov,0)/covs.length:null;
  const chartMs=months.length===1?Array.from({length:12},(_,i)=>ymAdd(months[0],i-11)):months;
  const bars=chartMs.map(k=>sum([k],s=>s.net)/1e6),mline=U.fin?chartMs.map(k=>{const n=sum([k],s=>s.net),c=sum([k],s=>s.cost);return n?(n-c)/n*100:0}):null;
  const byCli=CLIENTS.filter(c=>sel.has(c.id)).map(c=>({c,v:SALESM.filter(s=>s.c===c.id&&months.includes(s.m)).reduce((a,s)=>a+s.net,0)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const maxCli=Math.max(...byCli.map(x=>x.v),1);
  const monthsOpts=Array.from({length:12},(_,i)=>ymAdd(CURM,-i));
  const delta=netP?(net-netP)/netP*100:null;
  const al=alerts();
  const cliLabel=sel.size===CLIENTS.length?`Todos (${sel.size})`:sel.size===0?'Ninguno':sel.size<=2?[...sel].map(id=>C(id).com).join(', '):`${sel.size} clientes`;
  return `
  <div class="filters">
    <label>Periodo</label><select id="fPeriod">
      <optgroup label="Acumulados"><option value="ytd" ${DF.period==='ytd'?'selected':''}>Año a la fecha (Ene–${MN[+CURM.slice(5)-1]})</option><option value="r12" ${DF.period==='r12'?'selected':''}>Año móvil (últimos 12 meses)</option></optgroup>
      <optgroup label="Mes">${monthsOpts.map(k=>`<option value="m:${k}" ${DF.period==='m:'+k?'selected':''}>${ymLabel(k,true)}</option>`).join('')}</optgroup></select>
    <label>Clientes</label>
    <details class="ms" id="fCli"><summary>${esc(cliLabel)}</summary><div class="pop">
      ${CLIENTS.map(c=>`<label><input type="checkbox" value="${c.id}" ${sel.has(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')}
      <div class="acts"><button type="button" data-all="1">Todos</button><button type="button" data-all="0">Ninguno</button></div></div></details>
    <span style="flex:1"></span><span class="tiny muted">${esc(periodLabel(DF.period))} · netos CLP</span>
  </div>
  <div class="grid g4">
    ${kpi('Venta neta facturada',MM(net),delta==null?'Sin base comparable':`<span class="${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${pct(Math.abs(delta))}</span> vs mismo periodo año anterior`,'facturas',true)}
    ${kpi('Margen bruto',U.fin?pct(mg)+' <small>'+MM(net-cost)+'</small>':fin('00,0%'),U.fin?'Venta neta − costo de mercadería':'🔒 Requiere permiso financiero','finanzas')}
    ${kpi('OC abiertas',open.length+' <small>'+MM(open.reduce((a,o)=>a+o.net,0))+'</small>',`${open.filter(o=>o.st==='pendiente validación').length} por validar · ${open.filter(o=>o.st==='parcial').length} parcial`,'oc')}
    ${kpi('Fill Rate (unidades)',pct(fr),sol?`${N(ds.reduce((a,d)=>a+d.acc,0))} de ${N(sol)} un · meta 95%`:'Sin despachos en el periodo','despachos')}
    ${kpi('OTIF',pct(otif,0),ds.length?`${otifN} de ${ds.length} despachos evaluables`:'Sin despachos en el periodo','despachos')}
    ${kpi('Clientes activos',act+` <small>de ${sel.size} seleccionados</small>`,'Pipeline CRM: '+(DB.cfg.pipeline||[]).reduce((a,c)=>a+(c.st==='activo'?0:c.items.length),0)+' oportunidades','crm')}
    ${kpi('Facturas por cobrar',MM(ar),over.length?`<span class="down">${over.length} vencidas · ${MM(over.reduce((a,f)=>a+f.saldo,0))}</span>`:'Sin facturas vencidas','facturas')}
    ${kpi('Cobertura stock',(cov==null?'N/D':cov.toLocaleString('es-CL',{maximumFractionDigits:1}))+' <small>meses prom.</small>',riskSkus().length?`<span class="down">${riskSkus().length} SKU con quiebre proyectado</span>`:'Sin quiebres proyectados','inventario')}
  </div>
  <div class="grid g21" style="margin-top:20px">
    <div class="card"><div class="card-h"><div><h3>Venta neta${U.fin?' y margen bruto':''} mensual</h3><div class="sub">Facturas − notas de crédito · MM CLP netos · ${esc(cliLabel)}</div></div>
      <div class="legend"><span><i style="background:var(--navy)"></i>Venta neta</span>${U.fin?'<span><i style="background:var(--gold)"></i>Margen %</span>':''}</div></div>
      ${barLine(bars,mline,chartMs.map(k=>ymLabel(k).split(' ')[0]),{barFmt:v=>'$'+v.toLocaleString('es-CL',{maximumFractionDigits:1})+' MM'})}
    </div>
    <div class="card"><div class="card-h"><div><h3>Alertas</h3><div class="sub">Requieren acción</div></div><span class="pill ${al.length?'p-bad':'p-ok'}">${al.length}</span></div>
      <div class="list">${al.slice(0,6).map(x=>alertRow(...x)).join('')||'<p class="muted small">Todo en orden.</p>'}</div>
    </div>
  </div>
  <div class="grid g3" style="margin-top:20px">
    <div class="card"><div class="card-h"><div><h3>Fill Rate vs OTIF</h3><div class="sub">% mensual · total compañía</div></div><div class="legend"><span><i style="background:var(--navy)"></i>Fill Rate</span><span><i style="background:var(--gold)"></i>OTIF</span></div></div>${DB.cfg.service?lines2(DB.cfg.service.fill,DB.cfg.service.otif,DB.cfg.service.months.map(k=>ymLabel(k).split(' ')[0]),{h:240,w:380}):''}</div>
    <div class="card"><div class="card-h"><div><h3>Venta por cliente</h3><div class="sub">${esc(periodLabel(DF.period))} · MM CLP netos</div></div></div>
      ${byCli.map(x=>`<div style="margin:12px 0"><div class="row between small"><strong>${esc(x.c.com)}</strong><span class="num">${MM(x.v)}</span></div><div class="bar" style="margin-top:6px"><i style="width:${x.v/maxCli*100}%"></i></div></div>`).join('')||'<p class="muted small">Sin ventas para la selección.</p>'}
    </div>
    <div class="card"><div class="card-h"><div><h3>Accesos rápidos</h3><div class="sub">Flujo OC → cobranza</div></div></div>
      <div class="grid" style="gap:10px">
        <button class="btn btn-gold" onclick="location.hash='oc';setTimeout(openNewOC,50)">${ic('plus')}Ingresar OC</button>
        <button class="btn btn-line" onclick="location.hash='inventario';setTimeout(openImport,50)">${ic('stock')}Cargar Excel ROVAL</button>
        ${U.fin?`<button class="btn btn-line" onclick="location.hash='facturas';setTimeout(()=>openInvoice(),50)">${ic('inv')}Registrar factura SII</button>`:''}
        <button class="btn btn-line" onclick="location.hash='forecast'">${ic('dl')}Exportar forecast ROVAL</button>
      </div>
    </div>
  </div>`;
};
AFTER.inicio=()=>{
  el('fPeriod').onchange=e=>{DF.period=e.target.value;route()};
  const d=el('fCli');
  d.querySelectorAll('input').forEach(i=>i.onchange=()=>{i.checked?DF.clients.add(i.value):DF.clients.delete(i.value);rerenderKeepOpen()});
  d.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{DF.clients=new Set(b.dataset.all==='1'?CLIENTS.map(c=>c.id):[]);rerenderKeepOpen()});
};
function rerenderKeepOpen(){route();el('fCli').open=true}
document.addEventListener('click',e=>{const d=el('fCli');if(d&&d.open&&!d.contains(e.target))d.open=false});
function kpi(l,v,d,go,dark){return `<div class="card kpi ${dark?'dark':''}" onclick="location.hash='${go}'"><span class="go">Ver detalle →</span><div class="lbl">${l}</div><div class="val num">${v}</div><div class="delta">${d}</div></div>`}
function alertRow(t,i,a,b,go){const c=t==='bad'?['var(--bad-bg)','var(--bad)']:['var(--warn-bg)','var(--warn)'];return `<div style="cursor:pointer" onclick="location.hash='${go}'"><span class="ic" style="background:${c[0]};color:${c[1]}">${ic(i)}</span><div style="flex:1"><strong class="small" style="color:var(--navy)">${esc(a)}</strong><div class="tiny muted">${esc(b)}</div></div><span class="muted">›</span></div>`}

/* =========================================================
   CRM
   ========================================================= */
let crmTab='clientes';
VIEWS.crm=()=>`
  <div class="row between" style="margin-bottom:18px"><div class="seg" id="crmseg"><button data-t="clientes" class="${crmTab==='clientes'?'on':''}">Clientes</button><button data-t="pipeline" class="${crmTab==='pipeline'?'on':''}">Pipeline</button><button data-t="actividades" class="${crmTab==='actividades'?'on':''}">Actividades</button></div></div>
  <div>${crmBody()}</div>`;
function crmBody(){
  const av=o=>USERS[o]?`<img class="av" src="${esc(USERS[o].img)}" alt="${esc(USERS[o].name)}">`:'';
  if(crmTab==='pipeline')return `<div class="kanban">${(DB.cfg.pipeline||[]).map(c=>`<div class="col"><h4>${esc(c.st)}<span>${c.items.length}</span></h4>${c.items.map(d=>`<div class="deal"><strong>${esc(d.n)}</strong><span class="muted tiny">${esc(d.d)||'&nbsp;'}</span><div class="row"><span class="tag">${esc(d.v)}</span>${av(d.o)}</div></div>`).join('')}</div>`).join('')}</div>`;
  if(crmTab==='actividades')return `<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente / oportunidad</th><th>Descripción</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>
    ${(DB.cfg.activities||[]).map(r=>`<tr><td class="num">${esc(r[0])}</td><td><span class="tag">${esc(r[1])}</span></td><td><strong>${esc(r[2])}</strong></td><td>${esc(r[3])}</td><td><div class="row">${av(r[4])}${esc(USERS[r[4]]?.name||r[4])}</div></td><td>${pill(r[5],r[5]==='Hecha'?'p-ok':r[5]==='Programada'?'p-info':'p-warn')}</td></tr>`).join('')}</tbody></table></div></div>`;
  return `<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>RUT</th><th>Etapa</th><th>Lista de precios</th><th>Plazo pago</th><th>CD / sucursales</th><th class="r">Venta ${esc(ymLabel(CURM))}</th><th class="r">Por cobrar</th><th class="r">Fill Rate</th><th>Resp.</th></tr></thead><tbody>
  ${CLIENTS.map(c=>`<tr class="click" onclick="openClient('${c.id}')"><td><strong>${esc(c.name)}</strong><div class="tiny muted">${esc(c.contact)}</div></td><td class="num">${esc(c.rut)}</td><td>${pill(c.stage,c.stage==='activo'?'p-ok':'p-info')}</td><td>${pill(c.priceMode==='especial'?'Diferenciada':'Regular',c.priceMode==='especial'?'p-gold':'p-mute')}</td><td>${c.term} días</td><td class="small">${esc(c.cds.join(', '))}</td><td class="r num">${c.sales?MM(c.sales):'—'}</td><td class="r num">${c.ar?MM(c.ar):'—'}</td><td class="r num">${pct(c.fr)}</td><td>${av(c.owner)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
AFTER.crm=()=>el('crmseg').onclick=e=>{const t=e.target.dataset.t;if(!t)return;crmTab=t;route()};
function openClient(id){const c=C(id);const ocs=OCS.filter(o=>o.cli===id);
  drawer(`<div><div class="eyebrow" style="color:var(--gold-2)">Ficha cliente · ${c.id}</div><h2>${esc(c.name)}</h2><div class="small" style="color:#C4CCD6">${esc(c.rut)} · Nombre comercial: ${esc(c.com)}</div></div>`,`
  <div class="grid g3">${hl('Venta '+ymLabel(CURM),c.sales?MM(c.sales):'—')}${hl('Por cobrar',c.ar?MM(c.ar):'—')}${hl('Fill Rate / OTIF',c.fr!=null?pct(c.fr)+' / '+pct(c.otif,0):'N/D')}</div>
  <div class="card"><h3>Contacto y condiciones</h3><div class="grid g2" style="margin-top:12px;gap:12px">
    ${kv('Contacto',esc(c.contact))}${kv('Teléfono',esc(c.phone))}${kv('Email',esc(c.mail))}${kv('Plazo de pago',c.term+' días')}${kv('Sucursales / CD',esc(c.cds.join(' · ')))}${kv('Lista de precios',c.priceMode==='especial'?'Diferenciada · <a href="#productos" onclick="PT.tab=\'listas\';PT.cli=\''+c.id+'\'">ver precios</a>':'Regular')}${kv('Responsable',esc(USERS[c.owner]?.name||'—'))}</div></div>
  <div class="card"><h3>Órdenes de compra</h3><div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>OC</th><th>Fecha</th><th>Estado</th><th class="r">Neto</th></tr></thead><tbody>${ocs.map(o=>`<tr class="click" onclick="openOC(${o.id})"><td><strong>${esc(o.n)}</strong></td><td class="num">${o.f}</td><td>${pill(o.st,ST[o.st])}</td><td class="r num">${$$(o.net)}</td></tr>`).join('')||'<tr><td colspan=4 class="muted">Sin OC</td></tr>'}</tbody></table></div></div>`)}

/* =========================================================
   PRODUCTOS Y TARIFAS — catálogo + listas de precio por cliente
   ========================================================= */
const PT={tab:'catalogo',cli:null};
VIEWS.productos=()=>{
  const tabs=`<div class="tabs" id="ptabs"><button data-t="catalogo" class="${PT.tab==='catalogo'?'on':''}">Catálogo y tarifa regular</button><button data-t="listas" class="${PT.tab==='listas'?'on':''}">Listas de precio por cliente<span class="c">${CLIENTS.filter(c=>c.priceMode==='especial').length} diferenciadas</span></button></div>`;
  if(PT.tab==='catalogo')return tabs+`
  <div class="prod">${SKUS.map(s=>`<div class="card" onclick="openSku('${s.sku}')"><div class="ph"><img src="${esc(s.img)}" alt=""></div><div class="bd"><div class="brandtag" style="color:${s.brand==='Minino'?'var(--minino)':'var(--petmetro)'}">${esc(s.brand)} · ${esc(s.cat)}</div><h3 style="margin:6px 0 4px;font-size:.98rem">${esc(s.name)}</h3><div class="tiny muted">${esc(s.sku)} · EAN ${esc(s.ean)}</div>
  <div class="row between" style="margin-top:12px"><div><div class="tiny muted">Tarifa regular</div><strong class="num" style="color:var(--navy)">${$$(s.price)}</strong></div><div style="text-align:right"><div class="tiny muted">Costo neto</div><strong class="num">${U.fin?$$(s.cost):fin('$0.000')}</strong></div></div></div></div>`).join('')}</div>`;
  if(!PT.cli||!CLIENTS.find(c=>c.id===PT.cli))PT.cli=CLIENTS[0]?.id;
  const c=C(PT.cli),esp=c.priceMode==='especial';
  const hist=DB.clientPrices.filter(p=>p.cli===c.id);
  return tabs+`<div class="grid g12">
    <div class="card"><h3>Clientes</h3><div class="sub">Por defecto todos usan la tarifa regular</div><div class="cl-list" style="margin-top:10px" id="plist">
      ${CLIENTS.map(x=>`<button data-c="${x.id}" class="${x.id===c.id?'on':''}"><span>${esc(x.name)}</span>${pill(x.priceMode==='especial'?'Diferenciada':'Regular',x.priceMode==='especial'?'p-gold':'p-mute')}</button>`).join('')}</div></div>
    <div class="grid" style="gap:20px;align-content:start">
      <div class="card"><div class="card-h"><div><h3>${esc(c.name)}</h3><div class="sub">${esp?'Lista diferenciada: solo se editan los precios de este cliente. Los SKU sin precio propio usan la tarifa regular.':'Este cliente usa la tarifa regular. Asígnale una lista diferenciada para editar solo sus precios.'}</div></div>
        <div class="seg" id="pmode"><button data-m="regular" class="${!esp?'on':''}">Tarifa regular</button><button data-m="especial" class="${esp?'on':''}">Lista diferenciada</button></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>SKU</th><th class="r">Tarifa regular</th><th class="r">Precio cliente</th><th class="r">Dif.</th><th>Vigente desde</th>${U.fin?'<th class="r">Margen</th>':''}</tr></thead><tbody>
        ${SKUS.map(s=>{const pi=priceInfo(c.id,s.sku);const d=(pi.price-s.price)/s.price*100;return `<tr><td>${skuCell(s.sku)}</td><td class="r num">${$$(s.price)}</td>
          <td class="r">${esp?`<input class="price-in" data-sku="${s.sku}" data-orig="${pi.price}" value="${N(pi.price)}" inputmode="numeric">`:`<span class="num">${$$(pi.price)}</span>`}</td>
          <td class="r num ${d<0?'down':d>0?'up':''}" data-dif="${s.sku}">${Math.abs(d)<.05?'—':(d>0?'+':'')+pct(d)}</td><td class="small">${pi.src==='especial'?pi.from:'<span class="muted">Regular</span>'}</td>${U.fin?`<td class="r num">${pct((pi.price-s.cost)/pi.price*100)}</td>`:''}</tr>`}).join('')}</tbody></table></div>
        ${esp?`<div class="row" style="justify-content:flex-end;margin-top:14px"><label class="tiny muted" style="font-family:var(--fh);font-weight:600;letter-spacing:.06em">VIGENTE DESDE</label><input type="date" class="inp" id="pfrom" value="${isoToday()}"><button class="btn btn-gold" id="psave">${ic('check')}Guardar precios</button></div>`:''}
      </div>
      <div class="card"><h3>Historial de precios del cliente</h3><div class="sub">Nunca se sobrescribe: cada cambio crea una nueva vigencia (las OC históricas conservan su precio)</div>
        <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Vigente desde</th><th>SKU</th><th class="r">Precio</th><th>Usuario</th></tr></thead><tbody>
        ${hist.map(h=>`<tr><td class="num">${h.from}</td><td>${esc(S(h.sku).name)}</td><td class="r num">${$$(h.price)}</td><td>${esc(USERS[h.by]?.name||h.by||'—')}</td></tr>`).join('')||'<tr><td colspan=4 class="muted">Sin precios diferenciados</td></tr>'}</tbody></table></div></div>
    </div></div>`;
};
AFTER.productos=()=>{
  el('ptabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;PT.tab=b.dataset.t;route()};
  const pl=el('plist');if(!pl)return;
  pl.onclick=e=>{const b=e.target.closest('button');if(!b)return;PT.cli=b.dataset.c;route()};
  el('pmode').onclick=async e=>{const m=e.target.dataset.m;if(!m||m===C(PT.cli).priceMode)return;
    if(m==='regular'&&!confirm('El cliente volverá a usar la tarifa regular. Sus precios diferenciados quedan guardados en el historial. ¿Continuar?'))return;
    await act('setPriceMode',{client:PT.cli,mode:m},m==='especial'?'Lista diferenciada asignada':'Cliente asignado a tarifa regular')};
  document.querySelectorAll('.price-in').forEach(i=>i.oninput=()=>{const v=Number(i.value.replace(/\D/g,''))||0;i.classList.toggle('chg',v!==Number(i.dataset.orig));const s=S(i.dataset.sku);const d=(v-s.price)/s.price*100;const td=document.querySelector(`[data-dif="${i.dataset.sku}"]`);if(td){td.textContent=Math.abs(d)<.05?'—':(d>0?'+':'')+pct(d);td.className='r num '+(d<0?'down':d>0?'up':'')}});
  const sv=el('psave');if(sv)sv.onclick=async()=>{
    const prices=[...document.querySelectorAll('.price-in')].filter(i=>i.classList.contains('chg')).map(i=>({sku:i.dataset.sku,price:Number(i.value.replace(/\D/g,''))}));
    if(!prices.length)return toast('No hay precios modificados',true);
    if(prices.some(p=>!p.price))return toast('Hay precios vacíos o en cero',true);
    sv.disabled=true;await act('savePrices',{client:PT.cli,validFrom:el('pfrom').value,prices},`${prices.length} precio(s) guardado(s) · registrado en auditoría`);sv.disabled=false};
};
function openSku(k){const s=S(k);
  drawer(`<div><div class="eyebrow" style="color:var(--gold-2)">${esc(s.brand)} · ${esc(s.cat)}</div><h2>${esc(s.name)}</h2><div class="small" style="color:#C4CCD6">${esc(s.sku)}</div></div>`,`
  <div class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><img src="${esc(s.img)}" style="width:140px;border-radius:12px"><div class="grid g2" style="flex:1;gap:12px;min-width:240px">${kv('EAN',esc(s.ean))}${kv('DUN',esc(s.dun))}${kv('Gramaje',esc(s.g))}${kv('Unidades/caja',s.ucj)}${kv('Cajas/pallet',s.cjp)}${kv('Proveedor',esc(s.prov))}</div></div>
  <div class="card"><h3>Precio vigente por cliente</h3><div class="sub">Tarifa regular ${$$(s.price)} · los clientes con lista diferenciada pueden tener precio propio</div><div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Cliente</th><th>Lista</th><th class="r">Precio neto</th><th>Vigencia</th>${U.fin?'<th class="r">Margen</th>':''}</tr></thead><tbody>
  ${CLIENTS.map(c=>{const pi=priceInfo(c.id,s.sku);return `<tr><td>${esc(c.com)}</td><td>${pill(pi.src==='especial'?'Diferenciada':'Regular',pi.src==='especial'?'p-gold':'p-mute')}</td><td class="r num">${$$(pi.price)}</td><td class="small">${pi.from||'—'}</td>${U.fin?`<td class="r num">${pct((pi.price-s.cost)/pi.price*100)}</td>`:''}</tr>`}).join('')}</tbody></table></div></div>
  <div class="card"><h3>Parámetros de abastecimiento</h3><div class="grid g2" style="margin-top:12px;gap:12px">${kv('Lead time',s.lead+' días')}${kv('MOQ',N(s.moq)+' un')}${kv('Múltiplo',N(s.mult)+' un')}${kv('Stock de seguridad',N(s.ss)+' un')}</div></div>`)}

/* =========================================================
   ÓRDENES DE COMPRA — ordenar y agrupar
   ========================================================= */
const OCV={tab:'todas',sort:'f-desc',group:'none'};
const sortFns={
 'f-desc':(a,b)=>pd(b.f)-pd(a.f),'f-asc':(a,b)=>pd(a.f)-pd(b.f),
 'req-asc':(a,b)=>pd(a.req)-pd(b.req),'req-desc':(a,b)=>pd(b.req)-pd(a.req),
 'cli-asc':(a,b)=>C(a.cli).com.localeCompare(C(b.cli).com,'es')||pd(b.f)-pd(a.f),'cli-desc':(a,b)=>C(b.cli).com.localeCompare(C(a.cli).com,'es')||pd(b.f)-pd(a.f),
 'net-desc':(a,b)=>b.net-a.net,'net-asc':(a,b)=>a.net-b.net
};
const groupFns={none:null,cli:o=>C(o.cli).name,st:o=>o.st,mes:o=>ymLabel(ymOf(o.f),true),req:o=>'Entrega '+ymLabel(ymOf(o.req),true)};
VIEWS.oc=()=>{const sts=['todas','pendiente validación','aprobada','preparación','parcial','entregada','cerrada','cancelada','borrador'];
  const q=(el('q').value||'').toLowerCase();
  let list=OCS.filter(o=>(OCV.tab==='todas'||o.st===OCV.tab)&&(!q||(o.n+' '+C(o.cli).name).toLowerCase().includes(q))).slice().sort(sortFns[OCV.sort]);
  const gf=groupFns[OCV.group];const groups=[];
  if(gf){const m=new Map();list.forEach(o=>{const k=gf(o);if(!m.has(k))m.set(k,[]);m.get(k).push(o)});m.forEach((v,k)=>groups.push([k,v]))}else groups.push([null,list]);
  const th=(l,k,cls='')=>{const on=OCV.sort.startsWith(k+'-');const dir=on?(OCV.sort.endsWith('asc')?' ▲':' ▼'):'';return `<th class="sort ${cls} ${on?'on':''}" data-k="${k}">${l}${dir}</th>`};
  const row=o=>`<tr class="click" onclick="openOC(${o.id})"><td><strong>${esc(o.n)}</strong>${o.ai?' <span class="tag" title="Extraída por IA">IA</span>':''}</td><td>${esc(C(o.cli).com)}</td><td class="num">${o.f}</td><td class="num">${o.req||'—'}</td><td class="small">${esc(o.cd)}</td><td class="r">${o.lines.length}</td><td class="r num">${N(o.units)}</td><td class="r num">${$$(o.net)}</td><td>${pill(o.st,ST[o.st])}</td></tr>`;
  return `<div class="row between" style="margin-bottom:6px"><p class="muted small">Una OC representa demanda: no es venta facturada. Despacho, factura y pago son eventos independientes.</p><button class="btn btn-gold" onclick="openNewOC()">${ic('plus')}Ingresar OC</button></div>
  <div class="tabs" id="octabs">${sts.map(s=>{const n=s==='todas'?OCS.length:OCS.filter(o=>o.st===s).length;return n||s==='todas'?`<button data-s="${s}" class="${OCV.tab===s?'on':''}">${s[0].toUpperCase()+s.slice(1)}<span class="c">${n}</span></button>`:''}).join('')}</div>
  <div class="filters">
    <label>Ordenar por</label><select id="ocSort">${[['f-desc','Fecha emisión · más reciente'],['f-asc','Fecha emisión · más antigua'],['req-asc','Fecha solicitada · más próxima'],['req-desc','Fecha solicitada · más lejana'],['cli-asc','Cliente A → Z'],['cli-desc','Cliente Z → A'],['net-desc','Monto neto · mayor'],['net-asc','Monto neto · menor']].map(([k,l])=>`<option value="${k}" ${OCV.sort===k?'selected':''}>${l}</option>`).join('')}</select>
    <label>Agrupar por</label><select id="ocGroup">${[['none','Sin agrupar'],['cli','Cliente'],['st','Estado'],['mes','Mes de emisión'],['req','Mes de entrega']].map(([k,l])=>`<option value="${k}" ${OCV.group===k?'selected':''}>${l}</option>`).join('')}</select>
    <span style="flex:1"></span><span class="tiny muted">${list.length} OC · ${N(list.reduce((a,o)=>a+o.units,0))} un · ${MM(list.reduce((a,o)=>a+o.net,0))}</span>
  </div>
  <div class="card"><div class="tbl-wrap"><table id="octbl"><thead><tr><th>N° OC</th>${th('Cliente','cli')}${th('Emisión','f')}${th('Fecha solicitada','req')}<th>CD destino</th><th class="r">Líneas</th><th class="r">Unidades</th>${th('Neto','net','r')}<th>Estado</th></tr></thead><tbody>
  ${groups.map(([k,os])=>(k!=null?`<tr class="grp"><td colspan="6">${esc(k)} <span class="tiny muted" style="font-weight:500">· ${os.length} OC</span></td><td class="r num">${N(os.reduce((a,o)=>a+o.units,0))}</td><td class="r num">${$$(os.reduce((a,o)=>a+o.net,0))}</td><td></td></tr>`:'')+os.map(row).join('')).join('')||'<tr><td colspan="9" class="empty">Sin OC para el filtro</td></tr>'}</tbody></table></div></div>`};
AFTER.oc=()=>{
  el('octabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;OCV.tab=b.dataset.s;route()};
  el('ocSort').onchange=e=>{OCV.sort=e.target.value;route()};
  el('ocGroup').onchange=e=>{OCV.group=e.target.value;route()};
  el('octbl').querySelectorAll('th.sort').forEach(t=>t.onclick=()=>{const k=t.dataset.k;const def=k==='cli'?'asc':k==='req'?'asc':'desc';OCV.sort=OCV.sort.startsWith(k+'-')?(k+'-'+(OCV.sort.endsWith('asc')?'desc':'asc')):(k+'-'+def);route()});
};
function openOC(id){const o=OCS.find(x=>x.id===id);if(!o)return;
  if(['pendiente validación','borrador'].includes(o.st))return openReview(id);
  const flow=['borrador','pendiente validación','aprobada','preparación','parcial','entregada','cerrada'];const idx=flow.indexOf(o.st);
  const ds=DESP.filter(d=>d.oc===o.n&&d.cli===o.cli);const fs=INVS.filter(f=>f.oc.includes(o.n));
  drawer(`<div><div class="eyebrow" style="color:var(--gold-2)">Orden de compra · ${esc(C(o.cli).com)}</div><h2>OC ${esc(o.n)}</h2><div class="small" style="color:#C4CCD6">Emisión ${o.f} · Solicitada ${o.req||'—'} · ${esc(o.cd)}</div></div>`,`
  ${o.st==='cancelada'?`<div class="alert a-bad">${ic('warn')}<div><b>OC cancelada.</b> ${esc(o.motivo||'')}</div></div>`:`<div class="card"><div class="steps">${['Borrador','Validación','Aprobada','Preparación','Parcial','Entregada','Cerrada'].map((s,i)=>`<div class="${i<idx?'done':i===idx?'done cur':''}">${s}</div>`).join('')}</div></div>`}
  <div class="card"><div class="card-h"><h3>Líneas</h3></div><div class="tbl-wrap"><table><thead><tr><th>SKU</th><th class="r">Solicitado</th><th class="r">Aceptado</th><th class="r">Faltante</th><th class="r">Precio neto</th><th class="r">Subtotal</th></tr></thead><tbody>
  ${o.lines.map((l,i)=>{const a=o.acc?o.acc[i]:null;return `<tr><td>${skuCell(l[0])}</td><td class="r num">${N(l[1])}</td><td class="r num">${a==null?'—':N(a)}</td><td class="r num ${a!=null&&a<l[1]?'down':''}">${a==null?'—':N(l[1]-a)}</td><td class="r num">${$$(l[2])}</td><td class="r num">${$$(l[1]*l[2])}</td></tr>`}).join('')}
  <tr><td><strong>Total neto</strong></td><td class="r num"><strong>${N(o.units)}</strong></td><td colspan=3></td><td class="r num"><strong>${$$(o.net)}</strong></td></tr></tbody></table></div>
  ${o.acc&&o.acc.reduce((a,b)=>a+b,0)<o.units?`<div class="alert a-warn" style="margin-top:14px">${ic('info')}<div><b>Fill Rate ${pct(o.acc.reduce((a,b)=>a+b,0)/o.units*100)}</b> · faltante ${N(o.units-o.acc.reduce((a,b)=>a+b,0))} un${o.motivo?' · motivo: '+esc(o.motivo):''}</div></div>`:''}</div>
  <div class="grid g2"><div class="card"><h3>Despachos (${ds.length})</h3>${ds.map(d=>`<div class="list"><div><span class="ic" style="background:var(--cream);color:var(--gold)">${ic('truck')}</span><div style="flex:1"><strong class="small">${esc(d.id)}</strong><div class="tiny muted">${d.f} → ${d.ent} · ${N(d.acc)}/${N(d.sol)} un</div></div>${pill(d.st,d.st.includes('OK')?'p-ok':d.st.includes('prep')?'p-gold':'p-warn')}</div></div>`).join('')||'<p class="muted small" style="margin-top:8px">Sin despachos aún.</p>'}</div>
  <div class="card"><h3>Facturas asociadas (${fs.length})</h3>${fs.map(f=>`<div class="list"><div><span class="ic" style="background:var(--cream);color:var(--gold)">${ic('inv')}</span><div style="flex:1"><strong class="small">${f.t===61?'NC':'F'} ${f.fo} · DTE ${f.t}</strong><div class="tiny muted">${f.f} · ${$$(f.net)} neto</div></div>${pill(f.est,f.est==='Pagada'?'p-ok':f.est==='Vencida'?'p-bad':'p-info')}</div></div>`).join('')||'<p class="muted small" style="margin-top:8px">Sin factura registrada.</p>'}</div></div>`)}

/* Ingreso manual de OC */
function openNewOC(){
  const c0=CLIENTS.find(c=>c.stage==='activo')||CLIENTS[0];
  modal(`<div><div class="eyebrow" style="color:var(--gold-2)">Nueva orden de compra</div><h2>Ingresar OC</h2></div>`,`<div style="padding:22px 26px;display:grid;gap:16px">
   <div class="alert a-info">${ic('ai')}<div><b>Lectura de PDF con IA:</b> se habilita al definir el proveedor de IA (pregunta abierta del brief). Mientras tanto, ingresa la OC aquí: queda <b>pendiente de validación</b> y no reserva stock hasta que alguien la apruebe.</div></div>
   <div class="card"><div class="grid g3" style="gap:14px">
     ${inp('Cliente',`<select class="inp" style="width:100%" id="nCli">${clientOpts(c0.id)}</select>`,1)}
     ${inp('N° OC','','', 'id="nNum" placeholder="Ej: 4500132" maxlength="40"')}
     ${inp('CD destino',`<select class="inp" style="width:100%" id="nCd"></select>`,1)}
     ${inp('Fecha emisión',`<input type="date" class="inp" style="width:100%" id="nIss" value="${isoToday()}">`,1)}
     ${inp('Fecha solicitada',`<input type="date" class="inp" style="width:100%" id="nReq" value="${isoToday()}">`,1)}
     <div id="nDup" class="small" style="align-self:end"></div></div></div>
   <div class="card"><div class="card-h"><h3>Líneas</h3><button class="btn btn-line btn-sm" id="nAdd">${ic('plus')}Agregar línea</button></div>
     <div class="tbl-wrap"><table class="lines-ed"><thead><tr><th style="min-width:220px">SKU</th><th class="r" style="width:120px">Unidades</th><th class="r" style="width:140px">Precio neto</th><th class="r">Tarifa vigente</th><th class="r">Subtotal</th><th></th></tr></thead><tbody id="nLines"></tbody>
     <tfoot><tr><td><strong>Total</strong></td><td class="r num" id="nU"></td><td></td><td></td><td class="r num" id="nT"></td><td></td></tr></tfoot></table></div></div>
   <div class="row" style="justify-content:flex-end"><button class="btn btn-line" onclick="closeAll()">Cancelar</button><button class="btn btn-gold" id="nSave">Guardar · enviar a validación</button></div></div>`);
  const cli=()=>el('nCli').value;
  const fillCd=()=>{el('nCd').innerHTML=C(cli()).cds.map(c=>`<option>${esc(c)}</option>`).join('')};
  const addLine=(sku=SKUS[0].sku)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><select class="inp ls">${SKUS.map(s=>`<option value="${s.sku}" ${s.sku===sku?'selected':''}>${esc(s.sku)} · ${esc(s.name)}</option>`).join('')}</select></td><td><input class="inp lq r" inputmode="numeric" value=""></td><td><input class="inp lp r" inputmode="numeric" value="${priceInfo(cli(),sku).price}"></td><td class="r num lt"></td><td class="r num lsub"></td><td><button class="btn btn-line btn-sm lx" title="Quitar">×</button></td>`;el('nLines').appendChild(tr);
    tr.querySelector('.ls').onchange=e=>{tr.querySelector('.lp').value=priceInfo(cli(),e.target.value).price;calc()};tr.querySelector('.lx').onclick=()=>{tr.remove();calc()};tr.querySelectorAll('input').forEach(i=>i.oninput=calc);calc()};
  const calc=()=>{let u=0,t=0;el('nLines').querySelectorAll('tr').forEach(tr=>{const s=tr.querySelector('.ls').value,q=+tr.querySelector('.lq').value.replace(/\D/g,'')||0,p=+tr.querySelector('.lp').value.replace(/\D/g,'')||0;const pi=priceInfo(cli(),s);
    tr.querySelector('.lt').innerHTML=$$(pi.price)+(p&&p!==pi.price?`<div class="tiny down">Dif. ${$$(p-pi.price)}</div>`:'');tr.querySelector('.lsub').textContent=$$(q*p);u+=q;t+=q*p});el('nU').textContent=N(u);el('nT').textContent=$$(t)};
  const dup=()=>{const n=el('nNum').value.trim();const d=OCS.find(o=>o.cli===cli()&&o.n===n);el('nDup').innerHTML=d?`<span class="down">⚠ La OC ${esc(n)} ya existe para este cliente</span>`:''};
  el('nCli').onchange=()=>{fillCd();el('nLines').querySelectorAll('tr').forEach(tr=>tr.querySelector('.lp').value=priceInfo(cli(),tr.querySelector('.ls').value).price);calc();dup()};
  el('nNum').oninput=dup;el('nAdd').onclick=()=>addLine();fillCd();addLine();
  el('nSave').onclick=async()=>{
    const lines=[...el('nLines').querySelectorAll('tr')].map(tr=>({sku:tr.querySelector('.ls').value,qty:tr.querySelector('.lq').value,price:tr.querySelector('.lp').value})).filter(l=>+String(l.qty).replace(/\D/g,''));
    if(!el('nNum').value.trim())return toast('Falta el número de OC',true);
    if(!lines.length)return toast('Agrega al menos una línea con unidades',true);
    el('nSave').disabled=true;
    const r=await act('createOC',{client:cli(),number:el('nNum').value.trim(),issued:el('nIss').value,requested:el('nReq').value,cd:el('nCd').value,lines},'OC ingresada · pendiente de validación');
    el('nSave').disabled=false;if(r){closeAll();location.hash='oc';setTimeout(()=>openReview(r.id),60)}};
}

/* Revisión y aprobación (validación humana obligatoria) */
function openReview(id){
  const o=OCS.find(x=>x.id===id);if(!o)return;
  const sim=OCS.filter(x=>x.id!==o.id&&x.cli===o.cli&&x.st!=='cancelada'&&Math.abs(pd(x.f)-pd(o.f))<=7*864e5&&x.cd===o.cd);
  const lastLoad=DB.loads.find(l=>l.st.startsWith('Publicada'));
  modal(`<div><div class="eyebrow" style="color:var(--gold-2)">Validación humana obligatoria · ${esc(o.st)}</div><h2>OC ${esc(o.n)} · ${esc(C(o.cli).name)}</h2><div class="small" style="color:#C4CCD6">Emisión ${o.f} · Solicitada ${o.req||'—'}</div></div>`,`
  <div style="padding:22px 26px;display:grid;gap:14px">
    ${sim.length?`<div class="alert a-warn">${ic('warn')}<div><b>Posible duplicado:</b> ${sim.map(s=>'OC '+esc(s.n)+' ('+s.f+')').join(', ')} del mismo cliente y CD en ±7 días. Revisa antes de aprobar.</div></div>`:''}
    <div class="card"><div class="grid g3" style="gap:14px">${kv('Cliente',esc(C(o.cli).name))}${inp('CD destino',`<select class="inp" style="width:100%" id="rCd">${C(o.cli).cds.map(c=>`<option ${c===o.cd?'selected':''}>${esc(c)}</option>`).join('')}</select>`,1)}${kv('Lista de precios',C(o.cli).priceMode==='especial'?'Diferenciada':'Regular')}</div></div>
    <div class="card"><h3>Líneas · contraste con tarifa vigente y stock</h3><div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>SKU</th><th class="r">Unidades</th><th class="r">Precio OC</th><th class="r">Tarifa vigente</th><th class="r">Disponible ROVAL</th></tr></thead><tbody>
    ${o.lines.map(l=>{const pi=priceInfo(o.cli,l[0]);const st=STOCK[l[0]];const ok=st&&st.disp>=l[1];return `<tr><td>${skuCell(l[0])}</td><td class="r"><input class="cell-in rq" data-line="${l[3]}" value="${N(l[1])}"></td><td class="r"><input class="cell-in rp ${l[2]!==pi.price?'chg':''}" data-line="${l[3]}" value="${N(l[2])}"></td><td class="r num">${$$(pi.price)}${l[2]!==pi.price?`<div class="tiny down">Dif. ${$$(l[2]-pi.price)}</div>`:''}</td><td class="r num ${ok?'':'down'}">${st?N(st.disp):'—'}${ok?'':' ⚠'}</td></tr>`}).join('')}</tbody></table></div>
    <div class="alert a-info" style="margin-top:12px">${ic('stock')}<div>Stock según carga ROVAL ${lastLoad?'del '+lastLoad.cutoff:''}. Al aprobar se reserva <b>solo el stock disponible confirmado</b>.</div></div></div>
  </div>
  <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:16px 26px;display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;align-items:center">
    <span class="small muted">${o.lines.filter(l=>l[2]!==priceInfo(o.cli,l[0]).price).length} diferencia(s) de precio vs tarifa</span>
    <div class="row"><button class="btn btn-line" id="rCancel">Cancelar OC</button><button class="btn btn-gold" id="rOk">${ic('check')}Aprobar OC</button></div>
  </div>`);
  el('rOk').onclick=async()=>{
    const lines=o.lines.map(l=>{const q=document.querySelector(`.rq[data-line="${l[3]}"]`).value.replace(/\D/g,''),p=document.querySelector(`.rp[data-line="${l[3]}"]`).value.replace(/\D/g,'');return {line:l[3],qty:q,price:p,changed:+q!==l[1]||+p!==l[2]}}).filter(l=>l.changed);
    el('rOk').disabled=true;const r=await act('approveOC',{id:o.id,lines,cd:el('rCd').value});el('rOk').disabled=false;
    if(r){closeAll();toast(r.short&&r.short.length?`OC aprobada · reserva parcial: ${r.short.join(', ')}`:`OC ${o.n} aprobada por ${U.name} · stock reservado`)}};
  el('rCancel').onclick=async()=>{const why=prompt('Motivo de cancelación');if(why==null)return;const r=await act('cancelOC',{id:o.id,reason:why},'OC cancelada');if(r)closeAll()};
}

/* =========================================================
   DESPACHOS
   ========================================================= */
VIEWS.despachos=()=>{const ev=DESP.filter(d=>d.desp);const solE=ev.reduce((a,d)=>a+d.sol,0),acc=ev.reduce((a,d)=>a+d.acc,0);
 const otif=ev.filter(d=>d.acc>=d.sol&&pd(d.ent)<=pd(d.comp)).length;const pend=DESP.filter(d=>d.ent==='—');
 return `<div class="grid g4">
  <div class="card">${donutRow(solE?acc/solE*100:0,'Fill Rate unidades',`${N(acc)} aceptadas / ${N(solE)} solicitadas`)}</div>
  <div class="card">${donutRow(ev.length?otif/ev.length*100:0,'OTIF',`${otif} de ${ev.length} completas y a tiempo`)}</div>
  <div class="card kpi" style="cursor:default"><div class="lbl">Unidades faltantes</div><div class="val num">${N(solE-acc)}</div><div class="delta muted">${ev.filter(d=>d.mot).length} motivos registrados</div></div>
  <div class="card kpi" style="cursor:default"><div class="lbl">Despachos pendientes</div><div class="val">${pend.length}</div><div class="delta ${pend.some(d=>pd(d.comp)<TODAY())?'down':''}">${pend.map(d=>esc(d.oc)).join(', ')||'—'}</div></div>
 </div>
 <div class="grid g21" style="margin-top:20px">
  <div class="card"><div class="card-h"><div><h3>Despachos</h3><div class="sub">Solicitado · despachado · recibido/aceptado · faltante</div></div></div><div class="tbl-wrap"><table><thead><tr><th>Despacho</th><th>OC</th><th>Cliente</th><th>Compromiso</th><th>Entrega real</th><th class="r">Solic.</th><th class="r">Desp.</th><th class="r">Acept.</th><th class="r">Faltante</th><th>Estado</th></tr></thead><tbody>
  ${DESP.map(d=>{const late=d.ent!=='—'&&pd(d.ent)>pd(d.comp);const o=OCS.find(x=>x.n===d.oc&&x.cli===d.cli);return `<tr class="${o?'click':''}" ${o?`onclick="openOC(${o.id})"`:''}><td><strong>${esc(d.id)}</strong></td><td>${esc(d.oc)}</td><td>${esc(C(d.cli).com)}</td><td class="num">${d.comp}</td><td class="num ${late?'down':''}">${d.ent}${late?' ⚑':''}</td><td class="r num">${N(d.sol)}</td><td class="r num">${N(d.desp)}</td><td class="r num">${N(d.acc)}</td><td class="r num ${d.sol-d.acc&&d.desp?'down':''}">${d.desp?N(d.sol-d.acc):'—'}</td><td>${pill(d.st,d.st.includes('OK')?'p-ok':d.st.includes('prep')?'p-gold':'p-warn')}${d.mot?`<div class="tiny muted" style="margin-top:3px;max-width:200px">${esc(d.mot)}</div>`:''}</td></tr>`}).join('')}</tbody></table></div></div>
  <div class="card"><div class="card-h"><div><h3>Nivel de servicio por cliente</h3><div class="sub">Fill Rate unidades · OTIF</div></div></div>
   ${CLIENTS.filter(c=>c.fr!=null).map(c=>`<div style="margin:14px 0"><div class="row between small"><strong>${esc(c.com)}</strong><span class="num">${pct(c.fr)} · OTIF ${pct(c.otif,0)}</span></div><div class="bar" style="margin-top:6px"><i class="${c.fr>=95?'ok':c.fr>=92?'warn':'bad'}" style="width:${c.fr}%"></i></div></div>`).join('')}
   <div class="alert a-info" style="margin-top:16px">${ic('info')}<div class="small"><b>Regla OTIF:</b> despacho completo y en o antes de la fecha compromiso. Tolerancia ${DB.cfg.params?.tolerancia_otif??0} días · los parciales cuentan como no-OTIF.</div></div>
  </div></div>`};
function donutRow(v,l,s){return `<div class="row" style="flex-wrap:nowrap">${donut([{v,c:v>=95?'var(--ok)':v>=90?'var(--gold)':'var(--bad)',l},{v:Math.max(0,100-v),c:'#EFEAE1',l:'resto'}],{size:92,label:pct(v),sub:''})}<div><div class="lbl" style="font-family:var(--fh);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">${l}</div><div class="tiny muted" style="margin-top:4px">${s}</div></div></div>`}

/* =========================================================
   INVENTARIO ROVAL
   ========================================================= */
VIEWS.inventario=()=>{
 const last=DB.loads.find(l=>l.st.startsWith('Publicada'));const days=last?Math.floor((Date.now()-new Date(last.ts))/864e5):null;
 const tot=k=>N(Object.values(STOCK).reduce((a,s)=>a+s[k],0));
 return `${days!=null&&days>=(DB.cfg.params?.max_edad_stock_dias??2)?`<div class="alert a-warn" style="margin-bottom:18px">${ic('warn')}<div><b>Stock con ${days} días de antigüedad.</b> Corte ROVAL ${last.cutoff}. No representa stock actual: solicita una nueva carga a ROVAL.</div></div>`:''}
 <div class="grid g4">
  ${hlc('Última carga',last?'#'+last.no+' · '+last.cutoff:'—',last?esc((USERS[last.by]?.name||'')+' · '+last.file):'')}
  ${hlc('Stock asignado PAROCK',tot('asg')+' un',SKUS.length+' SKU')}
  ${hlc('Disponible (− reservas)',tot('disp')+' un','Reservas vigentes de OC aprobadas')}
  ${hlc('En tránsito',tot('tr')+' un','Según informe ROVAL')}
 </div>
 <div class="card" style="margin-top:20px"><div class="card-h"><div><h3>Stock por SKU</h3><div class="sub">Disponible = asignado/confirmado por ROVAL − reservas vigentes · Cobertura = disponible / demanda mensual promedio forecast ${FCCUR}</div></div><div class="row"><button class="btn btn-line btn-sm" id="stExp">${ic('dl')}Exportar</button>${U.admin||U.fin?`<button class="btn btn-gold btn-sm" onclick="openImport()">${ic('up')}Cargar Excel ROVAL</button>`:''}</div></div>
 <div class="tbl-wrap"><table><thead><tr><th>SKU</th><th class="r">Asignado</th><th class="r">Reservado</th><th class="r">Disponible</th><th class="r">Tránsito</th><th>ETA</th><th class="r">Demanda/mes</th><th style="min-width:160px">Cobertura</th></tr></thead><tbody>
 ${SKUS.map(s=>{const st=STOCK[s.sku];if(!st)return '';const c=st.cov;const cls=c==null?'':c<1?'bad':c<1.5?'warn':'ok';return `<tr><td>${skuCell(s.sku)}</td><td class="r num">${N(st.asg)}</td><td class="r num">${N(st.res)}</td><td class="r num"><strong>${N(st.disp)}</strong></td><td class="r num">${st.tr?N(st.tr):'—'}</td><td class="num">${st.eta||'—'}</td><td class="r num">${N(st.dem)}</td><td><div class="row" style="flex-wrap:nowrap"><div class="bar" style="flex:1"><i class="${cls}" style="width:${c==null?0:Math.min(100,c/4*100)}%"></i></div><b class="num small ${cls==='bad'?'down':''}">${c==null?'N/D':c.toLocaleString('es-CL',{maximumFractionDigits:1})+' m'}</b></div></td></tr>`}).join('')}</tbody></table></div></div>
 <div class="card" style="margin-top:20px"><h3>Historial de cargas (fotografías)</h3><div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>#</th><th>Fecha corte</th><th>Archivo</th><th>Usuario</th><th>Resultado</th></tr></thead><tbody>
  ${DB.loads.map(l=>`<tr><td>${l.no}</td><td class="num">${l.cutoff}</td><td>${esc(l.file)}</td><td>${esc(USERS[l.by]?.name||'')}</td><td>${pill(l.st,l.st.startsWith('Publicada')?(l.st.includes('·')?'p-warn':'p-ok'):l.st.startsWith('Rechazada')?'p-bad':'p-mute')}</td></tr>`).join('')}</tbody></table></div></div>`};
AFTER.inventario=()=>{el('stExp').onclick=()=>download(`Stock_PAROCK_${isoToday()}.csv`,[['SKU','Descripción','Asignado','Reservado','Disponible','Tránsito','ETA','Demanda mensual','Cobertura (meses)'],...SKUS.map(s=>{const st=STOCK[s.sku]||{};return [s.sku,s.name,st.asg,st.res,st.disp,st.tr,st.eta,st.dem,st.cov==null?'N/D':st.cov.toFixed(1).replace('.',',')]})])};
function openImport(){
  if(!(U.admin||U.fin))return toast('Tu rol no puede cargar inventario',true);
  modal(`<div><div class="eyebrow" style="color:var(--gold-2)">Importación · plantilla ROVAL v1</div><h2>Cargar Excel de inventario</h2></div>`,`<div style="padding:22px 26px;display:grid;gap:14px">
   <div class="alert a-info">${ic('info')}<div>Columnas: <b>sku, asignado, reservado, transito, eta</b> (eta en formato dd-mm-aaaa). Acepta .xlsx o .csv. Los SKU desconocidos van a conciliación y las filas con negativos se rechazan, sin modificar el inventario publicado.</div></div>
   <div class="row"><button class="btn btn-line btn-sm" id="impTpl">${ic('dl')}Descargar plantilla</button></div>
   <div class="grid g2">${inp('Archivo',`<input type="file" id="impFile" accept=".xlsx,.xls,.csv" class="inp" style="width:100%">`,1)}${inp('Fecha y hora de corte ROVAL',`<input type="datetime-local" id="impCut" class="inp" style="width:100%" value="${isoToday()}T08:00">`,1)}</div>
   <div id="impPrev"></div>
   <div class="row" style="justify-content:flex-end"><button class="btn btn-line" onclick="closeAll()">Cancelar</button><button class="btn btn-gold" id="impOk" disabled>Confirmar carga</button></div></div>`);
  let rows=null,fname='';
  el('impTpl').onclick=()=>download('Plantilla_Inventario_ROVAL.csv',[['sku','asignado','reservado','transito','eta'],...SKUS.map(s=>[s.sku,'','','',''])]);
  el('impFile').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;fname=f.name;
    if(!window.XLSX)return toast('El lector de Excel aún no carga; reintenta en unos segundos',true);
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array',raw:false});const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false});
    const norm=o=>{const m={};for(const [k,v] of Object.entries(o))m[k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'')]=v;return {sku:m.sku||m.skuparock||m.codigo,assigned:m.asignado??m.stockasignado??m.fisico,reserved:m.reservado,transit:m.transito,eta:m.eta}};
    rows=data.map(norm).filter(r=>String(r.sku||'').trim());
    if(!rows.length){el('impPrev').innerHTML=`<div class="alert a-bad">${ic('warn')}<div>No se encontraron filas con columna <b>sku</b>.</div></div>`;return}
    const r=await api('importStock',{rows,cutoff:el('impCut').value,file:fname,dryRun:true}).catch(()=>null);if(!r)return;
    const ok=r.rows.filter(x=>x.result==='ok').length,er=r.rows.filter(x=>x.result==='error').length,cc=r.rows.filter(x=>x.result==='conciliación').length;
    el('impPrev').innerHTML=`<div class="grid g3">${hl('Filas OK',ok)}${hl('Errores',er)}${hl('A conciliación',cc)}</div>
     <div class="card" style="margin-top:12px"><div class="tbl-wrap"><table><thead><tr><th>Fila</th><th>SKU</th><th class="r">Asignado</th><th class="r">Reservado</th><th class="r">Disponible</th><th class="r">Tránsito</th><th>ETA</th><th>Validación</th></tr></thead><tbody>
     ${r.rows.map(x=>`<tr><td>${x.fila}</td><td>${esc(x.sku)}</td><td class="r num">${N(x.asg)}</td><td class="r num">${N(x.res)}</td><td class="r num ${x.asg-x.res<0?'down':''}">${N(x.asg-x.res)}</td><td class="r num">${N(x.tr)}</td><td>${esc(x.eta)}</td><td>${x.result==='ok'?pill('OK','p-ok'):x.result==='error'?pill('Error: negativo/inválido','p-bad'):pill('A conciliación','p-warn')}</td></tr>`).join('')}</tbody></table></div></div>`;
    el('impOk').disabled=!ok};
  el('impOk').onclick=async()=>{el('impOk').disabled=true;const r=await act('importStock',{rows,cutoff:el('impCut').value,file:fname},'Carga publicada como nueva fotografía');if(r)closeAll();else el('impOk').disabled=false};
}

/* =========================================================
   FORECAST
   ========================================================= */
const FV={ver:null,mode:'u',scen:1};
VIEWS.forecast=()=>{
 if(!FV.ver||!FCV.find(v=>v.version===FV.ver))FV.ver=FCCUR;
 const vinfo=FCV.find(v=>v.version===FV.ver)||{};const ro=vinfo.status!=='borrador';const data=fcRows(FV.ver);const k=FV.scen;
 const cons=SKUS.map(s=>({s,m:FCM.map((_,i)=>Math.round(data.filter(r=>r.s===s.sku).reduce((a,r)=>a+r.m[i],0)*k))}));
 const val=(r,i)=>FV.mode==='u'?r.m[i]*k:r.m[i]*k*priceInfo(r.c,r.s).price;
 const fmt=v=>FV.mode==='u'?N(v):'$'+(v/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+'M';
 const editable=!ro&&FV.mode==='u'&&k===1;
 return `<div class="row between" style="margin-bottom:18px">
  <div class="row"><label class="tiny muted" style="font-family:var(--fh);font-weight:600;letter-spacing:.08em">VERSIÓN</label><select id="fcver">${FCV.slice().reverse().map(v=>`<option value="${v.version}" ${v.version===FV.ver?'selected':''}>${v.version} · ${v.status==='borrador'?'vigente (borrador)':'enviada '+(v.frozen||'')+' 🔒'}</option>`).join('')}</select>
  <div class="seg" id="fcmode"><button data-m="u" class="${FV.mode==='u'?'on':''}">Unidades</button><button data-m="c" class="${FV.mode==='c'?'on':''}">CLP netos</button></div>
  <select id="fcscen"><option value="1" ${k===1?'selected':''}>Escenario base</option><option value="1.1" ${k===1.1?'selected':''}>Optimista (+10%)</option><option value="0.9" ${k===.9?'selected':''}>Conservador (−10%)</option></select></div>
  <div class="row">${!ro?`<button class="btn btn-gold" id="fcExp">${ic('dl')}Exportar para ROVAL y congelar</button>`:`<button class="btn btn-line" id="fcExp">${ic('dl')}Exportar consolidado</button>`}</div></div>
 ${ro?`<div class="alert a-info" style="margin-bottom:16px">${ic('lock')}<div>Versión <b>${FV.ver}</b> congelada el ${vinfo.frozen||'—'} · solo lectura.</div></div>`:''}
 ${k!==1?`<div class="alert a-warn" style="margin-bottom:16px">${ic('info')}<div>Viendo escenario ${k>1?'optimista':'conservador'} (${k>1?'+':'−'}10% sobre la versión). Para editar, vuelve al escenario base.</div></div>`:''}
 <div class="card"><div class="card-h"><div><h3>Matriz cliente × SKU × mes</h3><div class="sub">Horizonte 12 meses · ${editable?'celdas editables · cada cambio se guarda y queda en auditoría':'solo lectura'}</div></div><span class="tag">${FV.mode==='u'?'Unidades':'CLP netos (precio vigente del cliente)'}</span></div>
 <div class="tbl-wrap"><table class="fc"><thead><tr><th class="sticky">Cliente · SKU</th>${FCM.map(m=>`<th class="r">${m}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>
 ${CLIENTS.map(c=>{const rows=data.filter(r=>r.c===c.id);if(!rows.length)return '';return `<tr><td class="sticky" colspan="14" style="background:#FCFBF8;font-family:var(--fh);font-weight:700;color:var(--navy);font-size:.78rem">${esc(c.name)}</td></tr>`+rows.map(r=>`<tr><td class="sticky"><div class="small"><strong>${esc(S(r.s).name)}</strong></div></td>${r.m.map((v,i)=>`<td class="r">${editable?`<input class="cell-in" data-c="${r.c}" data-s="${r.s}" data-i="${i}" value="${N(v)}">`:`<span class="num small">${fmt(val(r,i))}</span>`}</td>`).join('')}<td class="r num small"><strong>${fmt(r.m.reduce((a,_,i)=>a+val(r,i),0))}</strong></td></tr>`).join('')}).join('')}
 </tbody></table></div></div>
 <div class="card" style="margin-top:20px"><div class="card-h"><div><h3>Consolidado por SKU · vista ROVAL</h3><div class="sub">Sin desglose de clientes ni precios · esto es lo que se exporta</div></div></div><div class="tbl-wrap"><table class="fc"><thead><tr><th class="sticky">SKU</th>${FCM.map(m=>`<th class="r">${m}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>
 ${cons.map(x=>`<tr><td class="sticky small"><strong>${esc(x.s.sku)}</strong></td>${x.m.map(v=>`<td class="r num small">${N(v)}</td>`).join('')}<td class="r num small"><strong>${N(x.m.reduce((a,b)=>a+b,0))}</strong></td></tr>`).join('')}
 <tr class="tot"><td class="sticky">Total unidades</td>${FCM.map((_,i)=>`<td class="r num small">${N(cons.reduce((a,x)=>a+x.m[i],0))}</td>`).join('')}<td class="r num small">${N(cons.reduce((a,x)=>a+x.m.reduce((p,q)=>p+q,0),0))}</td></tr></tbody></table></div></div>`};
AFTER.forecast=()=>{
 el('fcver').onchange=e=>{FV.ver=e.target.value;route()};
 el('fcmode').onclick=e=>{const m=e.target.dataset.m;if(m){FV.mode=m;route()}};
 el('fcscen').onchange=e=>{FV.scen=Number(e.target.value);route()};
 document.querySelectorAll('.cell-in[data-c]').forEach(inp=>inp.onchange=async()=>{const v=parseInt(inp.value.replace(/\D/g,''))||0;inp.value=N(v);inp.classList.add('chg');
   try{await api('fcCell',{version:FV.ver,client:inp.dataset.c,sku:inp.dataset.s,idx:+inp.dataset.i,value:v});const r=fcRows(FV.ver).find(x=>x.c===inp.dataset.c&&x.s===inp.dataset.s);if(r)r.m[+inp.dataset.i]=v;toast('Celda guardada')}catch(e){}});
 el('fcExp').onclick=async()=>{
   const data=fcRows(FV.ver);const rows=[['SKU','Descripción',...FCM]];
   SKUS.forEach(s=>rows.push([s.sku,s.name,...FCM.map((_,i)=>Math.round(data.filter(r=>r.s===s.sku).reduce((a,r)=>a+r.m[i],0)*FV.scen))]));
   download(`Forecast_PAROCK_${FV.ver}_ROVAL.csv`,rows);
   const vinfo=FCV.find(v=>v.version===FV.ver);
   if(vinfo&&vinfo.status==='borrador'&&FV.scen===1&&confirm(`¿Congelar ${FV.ver} como versión enviada a ROVAL? Se creará una nueva versión de trabajo.`)){const r=await act('freezeForecast',{version:FV.ver},`${FV.ver} congelada`);if(r){FV.ver=r.next}}
 };
};

/* =========================================================
   ABASTECIMIENTO
   ========================================================= */
let abSku=null;
VIEWS.abastecimiento=()=>{
 if(!abSku||!STOCK[abSku])abSku=(riskSkus()[0]||{s:SKUS[0]}).s.sku;
 const P=projection(abSku);if(!P)return '<div class="card empty">Sin datos de stock</div>';
 const {s,st}=P;const firstBreak=P.arr.findIndex(v=>v<0),firstSS=P.arr.findIndex(v=>v<s.ss);
 const monthStart=i=>{const [y,m]=FCK[i].split('-').map(Number);return new Date(y,m-1,1)};
 const recs=SKUS.map(x=>{const p=projection(x.sku);if(!p)return null;const b=p.arr.findIndex(v=>v<x.ss);if(b<0)return null;const need=Math.max(x.moq,Math.ceil((x.ss-p.arr[b]+p.dem[b])/x.mult)*x.mult);const order=monthStart(b);order.setDate(order.getDate()-x.lead);return {x,b,need,order,brk:p.arr[b]<0}}).filter(Boolean);
 const plan=Object.entries(st.plan||{}).sort();
 return `<div class="grid g21">
 <div class="card"><div class="card-h"><div><h3>Proyección de inventario mensual</h3><div class="sub">Disponible + tránsito + pedidos confirmados − demanda forecast ${FCCUR}</div></div><select id="absku">${SKUS.map(x=>`<option value="${x.sku}" ${x.sku===abSku?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
  ${projChart(P)}
  <div class="legend" style="margin-top:8px"><span><i style="background:var(--navy)"></i>Sobre stock seguridad</span><span><i style="background:#D69E2E"></i>Bajo stock seguridad</span><span><i style="background:var(--bad)"></i>Quiebre</span></div></div>
 <div class="card"><h3>Supuestos</h3><div class="grid g2" style="margin-top:12px;gap:12px">${kv('Stock disponible',N(st.disp)+' un')}${kv('Tránsito',st.tr?N(st.tr)+' un · ETA '+st.eta:'Sin tránsito')}${kv('Lead time',s.lead+' días')}${kv('Stock seguridad',N(s.ss)+' un')}${kv('MOQ / múltiplo',N(s.moq)+' / '+N(s.mult))}${kv('Demanda '+FCM[0],N(P.dem[0])+' un')}${kv('Pedidos confirmados',plan.map(([k,q])=>ymLabel(k)+': '+N(q)).join(' · ')||'—')}</div>
  ${firstBreak>=0?`<div class="alert a-bad" style="margin-top:16px">${ic('warn')}<div><b>Quiebre proyectado en ${FCM[firstBreak]}</b>. Con lead time ${s.lead} días, la orden debía emitirse antes del ${(d=>{d.setDate(d.getDate()-s.lead);return d.toLocaleDateString('es-CL')})(monthStart(firstBreak))}.</div></div>`:firstSS>=0?`<div class="alert a-warn" style="margin-top:16px">${ic('warn')}<div>Bajo stock de seguridad desde <b>${FCM[firstSS]}</b>.</div></div>`:`<div class="alert a-ok" style="margin-top:16px">${ic('check')}<div>Sin riesgo en 12 meses.</div></div>`}
 </div></div>
 <div class="card" style="margin-top:20px"><div class="card-h"><div><h3>Sugerencias de reposición</h3><div class="sub">Sujetas a confirmación de ROVAL · redondeadas a MOQ y múltiplo</div></div><button class="btn btn-line btn-sm" id="abExp">${ic('dl')}Exportar</button></div>
 <div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Riesgo desde</th><th class="r">Cantidad sugerida</th><th>Emitir pedido antes de</th><th>Proveedor</th><th>Estado</th></tr></thead><tbody>
 ${recs.map(r=>{const late=r.order<TODAY();return `<tr><td>${skuCell(r.x.sku)}</td><td>${pill((r.brk?'Quiebre ':'Bajo SS ')+FCM[r.b],r.brk?'p-bad':'p-warn')}</td><td class="r num"><strong>${N(r.need)}</strong> <span class="tiny muted">un</span></td><td class="num ${late?'down':''}">${r.order.toLocaleDateString('es-CL')}${late?' · urgente':''}</td><td class="small">${esc(r.x.prov)}</td><td>${pill('Por confirmar ROVAL','p-warn')}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Sin sugerencias: ningún SKU baja de su stock de seguridad.</td></tr>'}</tbody></table></div></div>`};
AFTER.abastecimiento=()=>{el('absku').onchange=e=>{abSku=e.target.value;route()};
 el('abExp').onclick=()=>{const rows=[['SKU','Descripción','Riesgo desde','Cantidad sugerida','Emitir antes de','Proveedor']];SKUS.forEach(x=>{const p=projection(x.sku);if(!p)return;const b=p.arr.findIndex(v=>v<x.ss);if(b<0)return;const need=Math.max(x.moq,Math.ceil((x.ss-p.arr[b]+p.dem[b])/x.mult)*x.mult);const [y,m]=FCK[b].split('-').map(Number);const d=new Date(y,m-1,1);d.setDate(d.getDate()-x.lead);rows.push([x.sku,x.name,FCM[b],need,d.toLocaleDateString('es-CL'),x.prov])});download(`Reposicion_PAROCK_${isoToday()}.csv`,rows)}};

/* =========================================================
   FACTURAS Y COBRANZA
   ========================================================= */
let fTab='todas';
VIEWS.facturas=()=>{const list=INVS.filter(f=>fTab==='todas'||f.est===fTab);const ar=INVS.reduce((a,f)=>a+f.saldo,0);
 const aging=[['Al día',0],['1–30',0],['31–60',0],['> 60',0]];INVS.forEach(f=>{if(!f.saldo)return;const d=(TODAY()-pd(f.v))/864e5;aging[d<=0?0:d<=30?1:d<=60?2:3][1]+=f.saldo});
 const cm=CURM;const fact=INVS.filter(f=>ymOf(f.f)===cm).reduce((a,f)=>a+f.net,0);
 const cob=INVS.reduce((a,f)=>a+f.pays.filter(p=>ymOf(p.f)===cm).reduce((x,p)=>x+p.amount,0),0);
 return `<div class="grid g4">
  ${hlc('Por cobrar',MM(ar),'Saldo = total − pagos − NC aplicadas')}
  ${hlc('Vencido',MM(aging.slice(1).reduce((a,x)=>a+x[1],0)),`<span class="down">${INVS.filter(f=>f.est==='Vencida').length} facturas</span>`)}
  ${hlc('Facturado '+ymLabel(cm)+' (neto)',MM(fact),'Facturas − notas de crédito')}
  ${hlc('Cobrado '+ymLabel(cm),MM(cob),'Pagos registrados en el mes')}
 </div>
 <div class="grid g21" style="margin-top:20px">
 <div class="card"><div class="card-h"><div><h3>Documentos registrados (emitidos en SII)</h3><div class="sub">Unicidad: folio + tipo DTE + emisor</div></div>${U.fin?`<button class="btn btn-gold btn-sm" onclick="openInvoice()">${ic('plus')}Registrar documento</button>`:''}</div>
 <div class="tabs" id="ftabs">${['todas','Por cobrar','Abono parcial','Vencida','Pagada'].map(s=>`<button data-s="${s}" class="${fTab===s?'on':''}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>
 <div class="tbl-wrap"><table><thead><tr><th>Folio</th><th>DTE</th><th>Cliente</th><th>Emisión</th><th>Vence</th><th class="r">Neto</th><th class="r">IVA</th><th class="r">Total</th><th class="r">Saldo</th><th>Estado</th></tr></thead><tbody>
 ${list.map(f=>`<tr class="click" onclick="openInv(${f.id})"><td><strong>${f.fo}</strong></td><td><span class="tag">${f.t===33?'33 Factura':f.t===61?'61 NC':f.t}</span></td><td>${esc(C(f.cli).com)}</td><td class="num">${f.f}</td><td class="num ${f.est==='Vencida'?'down':''}">${f.v}</td><td class="r num">${$$(f.net)}</td><td class="r num">${$$(f.iva)}</td><td class="r num">${$$(f.tot)}</td><td class="r num"><strong>${f.t===61?'—':$$(f.saldo)}</strong></td><td>${pill(f.est,{'Pagada':'p-ok','Vencida':'p-bad','Abono parcial':'p-warn','Por cobrar':'p-info'}[f.est]||'p-mute')}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="card"><h3>Antigüedad de saldos</h3><div class="sub">CLP con IVA</div>
  <div class="row" style="margin-top:16px;flex-wrap:nowrap;gap:18px">${donut(aging.map((a,i)=>({v:a[1]||0.001,c:['var(--ok)','var(--gold-2)','#D69E2E','var(--bad)'][i],l:a[0]})),{size:130,label:(ar/1e6).toLocaleString('es-CL',{maximumFractionDigits:1}),sub:'MM por cobrar'})}
  <div style="flex:1">${aging.map((a,i)=>`<div class="row between small" style="padding:6px 0;border-bottom:1px solid #F0EBE2"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${['var(--ok)','var(--gold-2)','#D69E2E','var(--bad)'][i]};margin-right:6px"></i>${a[0]} días</span><b class="num">${MM(a[1])}</b></div>`).join('')}</div></div>
  <h3 style="margin-top:22px">Próximos vencimientos</h3>
  <div class="list" style="margin-top:6px">${INVS.filter(f=>f.saldo&&f.est!=='Vencida').sort((a,b)=>pd(a.v)-pd(b.v)).slice(0,5).map(f=>`<div><span class="ic" style="background:var(--cream);color:var(--gold)">${ic('cal')}</span><div style="flex:1"><strong class="small">F${f.fo} · ${esc(C(f.cli).com)}</strong><div class="tiny muted">Vence ${f.v}</div></div><b class="num small">${$$(f.saldo)}</b></div>`).join('')}</div>
 </div></div>`};
AFTER.facturas=()=>el('ftabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;fTab=b.dataset.s;route()};
function openInv(id){const f=INVS.find(x=>x.id===id);if(!f)return;const ncs=INVS.filter(x=>x.t===61&&x.ref===f.fo);
 drawer(`<div><div class="eyebrow" style="color:var(--gold-2)">DTE ${f.t} · ${f.t===33?'Factura electrónica':f.t===61?'Nota de crédito':'Documento'}</div><h2>${f.t===61?'NC':'Factura'} ${f.fo}</h2><div class="small" style="color:#C4CCD6">${esc(C(f.cli).name)} · emitida en SII ${f.f}</div></div>`,`
 <div class="grid g3">${hl('Neto',$$(f.net))}${hl('IVA 19%',$$(f.iva))}${hl('Total',$$(f.tot))}</div>
 <div class="card"><h3>Asociaciones</h3><div class="grid g2" style="margin-top:12px;gap:12px">${kv('OC',esc(f.oc.join(', '))||'—')}${kv('Despachos',esc(f.ds.join(', '))||'—')}${kv('Vencimiento',f.v)}${kv('Estado',esc(f.est))}</div>
 ${f.ds.length>1?`<div class="alert a-info" style="margin-top:12px">${ic('info')}<div>Factura asociada a <b>${f.ds.length} despachos</b>: el ingreso se cuenta una sola vez (por factura), no por despacho.</div></div>`:''}</div>
 ${f.t!==61?`<div class="card"><h3>Cuenta corriente</h3><div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Monto</th></tr></thead><tbody>
  <tr><td>${f.f}</td><td>Factura ${f.fo}</td><td class="r num">${$$(f.tot)}</td></tr>
  ${ncs.map(n=>`<tr><td>${n.f}</td><td>NC ${n.fo}</td><td class="r num down">${$$(n.tot)}</td></tr>`).join('')}
  ${f.pays.map(p=>`<tr><td>${p.f}</td><td>Pago · ${esc(p.method||'')}</td><td class="r num down">−${$$(p.amount)}</td></tr>`).join('')}
  <tr><td></td><td><strong>Saldo</strong></td><td class="r num"><strong>${$$(f.saldo)}</strong></td></tr></tbody></table></div>
  ${U.fin&&f.saldo>0?`<div class="grid g3" style="margin-top:14px;gap:10px;align-items:end">${inp('Fecha pago',`<input type="date" class="inp" style="width:100%" id="payD" value="${isoToday()}">`,1)}${inp('Monto',String(f.saldo),'','id="payA" inputmode="numeric"')}<button class="btn btn-gold" id="payOk">${ic('money')}Registrar pago</button></div>
  <div class="row" style="margin-top:10px"><button class="btn btn-line btn-sm" id="ncNew">+ Nota de crédito</button></div>`:''}</div>`:''}`);
 const b=el('payOk');if(b)b.onclick=async()=>{b.disabled=true;const r=await act('registerPayment',{invoiceId:f.id,date:el('payD').value,amount:el('payA').value},'Pago registrado · saldo actualizado');b.disabled=false;if(r)openInv(id)};
 const n=el('ncNew');if(n)n.onclick=()=>openInvoice({dte:61,ref:f.fo,cli:f.cli,po:f.oc.join(', ')});
}
function openInvoice(pre={}){
  if(!U.fin)return toast('Requiere permiso financiero',true);
  const nextF=Math.max(0,...INVS.filter(f=>f.t===(pre.dte||33)).map(f=>f.fo))+1;
  modal(`<div><div class="eyebrow" style="color:var(--gold-2)">Registro manual</div><h2>Registrar documento emitido en SII</h2></div>`,`<div style="padding:22px 26px;display:grid;gap:14px">
   <div class="alert a-info">${ic('info')}<div>El documento se emite en SII. Aquí solo se <b>registra</b> y se asocia a OC/despachos. IVA calculado al 19%.</div></div>
   <div class="card"><div class="grid g3" style="gap:14px">
    ${inp('Folio',String(nextF),'','id="iFo" inputmode="numeric"')}
    ${inp('Tipo DTE',`<select class="inp" style="width:100%" id="iT"><option value="33" ${pre.dte!==61?'selected':''}>33 · Factura electrónica</option><option value="34">34 · Factura exenta</option><option value="61" ${pre.dte===61?'selected':''}>61 · Nota de crédito</option></select>`,1)}
    ${inp('Cliente',`<select class="inp" style="width:100%" id="iC">${clientOpts(pre.cli)}</select>`,1)}
    ${inp('Fecha emisión',`<input type="date" class="inp" style="width:100%" id="iF" value="${isoToday()}">`,1)}
    ${inp('Vencimiento',`<input type="date" class="inp" style="width:100%" id="iV">`,1)}
    ${inp('Neto (CLP)','','','id="iN" inputmode="numeric"')}
    ${inp('OC asociadas (separadas por coma)',pre.po||'','','id="iO"')}
    ${inp('Despachos asociados','','','id="iD"')}
    ${inp('Folio referencia (NC)',pre.ref?String(pre.ref):'','','id="iR" inputmode="numeric"')}</div>
    <div class="grid g3" style="margin-top:14px">${hl('IVA','<span id="iIva">$0</span>')}${hl('Total','<span id="iTot">$0</span>')}<div id="iDup" class="small" style="align-self:center"></div></div></div>
   <div class="row" style="justify-content:flex-end"><button class="btn btn-line" onclick="closeAll()">Cancelar</button><button class="btn btn-gold" id="iOk">Registrar documento</button></div></div>`);
  const setDue=()=>{const c=C(el('iC').value);const d=new Date(el('iF').value+'T12:00');if(!isNaN(d)){d.setDate(d.getDate()+(c.term||30));el('iV').value=d.toISOString().slice(0,10)}};
  const calc=()=>{const n=+el('iN').value.replace(/\D/g,'')||0,t=+el('iT').value;const iva=t===34?0:Math.round(n*.19);el('iIva').textContent=$$(iva);el('iTot').textContent=$$(n+iva);
    const fo=+el('iFo').value.replace(/\D/g,'');el('iDup').innerHTML=INVS.some(f=>f.fo===fo&&f.t===t)?`<span class="down">⚠ Folio ${fo} DTE ${t} ya registrado</span>`:`<span class="up">✓ Folio disponible</span>`};
  ['iN','iT','iFo'].forEach(i=>el(i).oninput=el(i).onchange=calc);el('iC').onchange=setDue;el('iF').onchange=setDue;setDue();calc();
  el('iOk').onclick=async()=>{el('iOk').disabled=true;const r=await act('registerInvoice',{folio:el('iFo').value,dte:el('iT').value,client:el('iC').value,issued:el('iF').value,due:el('iV').value,net:el('iN').value,po:el('iO').value,ds:el('iD').value,ref:el('iR').value},'Documento registrado');el('iOk').disabled=false;if(r)closeAll()};
}

/* =========================================================
   FINANZAS + RESUMEN DE IVA
   ========================================================= */
const FN={tab:'resultados',m:null};
VIEWS.finanzas=()=>{
 if(!U.fin)return lockView('Finanzas gerenciales','Tu rol no tiene permiso financiero. No puedes consultar costos, gastos, márgenes ni el resumen de IVA.');
 const months=[...new Set([...DB.sales.map(s=>s.m),...DB.purchases.map(p=>p.m),...INVS.map(f=>ymOf(f.f))])].filter(Boolean).sort().reverse().slice(0,12);
 if(!FN.m||!months.includes(FN.m))FN.m=months[0];
 const tabs=`<div class="row between" style="margin-bottom:6px"><div class="tabs" id="fntabs" style="margin-bottom:0;border:0"><button data-t="resultados" class="${FN.tab==='resultados'?'on':''}">Resultados y gastos</button><button data-t="iva" class="${FN.tab==='iva'?'on':''}">${ic('tax','style="width:14px;height:14px;vertical-align:-2px;stroke:currentColor;fill:none;stroke-width:2"')} Resumen IVA</button></div>
   <div class="row"><label class="tiny muted" style="font-family:var(--fh);font-weight:600;letter-spacing:.08em">PERIODO</label><select id="fnm">${months.map(k=>`<option value="${k}" ${k===FN.m?'selected':''}>${ymLabel(k,true)}</option>`).join('')}</select></div></div>`;
 return tabs+(FN.tab==='iva'?ivaView(months):resultsView());
};
function resultsView(){
 const m=FN.m;const sl=DB.sales.filter(s=>s.m===m);const venta=sl.reduce((a,s)=>a+s.net,0),cmv=sl.reduce((a,s)=>a+s.cost,0);
 const pur=DB.purchases.filter(p=>p.m===m&&p.category!=='Importación mercadería');const cat={};pur.forEach(p=>cat[p.category]=(cat[p.category]||0)+p.net);
 const flete=cat['Flete y distribución']||0;const otros=Object.entries(cat).filter(([k])=>k!=='Flete y distribución');const gtot=otros.reduce((a,[,v])=>a+v,0);
 const M=v=>(v/1e6).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
 const er=[['Venta neta (facturas − NC)',venta],['Costo de mercadería vendida',-cmv],['Margen bruto',venta-cmv,1],['Flete y distribución',-flete],['Contribución',venta-cmv-flete,1],...otros.map(([k,v])=>[k,-v]),['Resultado operacional gerencial',venta-cmv-flete-gtot,2]];
 const colors=['var(--navy)','var(--gold)','var(--gold-2)','#7C8B9C','#C9CFD6'];
 const allCat=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
 const due={};INVS.filter(f=>f.saldo>0).forEach(f=>{let k=ymOf(f.v);if(!k||k<CURM)k=CURM;due[k]=(due[k]||0)+f.saldo});const dueK=Array.from({length:4},(_,i)=>ymAdd(CURM,i));
 const ap=DB.purchases.filter(p=>!p.paid);
 return `<div class="alert a-info" style="margin:12px 0 18px">${ic('info')}<div>Estado de resultados <b>gerencial</b>, en netos. No reemplaza la contabilidad tributaria. ${ymLabel(m,true)}.</div></div>
 <div class="grid g12">
 <div class="card"><h3>Estado de resultados</h3><div class="sub">MM CLP netos</div><div style="margin-top:12px">${er.map(r=>`<div class="row between" style="flex-wrap:nowrap;padding:9px ${r[2]?'10px':'0'};${r[2]?'background:var(--cream);border-radius:8px;margin:4px 0;':'border-bottom:1px solid #F0EBE2;'}${r[2]===2?'background:var(--navy);color:#fff;':''}"><span class="small" style="${r[2]?'font-weight:700;font-family:var(--fh)':''}">${esc(r[0])}</span><b class="num small ${r[1]<0?'down':''}">${r[1]<0?'−':''}$${M(Math.abs(r[1]))}</b></div>`).join('')}
  <p class="tiny muted" style="margin-top:8px">Margen bruto ${pct(venta?(venta-cmv)/venta*100:null)} · Contribución ${pct(venta?(venta-cmv-flete)/venta*100:null)}</p></div></div>
 <div class="grid" style="gap:20px">
  <div class="grid g2"><div class="card"><h3>Gastos por categoría</h3><div class="sub">Netos · excluye importación de mercadería</div><div class="row" style="margin-top:12px;flex-wrap:nowrap;gap:16px">${donut(allCat.map(([k,v],i)=>({v,c:colors[i%5],l:k})),{size:120,label:'$'+M(allCat.reduce((a,[,v])=>a+v,0)),sub:'MM gastos'})}<div style="flex:1">${allCat.map(([k,v],i)=>`<div class="row between tiny" style="padding:4px 0;flex-wrap:nowrap"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${colors[i%5]};margin-right:6px"></i>${esc(k)}</span><b>$${M(v)}</b></div>`).join('')||'<p class="tiny muted">Sin gastos</p>'}</div></div></div>
  <div class="card"><h3>Cobranza esperada</h3><div class="sub">Saldos por mes de vencimiento · MM CLP (vencidos en el mes actual)</div>${barLine(dueK.map(k=>(due[k]||0)/1e6),null,dueK.map(k=>ymLabel(k).split(' ')[0]),{w:380,h:200,barColor:'var(--gold)',hiLast:false})}</div></div>
  <div class="card"><div class="card-h"><div><h3>Margen por cliente</h3><div class="sub">${ymLabel(m,true)}</div></div></div>${CLIENTS.map(c=>{const s=sl.find(x=>x.c===c.id);if(!s||!s.net)return '';const mg=(s.net-s.cost)/s.net*100;return `<div style="margin:12px 0"><div class="row between small"><strong>${esc(c.com)}</strong><span class="num">${MM(s.net)} · ${pct(mg)}</span></div><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100,mg/45*100)}%"></i></div></div>`}).join('')}</div>
 </div></div>
 <div class="grid g2" style="margin-top:20px">
  <div class="card"><div class="card-h"><h3>Cuentas por pagar</h3></div><div class="tbl-wrap"><table><thead><tr><th>Proveedor</th><th>Categoría</th><th>Emisión</th><th class="r">Total</th></tr></thead><tbody>
   ${ap.map(p=>`<tr><td>${esc(p.supplier)}</td><td class="small">${esc(p.category)}</td><td class="num">${p.f}</td><td class="r num">${$$(p.total)}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Sin cuentas por pagar</td></tr>'}</tbody></table></div></div>
  <div class="card"><h3>Margen de lista por SKU</h3><div class="sub">Tarifa regular vs costo neto</div><div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>SKU</th><th class="r">Tarifa</th><th class="r">Costo</th><th class="r">Margen</th></tr></thead><tbody>
   ${SKUS.map(s=>`<tr><td>${esc(s.name)}</td><td class="r num">${$$(s.price)}</td><td class="r num">${$$(s.cost)}</td><td class="r num"><b>${pct((s.price-s.cost)/s.price*100)}</b></td></tr>`).join('')}</tbody></table></div></div>
 </div>`;
}
function ivaCalc(k){
 const ventas=INVS.filter(f=>ymOf(f.f)===k);const compras=DB.purchases.filter(p=>p.m===k);
 const deb=ventas.filter(f=>f.t!==61).reduce((a,f)=>a+f.iva,0),ncIva=ventas.filter(f=>f.t===61).reduce((a,f)=>a+f.iva,0);
 const cred=compras.reduce((a,p)=>a+p.iva,0);const debN=deb+ncIva;
 return {ventas,compras,deb,ncIva,debN,cred,res:debN-cred,netV:ventas.reduce((a,f)=>a+f.net,0),netC:compras.reduce((a,p)=>a+p.net,0)};
}
function ivaView(months){
 const k=FN.m;const R=ivaCalc(k);const last=months.filter(m=>{const r=ivaCalc(m);return r.ventas.length||r.compras.length}).slice(0,6).reverse();
 return `<div class="alert a-info" style="margin:12px 0 18px">${ic('info')}<div>El ERP trabaja en <b>netos</b>; este resumen muestra el IVA de los documentos registrados para <b>cruzarlo con el Registro de Compras y Ventas (RCV) del SII</b> antes de declarar el F29. No reemplaza la declaración.</div></div>
 <div class="grid g4">
  ${hlc('Débito fiscal (ventas)',$$(R.deb),`${R.ventas.filter(f=>f.t!==61).length} documentos · neto ${MM(R.netV-(R.ventas.filter(f=>f.t===61).reduce((a,f)=>a+f.net,0)))}`)}
  ${hlc('Notas de crédito emitidas',$$(R.ncIva),`${R.ventas.filter(f=>f.t===61).length} NC en el periodo`)}
  ${hlc('Crédito fiscal (compras)',$$(R.cred),`${R.compras.length} documentos · incluye IVA importación`)}
  <div class="card kpi dark" style="cursor:default"><div class="lbl">${R.res>=0?'IVA a pagar estimado':'Remanente crédito fiscal'}</div><div class="val num">${$$(Math.abs(R.res))}</div><div class="delta">Débito neto − crédito fiscal · ${ymLabel(k,true)}</div></div>
 </div>
 <div class="card" style="margin-top:20px"><div class="card-h"><div><h3>Resumen mensual</h3><div class="sub">Últimos meses con documentos registrados</div></div><button class="btn btn-line btn-sm" id="ivaAll">${ic('dl')}Exportar resumen</button></div><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th class="r">Neto ventas</th><th class="r">Débito fiscal</th><th class="r">IVA NC</th><th class="r">Débito neto</th><th class="r">Neto compras</th><th class="r">Crédito fiscal</th><th class="r">IVA determinado</th></tr></thead><tbody>
  ${last.map(m=>{const r=ivaCalc(m);return `<tr class="click ${m===k?'grp':''}" data-m="${m}"><td><strong>${ymLabel(m,true)}</strong></td><td class="r num">${$$(r.netV)}</td><td class="r num">${$$(r.deb)}</td><td class="r num ${r.ncIva?'down':''}">${r.ncIva?$$(r.ncIva):'—'}</td><td class="r num">${$$(r.debN)}</td><td class="r num">${$$(r.netC)}</td><td class="r num">${$$(r.cred)}</td><td class="r num"><b class="${r.res<0?'up':''}">${r.res<0?'Remanente ':''}${$$(Math.abs(r.res))}</b></td></tr>`}).join('')}</tbody></table></div></div>
 <div class="grid g2" style="margin-top:20px">
  <div class="card"><div class="card-h"><div><h3>Ventas · ${ymLabel(k,true)}</h3><div class="sub">Para cruzar con RCV ventas</div></div><button class="btn btn-line btn-sm" id="ivaV">${ic('dl')}CSV</button></div><div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>Folio</th><th>RUT cliente</th><th class="r">Neto</th><th class="r">IVA</th><th class="r">Total</th></tr></thead><tbody>
   ${R.ventas.map(f=>`<tr><td><span class="tag">${f.t}</span></td><td>${f.fo}</td><td class="num">${esc(C(f.cli).rut)}</td><td class="r num">${$$(f.net)}</td><td class="r num">${$$(f.iva)}</td><td class="r num">${$$(f.tot)}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Sin documentos</td></tr>'}
   <tr class="tot"><td colspan="3"><strong>Total</strong></td><td class="r num"><strong>${$$(R.ventas.reduce((a,f)=>a+f.net,0))}</strong></td><td class="r num"><strong>${$$(R.debN)}</strong></td><td class="r num"><strong>${$$(R.ventas.reduce((a,f)=>a+f.tot,0))}</strong></td></tr></tbody></table></div></div>
  <div class="card"><div class="card-h"><div><h3>Compras · ${ymLabel(k,true)}</h3><div class="sub">Para cruzar con RCV compras</div></div><button class="btn btn-line btn-sm" id="ivaC">${ic('dl')}CSV</button></div><div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>Folio</th><th>Proveedor</th><th class="r">Neto</th><th class="r">IVA</th></tr></thead><tbody>
   ${R.compras.map(p=>`<tr><td><span class="tag">${p.dte}</span></td><td>${p.folio??'—'}</td><td class="small">${esc(p.supplier)}</td><td class="r num">${$$(p.net)}</td><td class="r num">${$$(p.iva)}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Sin documentos</td></tr>'}
   <tr class="tot"><td colspan="3"><strong>Total</strong></td><td class="r num"><strong>${$$(R.netC)}</strong></td><td class="r num"><strong>${$$(R.cred)}</strong></td></tr></tbody></table></div></div>
 </div>`;
}
AFTER.finanzas=()=>{
 const t=el('fntabs');if(!t)return;
 t.onclick=e=>{const b=e.target.closest('button');if(!b)return;FN.tab=b.dataset.t;route()};
 el('fnm').onchange=e=>{FN.m=e.target.value;route()};
 document.querySelectorAll('tr[data-m]').forEach(tr=>tr.onclick=()=>{FN.m=tr.dataset.m;route()});
 const k=FN.m;
 const v=el('ivaV');if(v)v.onclick=()=>{const R=ivaCalc(k);download(`IVA_ventas_${k}.csv`,[['Tipo DTE','Folio','Fecha','RUT cliente','Cliente','Neto','IVA','Total'],...R.ventas.map(f=>[f.t,f.fo,f.f,C(f.cli).rut,C(f.cli).name,f.net,f.iva,f.tot])])};
 const c=el('ivaC');if(c)c.onclick=()=>{const R=ivaCalc(k);download(`IVA_compras_${k}.csv`,[['Tipo DTE','Folio','Fecha','RUT proveedor','Proveedor','Categoría','Neto','IVA','Total'],...R.compras.map(p=>[p.dte,p.folio,p.f,p.supplier_rut,p.supplier,p.category,p.net,p.iva,p.total])])};
 const a=el('ivaAll');if(a)a.onclick=()=>{const ms=[...new Set([...DB.purchases.map(p=>p.m),...INVS.map(f=>ymOf(f.f))])].sort();download('Resumen_IVA_PAROCK.csv',[['Mes','Neto ventas','Débito fiscal','IVA NC','Débito neto','Neto compras','Crédito fiscal','IVA determinado'],...ms.map(m=>{const r=ivaCalc(m);return [m,r.netV,r.deb,r.ncIva,r.debN,r.netC,r.cred,r.res]})])};
};
function lockView(t,d){return `<div class="card lock">${ic('lock')}<h3>${t}</h3><p style="max-width:420px">${d}</p><span class="pill p-gold">Permiso requerido</span></div>`}

/* =========================================================
   ADMINISTRACIÓN
   ========================================================= */
let adTab='usuarios';
VIEWS.admin=()=>{if(!U.admin)return lockView('Administración','Solo usuarios con rol Admin pueden ver usuarios, permisos y auditoría.');
 const T={usuarios:()=>`<div class="grid g2">
  ${DB.users.map(u=>`<div class="card row" style="flex-wrap:nowrap;gap:16px"><img src="${esc(u.img)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px #fff,0 0 0 5px var(--gold-soft)"><div style="flex:1"><h3>${esc(u.name)}</h3><div class="small muted">${esc(u.role)} · usuario: ${esc(u.id)}</div><div class="row" style="margin-top:8px">${pill('Activo','p-ok')}</div></div></div>`).join('')}</div>
  <div class="card" style="margin-top:20px"><div class="card-h"><div><h3>Matriz de permisos por rol</h3><div class="sub">✓ total · L lectura · — sin acceso · aplicada en el servidor</div></div></div><div class="tbl-wrap"><table class="perm"><thead><tr><th>Módulo</th><th>Admin / Gerencia</th><th>Comercial</th></tr></thead><tbody>
  ${[['Dashboard','y','y'],['CRM','y','y'],['Productos y listas de precio','y','y'],['Costos y márgenes','y','n'],['OC · ingresar y aprobar','y','y'],['Despachos','y','p'],['Inventario ROVAL · cargar','y','p'],['Forecast · editar','y','y'],['Facturas y pagos · registrar','y','p'],['Finanzas e IVA','y','n'],['Administración y auditoría','y','n']].map(r=>`<tr><td>${r[0]}</td>${r.slice(1).map(x=>`<td><span class="ck ${x}">${x==='y'?'✓':x==='p'?'L':'—'}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`,
 auditoria:()=>`<div class="card"><div class="card-h"><div><h3>Bitácora inalterable</h3><div class="sub">La base de datos bloquea modificar o borrar registros · últimos ${DB.audit.length}</div></div><button class="btn btn-line btn-sm" id="audExp">${ic('dl')}Exportar</button></div><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>${DB.audit.map(a=>`<tr><td class="num small">${a[0]}</td><td>${esc(USERS[a[1]]?.name||a[1])}</td><td><strong>${esc(a[2])}</strong></td><td class="small">${esc(a[3])}</td></tr>`).join('')}</tbody></table></div></div>`,
 parametros:()=>{const p=DB.cfg.params||{};return `<div class="grid g2"><div class="card"><h3>Parámetros generales</h3><div class="grid g2" style="margin-top:14px;gap:14px">${kv('Moneda',esc(p.moneda))}${kv('Zona horaria',esc(p.zona))}${kv('IVA',p.iva+'%')}${kv('Tolerancia OTIF',p.tolerancia_otif+' días')}${kv('Meta Fill Rate',p.meta_fill+'%')}${kv('Antigüedad máx. stock ROVAL',p.max_edad_stock_dias+' días')}${kv('Sesión',p.sesion_horas+' horas')}</div></div>
  <div class="card"><h3>Respaldos</h3><div class="alert a-ok" style="margin-top:8px">${ic('check')}<div>Base de datos en Neon (PostgreSQL) con historial de restauración a un punto en el tiempo.</div></div></div></div>`}};
 return `<div class="tabs" id="adtabs">${[['usuarios','Usuarios y roles'],['auditoria','Auditoría'],['parametros','Parámetros']].map(([k,l])=>`<button data-t="${k}" class="${adTab===k?'on':''}">${l}</button>`).join('')}</div>${T[adTab]()}`};
AFTER.admin=()=>{const t=el('adtabs');if(t)t.onclick=e=>{const b=e.target.closest('button');if(!b)return;adTab=b.dataset.t;route()};
 const a=el('audExp');if(a)a.onclick=()=>download(`Auditoria_PAROCK_${isoToday()}.csv`,[['Fecha','Usuario','Registro','Detalle'],...DB.audit])};

/* =========================================================
   DRAWER / MODAL / SESIÓN
   ========================================================= */
function drawer(head,body){el('drawer').innerHTML=`<div class="dh">${head}<button class="x" onclick="closeAll()">×</button></div><div class="db">${body}</div>`;el('drawer').classList.add('open');el('ov').classList.add('open')}
function modal(head,body){el('modal').innerHTML=`<div class="dh" style="position:sticky;top:0;background:var(--navy);color:#fff;padding:22px 26px;display:flex;justify-content:space-between;gap:16px;z-index:3">${head.replace('<h2>','<h2 style="color:#fff">')}<button class="x" onclick="closeAll()" style="background:rgba(255,255,255,.1);border:0;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;flex:none">×</button></div>${body}`;el('modal').classList.add('open');el('ov').classList.add('open')}
function closeAll(){['drawer','modal','ov'].forEach(i=>el(i).classList.remove('open'));el('side').classList.remove('open');el('umenu').classList.remove('open')}
el('ov').onclick=closeAll;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
el('burger').onclick=()=>{el('side').classList.add('open');el('ov').classList.add('open')};
el('bell').onclick=()=>location.hash='inicio';
el('q').oninput=()=>{if(CUR!=='oc')location.hash='oc';else route();el('q').focus()};
el('userbtn').onclick=e=>{e.stopPropagation();el('umenu').classList.toggle('open')};
document.addEventListener('click',e=>{if(!el('umenu').contains(e.target))el('umenu').classList.remove('open')});
el('mOut').onclick=async()=>{await fetch('/api/logout',{method:'POST'});DB=null;location.hash='';showLogin()};
el('mPass').onclick=()=>{el('umenu').classList.remove('open');modal(`<div><div class="eyebrow" style="color:var(--gold-2)">Cuenta</div><h2>Cambiar contraseña</h2></div>`,`<div style="padding:22px 26px;display:grid;gap:14px;max-width:460px">
  ${inp('Contraseña actual','<input type="password" class="inp" style="width:100%" id="pw0" autocomplete="current-password">',1)}${inp('Nueva contraseña (mín. 10 caracteres)','<input type="password" class="inp" style="width:100%" id="pw1" autocomplete="new-password">',1)}${inp('Repite la nueva contraseña','<input type="password" class="inp" style="width:100%" id="pw2" autocomplete="new-password">',1)}
  <div class="row" style="justify-content:flex-end"><button class="btn btn-gold" id="pwOk">Guardar</button></div></div>`);
  el('pwOk').onclick=async()=>{if(el('pw1').value!==el('pw2').value)return toast('Las contraseñas no coinciden',true);const r=await api('changePassword',{current:el('pw0').value,next:el('pw1').value}).catch(()=>null);if(r){closeAll();toast('Contraseña actualizada')}}};
el('loginForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);el('loginErr').textContent='';const b=e.target.querySelector('button');b.disabled=true;
  try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:f.get('user'),password:f.get('password')})});
    if(!r.ok){el('loginErr').textContent=(await r.json().catch(()=>({}))).error||'No se pudo iniciar sesión';return}
    e.target.reset();el('loading').style.display='';el('loading').textContent='Cargando…';await load()}finally{b.disabled=false}};
load();
