import crypto from 'node:crypto';
import { sql } from '../lib/db.js';
import { currentUser, hashPassword, verifyPassword } from '../lib/auth.js';
import { can, cleanPerms } from '../lib/perms.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };
const need = (u, mod, act) => { if (!can(u, mod, act)) fail(403, `Tu rol no tiene permiso para ${act} en ${mod}`); };
const int = (v, name, { min = -Infinity, max = Infinity } = {}) => {
  const n = Number(String(v).replace(/[^\d-]/g, ''));
  if (String(v ?? '').trim() === '' || !Number.isInteger(n) || n < min || n > max) fail(400, `Valor inválido: ${name}`);
  return n;
};
const date = (v, name) => {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  fail(400, `Fecha inválida: ${name}`);
};
const txt = (v, name, max = 200) => {
  const s = String(v ?? '').trim();
  if (!s) fail(400, `Falta: ${name}`);
  return s.slice(0, max);
};
const clp = n => '$' + Number(n).toLocaleString('es-CL');
const audit = (u, record, detail) => sql`insert into audit_log(user_id, record, detail) values (${u.id}, ${record}, ${String(detail).slice(0, 900)})`;
const genPass = () => crypto.randomBytes(9).toString('base64url');

/* =========================================================
   ENTIDADES GENÉRICAS (crear / editar / eliminar)
   t: text | int | date | bool | list | json | enum
   ========================================================= */
const ENT = {
  client: { table: 'clients', pk: 'id', mod: 'crm', label: 'Cliente', autoId: { prefix: 'C', pad: 2 },
    fields: { name: { t: 'text', req: 1, l: 'Razón social' }, rut: { t: 'text', req: 1, l: 'RUT' }, com: { t: 'text', req: 1, l: 'Nombre comercial' },
      term: { t: 'int', l: 'Plazo de pago' }, cds: { t: 'list', l: 'CD / sucursales' },
      stage: { t: 'enum', opts: ['prospecto', 'contactado', 'reunión', 'negociación', 'aprobado', 'activo', 'inactivo'], l: 'Etapa' },
      owner: { t: 'text', l: 'Responsable' }, contact: { t: 'text', l: 'Contacto' }, phone: { t: 'text', l: 'Teléfono' }, mail: { t: 'text', l: 'Email' } } },
  product: { table: 'products', pk: 'sku', pkInput: true, mod: 'productos', label: 'SKU',
    fields: { name: { t: 'text', req: 1 }, brand: { t: 'text', req: 1 }, cat: { t: 'text', req: 1 }, ean: { t: 'text' }, dun: { t: 'text' }, grams: { t: 'text' },
      ucj: { t: 'int' }, cjp: { t: 'int' }, cost: { t: 'int', req: 1, perm: ['costos', 'editar'] }, price: { t: 'int', req: 1, perm: ['precios', 'editar'] },
      img: { t: 'text' }, lead_days: { t: 'int' }, moq: { t: 'int' }, mult: { t: 'int' }, ss: { t: 'int' }, supplier: { t: 'text' }, active: { t: 'bool' } },
    after: async (id, isNew) => { if (isNew) await sql`insert into stock(sku, assigned, reserved) values (${id}, 0, 0) on conflict do nothing`; },
    beforeDelete: async id => { await sql`delete from stock where sku = ${id} and assigned = 0 and reserved = 0 and transit = 0`; } },
  dispatch: { table: 'dispatches', pk: 'id', mod: 'despachos', label: 'Despacho', autoId: { prefix: 'DSP-', pad: 4 },
    fields: { po_number: { t: 'text', req: 1 }, client_id: { t: 'text', req: 1 }, shipped: { t: 'date' }, delivered: { t: 'date' }, committed: { t: 'date', req: 1 },
      requested: { t: 'int', req: 1 }, dispatched: { t: 'int' }, accepted: { t: 'int' }, reason: { t: 'text' },
      status: { t: 'enum', req: 1, opts: ['En preparación', 'Despachado', 'Recibido OK', 'Recibido con diferencia', 'Parcial 1/2', 'Rechazado'] } } },
  purchase: { table: 'purchases', pk: 'id', serial: 1, mod: 'finanzas', label: 'Gasto/compra',
    fields: { supplier: { t: 'text', req: 1 }, supplier_rut: { t: 'text' }, folio: { t: 'int' }, dte: { t: 'int', req: 1 }, issued: { t: 'date', req: 1 }, due: { t: 'date' },
      category: { t: 'text', req: 1 }, net: { t: 'int', req: 1 }, iva: { t: 'int' }, total: { t: 'int' }, paid: { t: 'bool' } },
    compute: v => { if (v.net != null) { if (v.iva == null) v.iva = Math.round(v.net * 0.19); v.total = v.net + v.iva; } } },
  opportunity: { table: 'crm_opportunities', pk: 'id', serial: 1, mod: 'crm', label: 'Oportunidad',
    fields: { name: { t: 'text', req: 1 }, stage: { t: 'enum', req: 1, opts: ['prospecto', 'contactado', 'reunión', 'negociación', 'aprobado', 'activo', 'perdido'] }, value: { t: 'text' }, owner: { t: 'text' }, note: { t: 'text' } } },
  activity: { table: 'crm_activities', pk: 'id', serial: 1, mod: 'crm', label: 'Actividad',
    fields: { at: { t: 'date', req: 1 }, time: { t: 'text' }, kind: { t: 'enum', req: 1, opts: ['Reunión', 'Llamada', 'Email', 'Visita', 'Tarea'] }, target: { t: 'text', req: 1 },
      description: { t: 'text' }, owner: { t: 'text' }, status: { t: 'enum', req: 1, opts: ['Pendiente', 'Programada', 'Hecha', 'Cancelada'] } } },
  invoice: { table: 'invoices', pk: 'id', serial: 1, mod: 'facturas', label: 'Documento',
    fields: { folio: { t: 'int', req: 1 }, dte: { t: 'int', req: 1 }, client_id: { t: 'text', req: 1 }, issued: { t: 'date', req: 1 }, due: { t: 'date' },
      net: { t: 'int', req: 1 }, ref_folio: { t: 'int' }, po_numbers: { t: 'list' }, dispatch_ids: { t: 'list' } },
    compute: v => { if (v.net != null && v.dte != null) { if (v.dte === 61) v.net = -Math.abs(v.net); v.iva = v.dte === 34 ? 0 : Math.round(v.net * 0.19); v.total = v.net + v.iva; } },
    extra: { iva: 1, total: 1 },
    beforeDelete: async id => { const p = await sql`select 1 from payments where invoice_id = ${id} limit 1`; if (p.length) fail(409, 'La factura tiene pagos registrados. Elimina primero los pagos.'); } },
  payment: { table: 'payments', pk: 'id', serial: 1, mod: 'facturas', label: 'Pago', noCreate: 1,
    fields: { paid_at: { t: 'date', req: 1 }, amount: { t: 'int', req: 1 }, method: { t: 'text' } } },
  stock: { table: 'stock', pk: 'sku', mod: 'inventario', label: 'Stock', noCreate: 1, noDelete: 1,
    fields: { assigned: { t: 'int', req: 1 }, reserved: { t: 'int', req: 1 }, transit: { t: 'int' }, eta: { t: 'date' }, plan: { t: 'json' } } }
};

function parseField(f, v, name) {
  const empty = v == null || String(v).trim() === '';
  if (empty) { if (f.req) fail(400, `Falta: ${f.l || name}`); return f.t === 'list' ? [] : f.t === 'bool' ? false : f.t === 'json' ? {} : null; }
  switch (f.t) {
    case 'int': return int(v, f.l || name, { min: -1e12, max: 1e12 });
    case 'date': return date(v, f.l || name);
    case 'bool': return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
    case 'list': return (Array.isArray(v) ? v : String(v).split(',')).map(s => String(s).trim()).filter(Boolean).slice(0, 50);
    case 'json': { const o = typeof v === 'string' ? JSON.parse(v) : v; if (typeof o !== 'object' || Array.isArray(o)) fail(400, `Formato inválido: ${name}`); return o; }
    case 'enum': { const s = String(v).trim(); if (f.opts && !f.opts.includes(s)) fail(400, `Valor no permitido en ${f.l || name}`); return s; }
    default: return String(v).trim().slice(0, 500);
  }
}
const dbErr = e => {
  if (e?.code === '23505') fail(409, 'Ya existe un registro con ese identificador o folio.');
  if (e?.code === '23503') fail(409, 'No se puede eliminar: tiene registros asociados. Elimina o reasigna primero esos registros (o desactívalo).');
  throw e;
};

async function save(u, b) {
  const E = ENT[b.entity];
  if (!E) fail(400, 'Entidad desconocida');
  const isNew = b.id == null || b.id === '';
  if (isNew && E.noCreate) fail(400, 'No se puede crear este registro aquí');
  need(u, E.mod, isNew ? 'crear' : 'editar');
  const data = b.data || {};
  const v = {};
  for (const [k, f] of Object.entries(E.fields)) {
    if (!(k in data)) continue;
    if (f.perm && !can(u, f.perm[0], f.perm[1])) continue; // campo protegido: se ignora silenciosamente
    v[k] = parseField(f, data[k], k);
  }
  if (isNew) for (const [k, f] of Object.entries(E.fields)) if (f.req && !(k in v) && !(f.perm && !can(u, ...f.perm))) fail(400, `Falta: ${f.l || k}`);
  if (E.compute) {
    if (!isNew && E.table === 'invoices') { const [cur] = await sql`select net, dte from invoices where id = ${int(b.id, 'id')}`; if (!cur) fail(404, 'No encontrado'); v.net ??= Math.abs(Number(cur.net)); v.dte ??= cur.dte; }
    E.compute(v);
  }
  const cols = Object.keys(v);
  const val = k => (E.fields[k]?.t === 'json' ? JSON.stringify(v[k]) : v[k]);
  let id = b.id;
  try {
    if (isNew) {
      if (E.pkInput) { id = txt(data[E.pk], E.pk, 40).toUpperCase(); cols.unshift(E.pk); v[E.pk] = id; }
      else if (E.autoId) {
        const { prefix, pad } = E.autoId;
        const [{ n }] = await sql(`select coalesce(max(nullif(regexp_replace(${E.pk}, '\\D', '', 'g'), '')::int), 0) + 1 as n from ${E.table} where ${E.pk} like $1`, [prefix + '%']);
        id = prefix + String(n).padStart(pad, '0'); cols.unshift(E.pk); v[E.pk] = id;
      }
      const q = `insert into ${E.table} (${cols.join(', ')}) values (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) returning ${E.pk} as id`;
      const [r] = await sql(q, cols.map(val));
      id = r.id;
    } else {
      if (!cols.length) fail(400, 'Sin cambios');
      const hasUpd = !['payments', 'stock_loads', 'purchases', 'invoices'].includes(E.table);
      const q = `update ${E.table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}${hasUpd ? ', updated_at = now()' : ''} where ${E.pk} = $${cols.length + 1} returning ${E.pk} as id`;
      const r = await sql(q, [...cols.map(val), E.serial ? int(id, 'id') : String(id)]);
      if (!r.length) fail(404, 'Registro no encontrado');
    }
  } catch (e) { if (e instanceof HttpError) throw e; dbErr(e); }
  if (E.after) await E.after(id, isNew);
  const desc = isNew ? 'Creado' : 'Editado: ' + cols.filter(c => c !== E.pk).map(c => E.fields[c]?.l || c).join(', ');
  await audit(u, `${E.label} ${data.name || data.folio || id}`, desc);
  return { id };
}

async function remove(u, b) {
  const E = ENT[b.entity];
  if (!E) fail(400, 'Entidad desconocida');
  if (E.noDelete) fail(400, 'Este registro no se puede eliminar');
  need(u, E.mod, 'eliminar');
  const id = E.serial ? int(b.id, 'id') : txt(b.id, 'id', 60);
  if (E.beforeDelete) await E.beforeDelete(id);
  try {
    const r = await sql(`delete from ${E.table} where ${E.pk} = $1 returning ${E.pk}`, [id]);
    if (!r.length) fail(404, 'Registro no encontrado');
  } catch (e) { if (e instanceof HttpError) throw e; dbErr(e); }
  await audit(u, `${E.label} ${b.name || id}`, 'Eliminado');
  return {};
}

/* =========================================================
   ÓRDENES DE COMPRA
   ========================================================= */
const RESERVING = ['aprobada', 'preparación', 'parcial'];
async function releaseReserve(poId) {
  const ls = await sql`select sku, reserved from po_lines where po_id = ${poId} and reserved > 0`;
  if (ls.length) await sql.transaction([
    ...ls.map(l => sql`update stock set reserved = greatest(0, reserved - ${l.reserved}), updated_at = now() where sku = ${l.sku}`),
    sql`update po_lines set reserved = 0 where po_id = ${poId}`
  ]);
}
async function reserve(poId) {
  const ls = await sql`select l.line, l.sku, l.qty, coalesce(s.assigned - s.reserved, 0) as disp from po_lines l left join stock s on s.sku = l.sku where l.po_id = ${poId}`;
  const short = ls.filter(l => l.disp < l.qty).map(l => `${l.sku} (${Math.max(0, l.disp)}/${l.qty})`);
  const q = [];
  for (const l of ls) { const r = Math.max(0, Math.min(l.qty, l.disp)); if (r) q.push(sql`update stock set reserved = reserved + ${r}, updated_at = now() where sku = ${l.sku}`, sql`update po_lines set reserved = ${r} where po_id = ${poId} and line = ${l.line}`); }
  if (q.length) await sql.transaction(q);
  return short;
}
async function parseLines(b) {
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > 100) fail(400, 'La OC necesita al menos una línea');
  const skus = new Set((await sql`select sku from products`).map(r => r.sku));
  return lines.map((l, i) => {
    if (!skus.has(l.sku)) fail(400, `SKU desconocido en línea ${i + 1}`);
    const acc = l.accepted == null || String(l.accepted).trim() === '' ? null : int(l.accepted, 'aceptado', { min: 0 });
    return { sku: l.sku, qty: int(l.qty, 'unidades', { min: 1, max: 1e7 }), price: int(l.price, 'precio', { min: 1, max: 1e8 }), acc };
  });
}

const ACTIONS = {
  save, remove,

  async createOC(u, b) { return ACTIONS.saveOC(u, { ...b, id: null }); },

  async saveOC(u, b) {
    const isNew = !b.id;
    need(u, 'oc', isNew ? 'crear' : 'editar');
    const client = txt(b.client, 'cliente', 10), number = txt(b.number, 'N° OC', 40);
    const ls = await parseLines(b);
    const dup = await sql`select id from purchase_orders where client_id = ${client} and number = ${number}`;
    if (dup.length && (isNew || dup[0].id !== Number(b.id))) fail(409, `La OC ${number} ya existe para este cliente. No se registró un duplicado.`);
    let id = Number(b.id), status;
    if (isNew) {
      [{ id }] = await sql`insert into purchase_orders(number, client_id, issued, requested, cd, status, reason, created_by)
        values (${number}, ${client}, ${date(b.issued, 'emisión')}, ${date(b.requested, 'fecha solicitada')}, ${txt(b.cd, 'CD', 80)}, 'pendiente validación', ${b.reason || null}, ${u.id}) returning id`;
      status = 'pendiente validación';
    } else {
      const [po] = await sql`select status from purchase_orders where id = ${id}`;
      if (!po) fail(404, 'OC no encontrada');
      if (po.status === 'cerrada') fail(409, 'Una OC cerrada no se puede editar');
      status = po.status;
      await releaseReserve(id);
      await sql`update purchase_orders set number = ${number}, client_id = ${client}, issued = ${date(b.issued, 'emisión')}, requested = ${date(b.requested, 'fecha solicitada')},
        cd = ${txt(b.cd, 'CD', 80)}, reason = ${b.reason || null}, updated_at = now() where id = ${id}`;
      await sql`delete from po_lines where po_id = ${id}`;
    }
    await sql.transaction(ls.map((l, i) => sql`insert into po_lines(po_id, line, sku, qty, price, accepted) values (${id}, ${i + 1}, ${l.sku}, ${l.qty}, ${l.price}, ${l.acc})`));
    let short = [];
    if (RESERVING.includes(status)) short = await reserve(id);
    await audit(u, `OC ${number}`, isNew ? `Ingresada · ${ls.length} líneas · pendiente de validación` : `Editada · ${ls.length} líneas`);
    return { id, short };
  },

  async approveOC(u, b) {
    need(u, 'oc', 'aprobar');
    const id = int(b.id, 'OC', { min: 1 });
    const [po] = await sql`select id, number, status from purchase_orders where id = ${id}`;
    if (!po) fail(404, 'OC no encontrada');
    if (!['pendiente validación', 'borrador'].includes(po.status)) fail(409, `La OC ya está en estado "${po.status}"`);
    const edits = Array.isArray(b.lines) ? b.lines : [];
    const q = edits.map(e => sql`update po_lines set qty = ${int(e.qty, 'unidades', { min: 1 })}, price = ${int(e.price, 'precio', { min: 1 })} where po_id = ${id} and line = ${int(e.line, 'línea', { min: 1 })}`);
    if (b.cd) q.push(sql`update purchase_orders set cd = ${txt(b.cd, 'CD', 80)} where id = ${id}`);
    if (q.length) await sql.transaction(q);
    await sql`update purchase_orders set status = 'aprobada', approved_by = ${u.id}, approved_at = now(), updated_at = now() where id = ${id}`;
    const short = await reserve(id);
    await audit(u, `OC ${po.number}`, `Aprobada tras validación humana${edits.length ? ` · ${edits.length} líneas revisadas` : ''}${short.length ? ` · reserva parcial: ${short.join(', ')}` : ' · stock reservado'}`);
    return { short };
  },

  async setOCStatus(u, b) {
    need(u, 'oc', 'editar');
    const id = int(b.id, 'OC', { min: 1 });
    const st = String(b.status || '');
    const ALLOWED = ['borrador', 'pendiente validación', 'aprobada', 'preparación', 'parcial', 'entregada', 'cerrada', 'cancelada'];
    if (!ALLOWED.includes(st)) fail(400, 'Estado inválido');
    if (st === 'aprobada') need(u, 'oc', 'aprobar');
    const [po] = await sql`select number, status from purchase_orders where id = ${id}`;
    if (!po) fail(404, 'OC no encontrada');
    const wasRes = RESERVING.includes(po.status), willRes = RESERVING.includes(st);
    if (wasRes && !willRes) await releaseReserve(id);
    await sql`update purchase_orders set status = ${st}, reason = coalesce(${b.reason || null}, reason), updated_at = now() where id = ${id}`;
    if (st === 'aprobada') await sql`update purchase_orders set approved_by = ${u.id}, approved_at = now() where id = ${id}`;
    if (!wasRes && willRes) await reserve(id);
    await audit(u, `OC ${po.number}`, `Estado: ${po.status} → ${st}${b.reason ? ' · ' + String(b.reason).slice(0, 200) : ''}`);
    return {};
  },

  async cancelOC(u, b) { return ACTIONS.setOCStatus(u, { ...b, status: 'cancelada' }); },

  async deleteOC(u, b) {
    need(u, 'oc', 'eliminar');
    const id = int(b.id, 'OC', { min: 1 });
    const [po] = await sql`select number, client_id from purchase_orders where id = ${id}`;
    if (!po) fail(404, 'OC no encontrada');
    const ds = await sql`select id from dispatches where po_number = ${po.number} and client_id = ${po.client_id} limit 1`;
    if (ds.length) fail(409, `La OC tiene despachos asociados (${ds[0].id}). Elimínalos primero o cancela la OC.`);
    const fs = await sql`select folio from invoices where ${po.number} = any(po_numbers) and client_id = ${po.client_id} limit 1`;
    if (fs.length) fail(409, `La OC está asociada a la factura ${fs[0].folio}. Cancela la OC en lugar de eliminarla.`);
    await releaseReserve(id);
    await sql`delete from purchase_orders where id = ${id}`;
    await audit(u, `OC ${po.number}`, 'Eliminada');
    return {};
  },

  /* ---------- Listas de precio por cliente ---------- */
  async setPriceMode(u, b) {
    need(u, 'precios', 'editar');
    const mode = b.mode === 'especial' ? 'especial' : 'regular';
    const [c] = await sql`update clients set price_mode = ${mode}, updated_at = now() where id = ${txt(b.client, 'cliente', 10)} returning com`;
    if (!c) fail(404, 'Cliente no encontrado');
    await audit(u, `Lista de precios · ${c.com}`, mode === 'especial' ? 'Asignada lista diferenciada' : 'Asignada lista regular');
    return {};
  },

  async savePrices(u, b) {
    need(u, 'precios', 'editar');
    const client = txt(b.client, 'cliente', 10);
    const [c] = await sql`select com, price_mode from clients where id = ${client}`;
    if (!c) fail(404, 'Cliente no encontrado');
    if (c.price_mode !== 'especial') fail(409, 'El cliente usa la lista regular. Asígnale una lista diferenciada para editar sus precios.');
    const from = date(b.validFrom, 'vigencia');
    const prices = (Array.isArray(b.prices) ? b.prices : []).map(p => ({ sku: txt(p.sku, 'SKU', 40), price: int(p.price, 'precio', { min: 1, max: 1e8 }) }));
    if (!prices.length) fail(400, 'No hay precios modificados');
    const prods = Object.fromEntries((await sql`select sku, price from products`).map(r => [r.sku, r.price]));
    const cur = await sql`select distinct on (sku) sku, price from client_prices where client_id = ${client} and valid_from <= ${from} order by sku, valid_from desc, id desc`;
    const old = Object.fromEntries(cur.map(r => [r.sku, r.price]));
    for (const p of prices) if (!(p.sku in prods)) fail(400, `SKU desconocido: ${p.sku}`);
    await sql.transaction(prices.map(p => sql`insert into client_prices(client_id, sku, price, valid_from, created_by) values (${client}, ${p.sku}, ${p.price}, ${from}, ${u.id})`));
    await sql.transaction(prices.map(p => audit(u, `Tarifa ${p.sku} · ${c.com}`, `${clp(old[p.sku] ?? prods[p.sku])} → ${clp(p.price)} vigente desde ${b.validFrom}`)));
    return {};
  },

  async deletePrice(u, b) {
    need(u, 'precios', 'editar');
    const id = int(b.id, 'id', { min: 1 });
    const [r] = await sql`delete from client_prices where id = ${id} and valid_from > current_date returning sku, client_id, price`;
    if (!r) fail(409, 'Solo se pueden eliminar precios con vigencia futura; los vigentes o pasados quedan en el historial.');
    await audit(u, `Tarifa ${r.sku} · ${r.client_id}`, `Eliminado precio futuro ${clp(r.price)}`);
    return {};
  },

  /* ---------- Forecast ---------- */
  async fcCell(u, b) {
    need(u, 'forecast', 'editar');
    const version = txt(b.version, 'versión', 10), idx = int(b.idx, 'mes', { min: 0, max: 11 }), v = int(b.value, 'unidades', { min: 0, max: 1e8 });
    const [ver] = await sql`select status from forecast_versions where version = ${version}`;
    if (!ver) fail(404, 'Versión no encontrada');
    if (ver.status !== 'borrador') fail(409, 'La versión está congelada');
    const r = await sql`update forecast_lines set m[${idx + 1}] = ${v}, updated_at = now() where version = ${version} and client_id = ${txt(b.client, 'cliente', 10)} and sku = ${txt(b.sku, 'SKU', 40)} returning 1`;
    if (!r.length) fail(404, 'Celda no encontrada');
    await audit(u, `Forecast ${version}`, `${b.client} · ${b.sku} · mes ${idx + 1} = ${v.toLocaleString('es-CL')} un`);
    return {};
  },
  async fcRow(u, b) {
    need(u, 'forecast', 'editar');
    const version = txt(b.version, 'versión', 10), client = txt(b.client, 'cliente', 10), sku = txt(b.sku, 'SKU', 40);
    const [ver] = await sql`select status from forecast_versions where version = ${version}`;
    if (!ver || ver.status !== 'borrador') fail(409, 'Solo se edita la versión en borrador');
    if (b.op === 'delete') {
      await sql`delete from forecast_lines where version = ${version} and client_id = ${client} and sku = ${sku}`;
      await audit(u, `Forecast ${version}`, `Fila eliminada · ${client} · ${sku}`);
    } else {
      try { await sql`insert into forecast_lines(version, client_id, sku, m) values (${version}, ${client}, ${sku}, ${Array(12).fill(0)})`; }
      catch (e) { dbErr(e); }
      await audit(u, `Forecast ${version}`, `Fila agregada · ${client} · ${sku}`);
    }
    return {};
  },
  async freezeForecast(u, b) {
    need(u, 'forecast', 'congelar');
    const version = txt(b.version, 'versión', 10);
    const [ver] = await sql`select status from forecast_versions where version = ${version}`;
    if (!ver || ver.status !== 'borrador') fail(409, 'Solo se congela la versión vigente en borrador');
    const [{ n }] = await sql`select coalesce(max(substring(version from 2)::int), 0) + 1 as n from forecast_versions`;
    const next = `v${n}`;
    await sql.transaction([
      sql`update forecast_versions set status = 'enviada', frozen_at = now() where version = ${version}`,
      sql`insert into forecast_versions(version, status) values (${next}, 'borrador')`,
      sql`insert into forecast_lines(version, client_id, sku, m) select ${next}, client_id, sku, m from forecast_lines where version = ${version}`
    ]);
    await audit(u, `Forecast ${version}`, `Congelada y exportada a ROVAL · nueva versión de trabajo ${next}`);
    return { next };
  },

  /* ---------- Facturas y pagos ---------- */
  async registerInvoice(u, b) {
    const dte = int(b.dte, 'tipo DTE', { min: 33, max: 61 });
    if (![33, 34, 56, 61].includes(dte)) fail(400, 'Tipo DTE no soportado');
    return save(u, { entity: 'invoice', data: { folio: b.folio, dte, client_id: b.client, issued: b.issued, due: dte === 61 ? null : b.due, net: b.net, ref_folio: b.ref || null, po_numbers: b.po, dispatch_ids: b.ds } });
  },
  async registerPayment(u, b) {
    need(u, 'facturas', 'crear');
    const id = int(b.invoiceId, 'factura', { min: 1 }), amount = int(b.amount, 'monto', { min: 1 });
    const [f] = await sql`select i.folio, i.total - coalesce((select sum(amount) from payments p where p.invoice_id = i.id), 0)
        - coalesce((select -sum(n.total) from invoices n where n.dte = 61 and n.ref_folio = i.folio), 0) as saldo
      from invoices i where i.id = ${id} and i.dte <> 61`;
    if (!f) fail(404, 'Factura no encontrada');
    if (amount > Number(f.saldo)) fail(409, `El monto supera el saldo (${clp(f.saldo)})`);
    await sql`insert into payments(invoice_id, paid_at, amount, method, created_by) values (${id}, ${date(b.date, 'fecha')}, ${amount}, ${String(b.method || 'Transferencia').slice(0, 40)}, ${u.id})`;
    await audit(u, `Pago F${f.folio}`, `${amount >= Number(f.saldo) ? 'Pago total' : 'Abono'} ${clp(amount)}`);
    return {};
  },

  /* ---------- Inventario ROVAL ---------- */
  async importStock(u, b) {
    need(u, 'inventario', 'importar');
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [];
    if (!rows.length) fail(400, 'El archivo no tiene filas');
    const cutoff = String(b.cutoff || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cutoff)) fail(400, 'Fecha de corte inválida');
    const skus = new Set((await sql`select sku from products`).map(r => r.sku));
    const res = rows.map((r, i) => {
      const sku = String(r.sku || '').trim().toUpperCase();
      const n = k => Number(String(r[k] ?? 0).replace(/[^\d-]/g, ''));
      const o = { fila: i + 2, sku, asg: n('assigned'), res: n('reserved'), tr: n('transit'), eta: r.eta ? String(r.eta).trim() : '' };
      if (!skus.has(sku)) o.result = 'conciliación';
      else if ([o.asg, o.res, o.tr].some(x => !Number.isInteger(x) || x < 0) || o.asg - o.res < 0) o.result = 'error';
      else o.result = 'ok';
      return o;
    });
    const ok = res.filter(r => r.result === 'ok');
    if (b.dryRun) return { rows: res };
    if (!ok.length) fail(400, 'Ninguna fila válida para publicar');
    const errs = res.length - ok.length;
    await sql.transaction([
      ...ok.map(r => sql`update stock set assigned = ${r.asg}, reserved = ${r.res}, transit = ${r.tr},
        eta = ${/^\d{2}-\d{2}-\d{4}$/.test(r.eta) ? r.eta.split('-').reverse().join('-') : (/^\d{4}-\d{2}-\d{2}$/.test(r.eta) ? r.eta : null)}, updated_at = now() where sku = ${r.sku}`),
      sql`insert into stock_loads(cutoff, file_name, status, rows, created_by) values (${cutoff + ':00-03'}, ${String(b.file || 'carga.xlsx').slice(0, 120)},
        ${errs ? `Publicada · ${errs} con observaciones` : 'Publicada'}, ${JSON.stringify(res)}, ${u.id})`
    ]);
    await audit(u, 'Inventario ROVAL', `Carga publicada · ${ok.length} SKU actualizados · ${res.filter(r => r.result === 'error').length} errores · ${res.filter(r => r.result === 'conciliación').length} en conciliación`);
    return { rows: res };
  },

  /* ---------- Administración: usuarios ---------- */
  async saveUser(u, b) {
    need(u, 'admin', 'editar');
    const isNew = !!b.isNew;
    const id = txt(b.id, 'usuario', 30).toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(id)) fail(400, 'El usuario debe tener 3 a 30 caracteres: letras minúsculas, números, punto, guion');
    const name = txt(b.name, 'nombre', 80), email = String(b.email || '').trim().slice(0, 120) || null;
    const roleId = int(b.role_id, 'rol', { min: 1 });
    const [role] = await sql`select id, name, perms from roles where id = ${roleId}`;
    if (!role) fail(400, 'Rol no encontrado');
    const active = b.active !== false && b.active !== 'false';
    const img = String(b.img || '').slice(0, 200) || null;
    if (isNew) {
      const pass = genPass();
      try { await sql`insert into users(id, name, role, email, role_id, img, active, pass_hash) values (${id}, ${name}, ${role.name}, ${email}, ${roleId}, ${img}, ${active}, ${hashPassword(pass)})`; }
      catch (e) { dbErr(e); }
      await audit(u, `Usuario ${id}`, `Creado · rol ${role.name}`);
      return { password: pass };
    }
    if (id === u.id && (!active || !(role.perms?.admin || []).includes('editar'))) fail(409, 'No puedes desactivarte ni quitarte el permiso de administración a ti mismo');
    const r = await sql`update users set name = ${name}, role = ${role.name}, email = ${email}, role_id = ${roleId}, img = ${img}, active = ${active}, updated_at = now() where id = ${id} returning id`;
    if (!r.length) fail(404, 'Usuario no encontrado');
    await audit(u, `Usuario ${id}`, `Editado · rol ${role.name}${active ? '' : ' · desactivado'}`);
    return {};
  },
  async resetPassword(u, b) {
    need(u, 'admin', 'editar');
    const id = txt(b.id, 'usuario', 30);
    const pass = genPass();
    const r = await sql`update users set pass_hash = ${hashPassword(pass)}, updated_at = now() where id = ${id} returning id`;
    if (!r.length) fail(404, 'Usuario no encontrado');
    await audit(u, `Usuario ${id}`, 'Contraseña restablecida por administrador');
    return { password: pass };
  },
  async deleteUser(u, b) {
    need(u, 'admin', 'editar');
    const id = txt(b.id, 'usuario', 30);
    if (id === u.id) fail(409, 'No puedes eliminar tu propio usuario');
    try { const r = await sql`delete from users where id = ${id} returning id`; if (!r.length) fail(404, 'Usuario no encontrado'); }
    catch (e) {
      if (e instanceof HttpError) throw e;
      if (e?.code === '23503') fail(409, 'El usuario tiene registros a su nombre (clientes, OC, facturas…). Desactívalo en lugar de eliminarlo.');
      throw e;
    }
    await audit(u, `Usuario ${id}`, 'Eliminado');
    return {};
  },

  /* ---------- Administración: roles ---------- */
  async saveRole(u, b) {
    need(u, 'admin', 'editar');
    const name = txt(b.name, 'nombre del rol', 60), description = String(b.description || '').slice(0, 300);
    const perms = cleanPerms(b.perms || {});
    if (b.id) {
      const id = int(b.id, 'rol', { min: 1 });
      const [r] = await sql`select system from roles where id = ${id}`;
      if (!r) fail(404, 'Rol no encontrado');
      if (r.system && !(perms.admin || []).includes('editar')) fail(409, 'El rol Administrador debe conservar el permiso de administración');
      const [mine] = await sql`select role_id from users where id = ${u.id}`;
      if (mine.role_id === id && !(perms.admin || []).includes('editar')) fail(409, 'No puedes quitar el permiso de administración a tu propio rol');
      try { await sql`update roles set name = ${name}, description = ${description}, perms = ${JSON.stringify(perms)}, updated_at = now() where id = ${id}`; } catch (e) { dbErr(e); }
      await audit(u, `Rol ${name}`, 'Permisos editados: ' + Object.entries(perms).map(([k, v]) => `${k}(${v.join('/')})`).join(', '));
      return { id };
    }
    let id;
    try { [{ id }] = await sql`insert into roles(name, description, perms) values (${name}, ${description}, ${JSON.stringify(perms)}) returning id`; } catch (e) { dbErr(e); }
    await audit(u, `Rol ${name}`, 'Creado');
    return { id };
  },
  async deleteRole(u, b) {
    need(u, 'admin', 'editar');
    const id = int(b.id, 'rol', { min: 1 });
    const [r] = await sql`select name, system, (select count(*)::int from users where role_id = ${id}) n from roles where id = ${id}`;
    if (!r) fail(404, 'Rol no encontrado');
    if (r.system) fail(409, 'El rol Administrador no se puede eliminar');
    if (r.n) fail(409, `El rol tiene ${r.n} usuario(s) asignado(s). Reasígnalos antes de eliminarlo.`);
    await sql`delete from roles where id = ${id}`;
    await audit(u, `Rol ${r.name}`, 'Eliminado');
    return {};
  },

  /* ---------- Administración: parámetros ---------- */
  async saveParams(u, b) {
    need(u, 'admin', 'editar');
    const p = b.params || {};
    const v = {
      moneda: 'CLP', zona: 'America/Santiago',
      iva: int(p.iva, 'IVA', { min: 0, max: 100 }), tolerancia_otif: int(p.tolerancia_otif, 'tolerancia OTIF', { min: 0, max: 30 }),
      meta_fill: int(p.meta_fill, 'meta Fill Rate', { min: 0, max: 100 }), max_edad_stock_dias: int(p.max_edad_stock_dias, 'antigüedad stock', { min: 0, max: 60 }),
      sesion_horas: 8
    };
    await sql`insert into app_config(key, value) values ('params', ${JSON.stringify(v)}) on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await audit(u, 'Parámetros', JSON.stringify(v));
    return {};
  },

  /* ---------- Cuenta ---------- */
  async changePassword(u, b) {
    const next = String(b.next || '');
    if (next.length < 10) fail(400, 'La nueva contraseña debe tener al menos 10 caracteres');
    const [r] = await sql`select pass_hash from users where id = ${u.id}`;
    if (!verifyPassword(String(b.current || ''), r.pass_hash)) fail(403, 'La contraseña actual no es correcta');
    await sql`update users set pass_hash = ${hashPassword(next)}, updated_at = now() where id = ${u.id}`;
    await audit(u, 'Usuario', 'Cambio de contraseña');
    return {};
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const u = await currentUser(req, sql);
    if (!u) return res.status(401).json({ error: 'Sesión expirada' });
    const b = req.body || {};
    const fn = Object.hasOwn(ACTIONS, b.type) ? ACTIONS[b.type] : null;
    if (!fn) return res.status(400).json({ error: 'Acción desconocida' });
    res.json({ ok: true, ...(await fn(u, b)) });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
}
