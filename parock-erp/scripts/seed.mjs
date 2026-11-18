// Crea el esquema y carga datos ficticios de arranque.
// Uso: DATABASE_URL=... node scripts/seed.mjs [--reset]
// Las contraseñas iniciales se generan al azar y se imprimen UNA vez (solo se guarda el hash).
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { hashPassword } from '../lib/auth.js';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }
const sql = neon(url);
const iso = d => { const [a, b, c] = d.split('-'); return `${c}-${b}-${a}`; };

if (process.argv.includes('--reset')) {
  for (const t of ['audit_log','app_config','sales_monthly','forecast_lines','forecast_versions','stock_loads','stock','purchases','payments','invoices','dispatches','po_lines','purchase_orders','client_prices','products','clients','users'])
    await sql(`drop table if exists ${t} cascade`);
}
const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
for (const stmt of schema.split(/;\s*\n/).map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) await sql(stmt);

const [{ n }] = await sql`select count(*)::int n from users`;
if (n > 0) { console.log('La base ya tiene datos; usa --reset para recrear.'); process.exit(0); }

/* ---------- Usuarios ---------- */
const pw = () => crypto.randomBytes(9).toString('base64url');
const creds = { marcelo: pw(), kevin: pw() };
await sql`insert into users(id,name,role,fin,admin,img,pass_hash) values
 ('marcelo','Marcelo','Gerencia · Admin',true,true,'assets/equipo-marcelo.jpg',${hashPassword(creds.marcelo)}),
 ('kevin','Kevin','Comercial',false,false,'assets/equipo-kevin.jpg',${hashPassword(creds.kevin)})`;

/* ---------- Clientes ---------- */
const CLIENTS = [
 ['C01','Supermercados Mass','76.111.222-3','Mass',60,['CD Lo Aguirre','CD Concepción'],'activo','kevin','Paula Rojas · Compradora mascotas','+56 9 5555 1201','compras@mass.example','especial'],
 ['C02','Hiper Andino S.A.','77.234.567-8','Hiper Andino',45,['CD Quilicura'],'activo','kevin','Rodrigo Silva · Category manager','+56 9 5555 1302','rsilva@andino.example','especial'],
 ['C03','Mercado del Sur Ltda.','78.345.678-9','Mercado del Sur',30,['CD Puerto Montt','CD Temuco'],'activo','marcelo','Carla Muñoz · Jefa de compras','+56 9 5555 1403','cmunoz@msur.example','regular'],
 ['C04','PetCenter Express SpA','76.987.654-1','PetCenter',30,['Bodega Santiago'],'activo','kevin','Felipe Torres · Dueño','+56 9 5555 1504','felipe@petcenter.example','especial'],
 ['C05','Distribuidora Pacífico','79.111.333-5','D. Pacífico',45,['CD Antofagasta'],'aprobado','marcelo','Andrea Vega · Compras','+56 9 5555 1605','avega@dpacifico.example','regular']
];
for (const c of CLIENTS) await sql`insert into clients(id,name,rut,com,term,cds,stage,owner,contact,phone,mail,price_mode) values (${c[0]},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]},${c[6]},${c[7]},${c[8]},${c[9]},${c[10]},${c[11]})`;

/* ---------- Productos ---------- */
const SKUS = [
 ['MIN-ADU-4K','Minino Adulto 4 kg','Minino','Alimento gato','7801234500011','17801234500018','4.000 g',4,60,9800,13900,'assets/minino-4kg.jpg',75,1200,240,900,'Proveedor A (Brasil)'],
 ['PM-SCH-15K','PetMetro Super Chunk 15 kg','PetMetro','Alimento perro','7801234500028','17801234500025','15.000 g',1,48,21500,29900,'assets/super-chunk.jpg',90,480,48,250,'Proveedor B (Argentina)'],
 ['PM-CRT-120','PetMetro Creamy Treats 120 g','PetMetro','Snack gato','7801234500035','17801234500032','120 g',24,120,1450,2290,'assets/creamy-treats.jpg',60,5760,2880,3000,'Proveedor C (China)'],
 ['PM-CRB-500','PetMetro Crunchy Biscuits 500 g','PetMetro','Snack perro','7801234500042','17801234500049','500 g',12,80,1900,2990,'assets/crunchy-biscuits.jpg',60,3840,960,2000,'Proveedor C (China)'],
 ['PM-BAL-3K','PetMetro Balance Nutrition 3 kg','PetMetro','Alimento perro','7801234500059','17801234500056','3.000 g',4,72,7400,10490,'assets/balance-nutrition.jpg',90,1152,288,600,'Proveedor B (Argentina)']
];
for (const s of SKUS) await sql`insert into products(sku,name,brand,cat,ean,dun,grams,ucj,cjp,cost,price,img,lead_days,moq,mult,ss,supplier) values (${s[0]},${s[1]},${s[2]},${s[3]},${s[4]},${s[5]},${s[6]},${s[7]},${s[8]},${s[9]},${s[10]},${s[11]},${s[12]},${s[13]},${s[14]},${s[15]},${s[16]})`;

/* ---------- Listas de precio diferenciadas ---------- */
const CP = [
 ['C02','MIN-ADU-4K',13900,'2026-02-01'],['C02','MIN-ADU-4K',14100,'2026-11-01'],['C02','PM-SCH-15K',30500,'2026-02-01'],
 ['C04','PM-CRT-120',2350,'2026-03-01'],['C04','PM-CRB-500',3050,'2026-03-01'],['C04','MIN-ADU-4K',14200,'2026-03-01'],['C04','PM-BAL-3K',10900,'2026-03-01'],
 ['C01','PM-CRB-500',2990,'2026-01-15']
];
for (const p of CP) await sql`insert into client_prices(client_id,sku,price,valid_from,created_by) values (${p[0]},${p[1]},${p[2]},${p[3]},'marcelo')`;

/* ---------- Órdenes de compra ---------- */
const OCS = [
 ['4500128','C01','17-11-2026','24-11-2026','CD Lo Aguirre','pendiente validación',[['MIN-ADU-4K',480,13900],['PM-CRT-120',2400,2290],['PM-CRB-500',960,2890]],null,null,true],
 ['OC-88412','C02','16-11-2026','22-11-2026','CD Quilicura','aprobada',[['MIN-ADU-4K',320,14100],['PM-BAL-3K',144,10490]]],
 ['4500123','C01','04-11-2026','11-11-2026','CD Lo Aguirre','entregada',[['MIN-ADU-4K',1000,13900]],[950],'Producto dañado en tránsito (50 un)'],
 ['MS-20931','C03','10-11-2026','18-11-2026','CD Puerto Montt','parcial',[['PM-SCH-15K',96,29900],['PM-BAL-3K',288,10490]],[48,288]],
 ['OC-88377','C02','08-11-2026','14-11-2026','CD Quilicura','preparación',[['PM-CRT-120',1440,2290],['PM-CRB-500',720,2990]]],
 ['PC-1145','C04','12-11-2026','15-11-2026','Bodega Santiago','entregada',[['PM-CRT-120',480,2350],['PM-CRB-500',240,3050],['MIN-ADU-4K',80,14200]],[480,240,80]],
 ['4500119','C01','28-10-2026','04-11-2026','CD Concepción','cerrada',[['PM-CRT-120',4800,2290],['PM-CRB-500',1920,2990]],[4800,1920]],
 ['MS-20902','C03','25-10-2026','31-10-2026','CD Temuco','cerrada',[['MIN-ADU-4K',240,13700]],[216]],
 ['OC-88301','C02','22-10-2026','29-10-2026','CD Quilicura','cerrada',[['MIN-ADU-4K',480,14100],['PM-SCH-15K',48,30500]],[480,48]],
 ['PC-1139','C04','30-10-2026','03-11-2026','Bodega Santiago','cancelada',[['PM-BAL-3K',40,10900]]],
 ['4500131','C01','18-11-2026','26-11-2026','CD Concepción','borrador',[['PM-SCH-15K',48,29900]]]
];
for (const o of OCS) {
  const [{ id }] = await sql`insert into purchase_orders(number,client_id,issued,requested,cd,status,reason,ai,created_by,approved_by,approved_at)
    values (${o[0]},${o[1]},${iso(o[2])},${iso(o[3])},${o[4]},${o[5]},${o[8] || null},${!!o[9]},'kevin',
    ${['borrador','pendiente validación','cancelada'].includes(o[5]) ? null : 'marcelo'},${['borrador','pendiente validación','cancelada'].includes(o[5]) ? null : iso(o[2])}) returning id`;
  for (const [i, l] of o[6].entries()) await sql`insert into po_lines(po_id,line,sku,qty,price,accepted) values (${id},${i + 1},${l[0]},${l[1]},${l[2]},${o[7] ? o[7][i] : null})`;
}

/* ---------- Despachos ---------- */
const DESP = [
 ['DSP-0412','4500123','C01','10-11-2026','11-11-2026','11-11-2026',1000,1000,950,'Producto dañado en tránsito','Recibido con diferencia'],
 ['DSP-0415','MS-20931','C03','15-11-2026','17-11-2026','18-11-2026',384,336,336,'Stock insuficiente Super Chunk (48 un pendiente)','Parcial 1/2'],
 ['DSP-0416','PC-1145','C04','14-11-2026','15-11-2026','15-11-2026',800,800,800,'','Recibido OK'],
 ['DSP-0417','OC-88377','C02',null,null,'14-11-2026',2160,0,0,'Fuera de fecha compromiso','En preparación'],
 ['DSP-0405','4500119','C01','03-11-2026','04-11-2026','04-11-2026',6720,6720,6720,'','Recibido OK'],
 ['DSP-0401','MS-20902','C03','30-10-2026','02-11-2026','31-10-2026',240,216,216,'Atraso transportista + 24 un faltante','Recibido con diferencia'],
 ['DSP-0399','OC-88301','C02','28-10-2026','29-10-2026','29-10-2026',528,528,528,'','Recibido OK']
];
for (const d of DESP) await sql`insert into dispatches(id,po_number,client_id,shipped,delivered,committed,requested,dispatched,accepted,reason,status)
  values (${d[0]},${d[1]},${d[2]},${d[3] && iso(d[3])},${d[4] && iso(d[4])},${iso(d[5])},${d[6]},${d[7]},${d[8]},${d[9]},${d[10]})`;

/* ---------- Facturas, NC y pagos ---------- */
const INVS = [ // folio,dte,cli,emisión,neto,venc,oc,desp,ref, pagos[[fecha,monto]]
 [1035,33,'C01','05-09-2026',16100000,'04-11-2026',['4500102'],['DSP-0350'],null,'full:02-11-2026'],
 [1036,33,'C02','10-09-2026',9100000,'25-10-2026',['OC-88190'],['DSP-0355'],null,'full:24-10-2026'],
 [1037,33,'C04','15-09-2026',1900000,'15-10-2026',['PC-1120'],['DSP-0358'],null,'full:14-10-2026'],
 [1038,33,'C03','20-09-2026',3150000,'20-10-2026',['MS-20855'],['DSP-0362'],null,null],
 [1041,33,'C02','01-10-2026',9480000,'15-11-2026',['OC-88210'],['DSP-0371','DSP-0374'],null,[['20-10-2026',4000000]]],
 [1042,33,'C01','08-10-2026',15200000,'07-12-2026',['4500108'],['DSP-0376'],null,'full:16-11-2026'],
 [1043,33,'C04','12-10-2026',2000000,'11-11-2026',['PC-1131'],['DSP-0379'],null,'full:10-11-2026'],
 [1044,33,'C01','20-10-2026',14900000,'19-12-2026',['4500113'],['DSP-0384'],null,null],
 [1045,33,'C03','24-10-2026',3400000,'23-11-2026',['MS-20888'],['DSP-0390'],null,null],
 [1046,33,'C02','29-10-2026',8232000,'13-12-2026',['OC-88301'],['DSP-0399'],null,'full:12-11-2026'],
 [1047,33,'C03','02-11-2026',2959200,'02-12-2026',['MS-20902'],['DSP-0401'],null,null],
 [1048,33,'C04','30-10-2026',2200000,'29-11-2026',['PC-1136'],['DSP-0396'],null,'full:17-11-2026'],
 [1049,33,'C01','04-11-2026',16732800,'03-01-2027',['4500119'],['DSP-0405'],null,[['12-11-2026',5000000]]],
 [1050,33,'C03','17-11-2026',4456320,'17-12-2026',['MS-20931'],['DSP-0415'],null,null],
 [1051,33,'C01','11-11-2026',13205000,'10-01-2027',['4500123'],['DSP-0412'],null,null],
 [212,61,'C01','12-11-2026',-695000,null,['4500123'],[],1051,null],
 [1052,33,'C04','15-11-2026',2101600,'15-12-2026',['PC-1145'],['DSP-0416'],null,null]
];
for (const f of INVS) {
  const iva = Math.round(f[4] * 0.19), tot = f[4] + iva;
  const [{ id }] = await sql`insert into invoices(folio,dte,client_id,issued,due,net,iva,total,ref_folio,po_numbers,dispatch_ids,created_by)
    values (${f[0]},${f[1]},${f[2]},${iso(f[3])},${f[5] && iso(f[5])},${f[4]},${iva},${tot},${f[8]},${f[6]},${f[7]},'marcelo') returning id`;
  const pays = typeof f[9] === 'string' ? [[f[9].slice(5), tot]] : f[9] || [];
  for (const p of pays) await sql`insert into payments(invoice_id,paid_at,amount,method,created_by) values (${id},${iso(p[0])},${p[1]},'Transferencia','marcelo')`;
}

/* ---------- Compras / gastos con IVA (crédito fiscal) ---------- */
const PUR = [
 ['ROVAL Logística','76.555.444-3',88120,33,'30-09-2026','Almacenaje ROVAL',1520000],
 ['Transportes Sur','77.888.111-2',5531,33,'30-09-2026','Flete y distribución',1810000],
 ['Agencia Trade Mkt','76.222.999-1',301,33,'15-09-2026','Marketing y trade',1150000],
 ['Aduana · DIN importación','—',91402,914,'22-09-2026','Importación mercadería',24800000],
 ['ROVAL Logística','76.555.444-3',88544,33,'31-10-2026','Almacenaje ROVAL',1580000],
 ['Transportes Sur','77.888.111-2',5602,33,'31-10-2026','Flete y distribución',1920000],
 ['Agencia Trade Mkt','76.222.999-1',318,33,'15-10-2026','Marketing y trade',1200000],
 ['Software y servicios','76.333.222-8',1201,33,'05-10-2026','Servicios y software',600000],
 ['Aduana · DIN importación','—',93177,914,'19-10-2026','Importación mercadería',31200000],
 ['ROVAL Logística','76.555.444-3',89011,33,'15-11-2026','Almacenaje ROVAL',800000],
 ['Transportes Sur','77.888.111-2',5671,33,'15-11-2026','Flete y distribución',950000],
 ['Software y servicios','76.333.222-8',1244,33,'05-11-2026','Servicios y software',600000]
];
for (const p of PUR) { const iva = Math.round(p[6] * 0.19);
  await sql`insert into purchases(supplier,supplier_rut,folio,dte,issued,category,net,iva,total,paid) values (${p[0]},${p[1]},${p[2]},${p[3]},${iso(p[4])},${p[5]},${p[6]},${iva},${p[6] + iva},${!p[4].includes('-11-')})`; }

/* ---------- Stock ROVAL (carga #47) ---------- */
const STOCK = [
 ['MIN-ADU-4K',3840,1120,4800,'2027-01-12',{'2027-04':4800,'2027-07':4800,'2027-09':4800}],
 ['PM-SCH-15K',620,340,0,null,{'2027-02':2400,'2027-05':1440,'2027-08':1440,'2027-11':1440}],
 ['PM-CRT-120',18400,2400,0,null,{'2027-02':17280,'2027-05':17280,'2027-08':17280,'2027-11':17280}],
 ['PM-CRB-500',9600,1800,11520,'2027-01-15',{'2027-04':11520,'2027-07':11520,'2027-10':11520}],
 ['PM-BAL-3K',2650,600,0,null,{'2027-02':4608,'2027-05':3456,'2027-08':3456,'2027-11':3456}]
];
for (const s of STOCK) await sql`insert into stock(sku,assigned,reserved,transit,eta,plan) values (${s[0]},${s[1]},${s[2]},${s[3]},${s[4]},${JSON.stringify(s[5])})`;
await sql`insert into stock_loads(cutoff,file_name,status,created_by) values
 ('2026-10-25 18:00-03','Inventario_ROVAL_2510.xlsx','Rechazada · negativos','marcelo'),
 ('2026-11-01 18:00-03','Inventario_ROVAL_0111.xlsx','Histórica','marcelo'),
 ('2026-11-08 18:00-03','Inventario_ROVAL_0811.xlsx','Histórica','marcelo'),
 ('2026-11-15 18:00-03','Inventario_ROVAL_1511.xlsx','Publicada · 1 en conciliación','marcelo')`;

/* ---------- Forecast ---------- */
const FCB = [['C01','MIN-ADU-4K',820],['C01','PM-CRT-120',2600],['C01','PM-CRB-500',1500],['C01','PM-SCH-15K',150],['C02','MIN-ADU-4K',420],['C02','PM-BAL-3K',520],['C02','PM-CRT-120',1400],['C02','PM-CRB-500',1500],['C03','PM-SCH-15K',180],['C03','PM-BAL-3K',380],['C03','MIN-ADU-4K',230],['C04','PM-CRT-120',1200],['C04','PM-CRB-500',900],['C04','MIN-ADU-4K',180],['C04','PM-BAL-3K',200],['C04','PM-SCH-15K',80]];
const SEAS = [1.18, .92, .9, .97, 1, 1.02, .98, 1.04, 1.06, 1.03, 1.08, 1.1];
await sql`insert into forecast_versions(version,status,frozen_at) values ('v1','enviada','2026-10-01'),('v2','enviada','2026-11-01'),('v3','borrador',null)`;
for (const [c, s, b] of FCB) {
  const m3 = SEAS.map((k, i) => Math.round(b * k * (1 + i * .006) / 10) * 10);
  const m2 = m3.map(v => Math.round(v * .95 / 10) * 10), m1 = m3.map(v => Math.round(v * .9 / 10) * 10);
  await sql`insert into forecast_lines(version,client_id,sku,m) values ('v3',${c},${s},${m3}),('v2',${c},${s},${m2}),('v1',${c},${s},${m1})`;
}

/* ---------- Ventas mensuales (24 meses) ---------- */
const SALES = [38.2,34.9,36.4,41.8,44.3,42.9,47.6,51.2,49.8,54.1,57.9,49.6];
const MARGIN = [31.0,30.4,31.8,30.9,32.4,32.0,33.1,32.7,33.6,33.0,34.2,33.8];
const SHARE = { C01: .43, C02: .26, C03: .18, C04: .13 };
const MOFF = { C01: -2.6, C02: .2, C03: 2.0, C04: 3.3 };
for (let i = 0; i < 24; i++) {
  const d = new Date(Date.UTC(2024, 11 + i, 1)), k = i % 12, yr = i < 12 ? .91 : 1;
  for (const c in SHARE) {
    if (c === 'C04' && i < 4) continue; // PetCenter comenzó en abril 2025
    const net = Math.round(SALES[k] * yr * SHARE[c] * (1 + Math.sin(i * 1.7 + c.charCodeAt(2)) * .05) * 1e6);
    const mg = (MARGIN[k] - (i < 12 ? 1.1 : 0) + MOFF[c]) / 100;
    await sql`insert into sales_monthly(month,client_id,net,cost) values (${d.toISOString().slice(0, 10)},${c},${net},${Math.round(net * (1 - mg))})`;
  }
}

/* ---------- Configuración (CRM, servicio, parámetros) ---------- */
const CFG = {
  pipeline: [
    { st: 'prospecto', items: [{ n: 'Súper Austral', v: '$4,2 MM/mes', o: 'kevin', d: 'Primer contacto LinkedIn' }, { n: 'Comercial Norte', v: '$2,8 MM/mes', o: 'kevin', d: 'Referido por PetCenter' }] },
    { st: 'contactado', items: [{ n: 'MaxiAhorro', v: '$6,5 MM/mes', o: 'marcelo', d: 'Enviar ficha Minino' }] },
    { st: 'reunión', items: [{ n: 'Mascotalandia', v: '$3,1 MM/mes', o: 'kevin', d: 'Reunión 21 nov · 10:00' }] },
    { st: 'negociación', items: [{ n: 'Red Vet Chile', v: '$5,0 MM/mes', o: 'marcelo', d: 'Contrapropuesta plazo 45 d' }] },
    { st: 'aprobado', items: [{ n: 'Distribuidora Pacífico', v: '$3,6 MM/mes', o: 'marcelo', d: 'Codificación de 2 SKU' }] },
    { st: 'activo', items: [{ n: 'Supermercados Mass', v: '$21,4 MM/mes', o: 'kevin', d: 'OC semanal' }, { n: 'Hiper Andino', v: '$12,8 MM/mes', o: 'kevin', d: '' }, { n: 'Mercado del Sur', v: '$8,9 MM/mes', o: 'marcelo', d: '' }, { n: 'PetCenter Express', v: '$6,2 MM/mes', o: 'kevin', d: '' }] }
  ],
  activities: [['21-11-2026 10:00','Reunión','Mascotalandia','Presentación portafolio Minino + PetMetro','kevin','Programada'],['20-11-2026','Tarea','Red Vet Chile','Enviar contrapropuesta plazo 45 días','marcelo','Pendiente'],['19-11-2026','Llamada','Supermercados Mass','Confirmar faltante OC 4500123 y NC','kevin','Pendiente'],['18-11-2026','Email','Distribuidora Pacífico','Ficha de codificación EAN/DUN','marcelo','Hecha'],['15-11-2026','Visita','Hiper Andino','Revisión de góndola CD Quilicura','kevin','Hecha']],
  service: { months: ['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11'], fill: [93.1,94.0,92.6,95.2,94.8,96.0,95.5,94.1,96.3,95.9,96.6,95.2], otif: [84,86,83,88,87,90,89,86,91,90,92,89] },
  forecast_start: '2026-12',
  params: { moneda: 'CLP', zona: 'America/Santiago', iva: 19, tolerancia_otif: 0, meta_fill: 95, max_edad_stock_dias: 2, sesion_horas: 8 }
};
for (const [k, v] of Object.entries(CFG)) await sql`insert into app_config(key,value) values (${k},${JSON.stringify(v)})`;

const AUD = [
 ['2026-11-08 09:15-03','marcelo','NC 212','Nota de crédito registrada (50 un dañadas OC 4500123)'],
 ['2026-11-12 12:10-03','marcelo','Pago F1049','Abono $5.000.000 · transferencia'],
 ['2026-11-15 10:02-03','kevin','Forecast v3','Edición 14 celdas · Mass, PetCenter'],
 ['2026-11-15 18:31-03','marcelo','Inventario ROVAL','Carga #4 · 5 SKU OK · 1 SKU en conciliación (RV-99812)'],
 ['2026-11-16 16:48-03','marcelo','OC OC-88412','Aprobada tras validación humana'],
 ['2026-11-17 11:20-03','marcelo','Tarifa MIN-ADU-4K · Hiper Andino','$13.900 → $14.100 vigente desde 01-11-2026'],
 ['2026-11-17 18:05-03','marcelo','Factura 1050','Registrada SII · asociada a DSP-0415'],
 ['2026-11-18 09:42-03','kevin','OC 4500128','Ingresada · 3 líneas · pendiente de validación']
];
for (const a of AUD) await sql`insert into audit_log(at,user_id,record,detail) values (${a[0]},${a[1]},${a[2]},${a[3]})`;

const out = process.env.CREDS_OUT;
if (out) { fs.writeFileSync(out, JSON.stringify(creds, null, 2), { mode: 0o600 }); console.log('Credenciales iniciales escritas en', out); }
else console.log('Credenciales iniciales (cámbialas al ingresar):', creds);
console.log('Seed OK');
