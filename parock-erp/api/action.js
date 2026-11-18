import { sql } from '../lib/db.js';
import { currentUser, hashPassword, verifyPassword } from '../lib/auth.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };
const int = (v, name, { min = -Infinity, max = Infinity } = {}) => {
  const n = Number(String(v).replace(/[^\d-]/g, ''));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) fail(400, `Valor inválido: ${name}`);
  return n;
};
const date = (v, name) => {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  fail(400, `Fecha inválida: ${name}`);
};
const txt = (v, name, max = 200) => {
  const s = String(v ?? '').trim();
  if (!s) fail(400, `Falta: ${name}`);
  return s.slice(0, max);
};
const clp = n => '$' + Number(n).toLocaleString('es-CL');
const audit = (u, record, detail) => sql`insert into audit_log(user_id, record, detail) values (${u.id}, ${record}, ${detail})`;

const ACTIONS = {
  /* ---------- Órdenes de compra ---------- */
  async createOC(u, b) {
    const client = txt(b.client, 'cliente', 10), number = txt(b.number, 'N° OC', 40);
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length || lines.length > 100) fail(400, 'La OC necesita al menos una línea');
    const skus = new Set((await sql`select sku from products where active`).map(r => r.sku));
    const ls = lines.map((l, i) => {
      if (!skus.has(l.sku)) fail(400, `SKU desconocido en línea ${i + 1}`);
      return { sku: l.sku, qty: int(l.qty, 'unidades', { min: 1, max: 1e7 }), price: int(l.price, 'precio', { min: 1, max: 1e8 }) };
    });
    const dup = await sql`select 1 from purchase_orders where client_id = ${client} and number = ${number}`;
    if (dup.length) fail(409, `La OC ${number} ya existe para este cliente. No se registró un duplicado.`);
    const [{ id }] = await sql`insert into purchase_orders(number, client_id, issued, requested, cd, status, created_by)
      values (${number}, ${client}, ${date(b.issued, 'emisión')}, ${date(b.requested, 'fecha solicitada')}, ${txt(b.cd, 'CD', 80)}, 'pendiente validación', ${u.id}) returning id`;
    await sql.transaction(ls.map((l, i) => sql`insert into po_lines(po_id, line, sku, qty, price) values (${id}, ${i + 1}, ${l.sku}, ${l.qty}, ${l.price})`));
    await audit(u, `OC ${number}`, `Ingresada · ${ls.length} líneas · pendiente de validación`);
    return { id };
  },

  async approveOC(u, b) {
    const id = int(b.id, 'OC', { min: 1 });
    const [po] = await sql`select id, number, status from purchase_orders where id = ${id}`;
    if (!po) fail(404, 'OC no encontrada');
    if (!['pendiente validación', 'borrador'].includes(po.status)) fail(409, `La OC ya está en estado "${po.status}"`);
    const edits = Array.isArray(b.lines) ? b.lines : [];
    const q = [];
    for (const e of edits) q.push(sql`update po_lines set qty = ${int(e.qty, 'unidades', { min: 1 })}, price = ${int(e.price, 'precio', { min: 1 })} where po_id = ${id} and line = ${int(e.line, 'línea', { min: 1 })}`);
    if (b.cd) q.push(sql`update purchase_orders set cd = ${txt(b.cd, 'CD', 80)} where id = ${id}`);
    if (q.length) await sql.transaction(q);
    // Reservar solo stock disponible confirmado
    const ls = await sql`select l.sku, l.qty, s.assigned - s.reserved as disp from po_lines l left join stock s on s.sku = l.sku where l.po_id = ${id}`;
    const short = ls.filter(l => (l.disp ?? 0) < l.qty).map(l => `${l.sku} (${l.disp ?? 0}/${l.qty})`);
    await sql.transaction([
      sql`update purchase_orders set status = 'aprobada', approved_by = ${u.id}, approved_at = now(), updated_at = now() where id = ${id}`,
      ...ls.map(l => sql`update stock set reserved = reserved + ${Math.max(0, Math.min(l.qty, l.disp ?? 0))}, updated_at = now() where sku = ${l.sku}`)
    ]);
    await audit(u, `OC ${po.number}`, `Aprobada tras validación humana${edits.length ? ` · ${edits.length} líneas revisadas` : ''}${short.length ? ` · reserva parcial: ${short.join(', ')}` : ' · stock reservado'}`);
    return { short };
  },

  async cancelOC(u, b) {
    const id = int(b.id, 'OC', { min: 1 });
    const [po] = await sql`select number, status from purchase_orders where id = ${id}`;
    if (!po) fail(404, 'OC no encontrada');
    if (!['pendiente validación', 'borrador'].includes(po.status)) fail(409, 'Solo se pueden cancelar OC no aprobadas');
    await sql`update purchase_orders set status = 'cancelada', reason = ${String(b.reason || 'Cancelada').slice(0, 200)}, updated_at = now() where id = ${id}`;
    await audit(u, `OC ${po.number}`, 'Cancelada');
    return {};
  },

  /* ---------- Listas de precio por cliente ---------- */
  async setPriceMode(u, b) {
    const mode = b.mode === 'especial' ? 'especial' : 'regular';
    const [c] = await sql`update clients set price_mode = ${mode}, updated_at = now() where id = ${txt(b.client, 'cliente', 10)} returning com`;
    if (!c) fail(404, 'Cliente no encontrado');
    await audit(u, `Lista de precios · ${c.com}`, mode === 'especial' ? 'Asignada lista diferenciada' : 'Asignada lista regular');
    return {};
  },

  async savePrices(u, b) {
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

  /* ---------- Forecast ---------- */
  async fcCell(u, b) {
    const version = txt(b.version, 'versión', 10), idx = int(b.idx, 'mes', { min: 0, max: 11 }), v = int(b.value, 'unidades', { min: 0, max: 1e8 });
    const [ver] = await sql`select status from forecast_versions where version = ${version}`;
    if (!ver) fail(404, 'Versión no encontrada');
    if (ver.status !== 'borrador') fail(409, 'La versión está congelada');
    const r = await sql`update forecast_lines set m[${idx + 1}] = ${v}, updated_at = now() where version = ${version} and client_id = ${txt(b.client, 'cliente', 10)} and sku = ${txt(b.sku, 'SKU', 40)} returning 1`;
    if (!r.length) fail(404, 'Celda no encontrada');
    await audit(u, `Forecast ${version}`, `${b.client} · ${b.sku} · mes ${idx + 1} = ${v.toLocaleString('es-CL')} un`);
    return {};
  },

  async freezeForecast(u, b) {
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

  /* ---------- Facturas y pagos (permiso financiero) ---------- */
  async registerInvoice(u, b) {
    if (!u.fin) fail(403, 'Requiere permiso financiero');
    const folio = int(b.folio, 'folio', { min: 1 }), dte = int(b.dte, 'tipo DTE', { min: 33, max: 61 });
    if (![33, 34, 56, 61].includes(dte)) fail(400, 'Tipo DTE no soportado');
    let net = int(b.net, 'neto', { min: 1, max: 1e11 });
    if (dte === 61) net = -net;
    const iva = dte === 34 ? 0 : Math.round(net * 0.19);
    const dup = await sql`select 1 from invoices where folio = ${folio} and dte = ${dte} and issuer_rut = '77.000.000-0'`;
    if (dup.length) fail(409, `El folio ${folio} (DTE ${dte}) ya está registrado`);
    const ocs = String(b.po || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
    const ds = String(b.ds || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
    await sql`insert into invoices(folio, dte, client_id, issued, due, net, iva, total, ref_folio, po_numbers, dispatch_ids, created_by)
      values (${folio}, ${dte}, ${txt(b.client, 'cliente', 10)}, ${date(b.issued, 'emisión')}, ${dte === 61 ? null : date(b.due, 'vencimiento')}, ${net}, ${iva}, ${net + iva},
      ${b.ref ? int(b.ref, 'folio referencia', { min: 1 }) : null}, ${ocs}, ${ds}, ${u.id})`;
    await audit(u, `${dte === 61 ? 'NC' : 'Factura'} ${folio}`, `Registrada (emitida en SII) · neto ${clp(net)}${ocs.length ? ' · OC ' + ocs.join(', ') : ''}`);
    return {};
  },

  async registerPayment(u, b) {
    if (!u.fin) fail(403, 'Requiere permiso financiero');
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
    if (!u.admin && !u.fin) fail(403, 'Tu rol no puede cargar inventario');
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
    const fn = ACTIONS[b.type];
    if (!fn) return res.status(400).json({ error: 'Acción desconocida' });
    res.json({ ok: true, ...(await fn(u, b)) });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
}
