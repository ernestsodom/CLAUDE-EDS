import { sql } from '../lib/db.js';
import { currentUser, makeToken, sessionCookie } from '../lib/auth.js';
import { MODS, can } from '../lib/perms.js';


export default async function handler(req, res) {
  const me = await currentUser(req, sql);
  if (!me) return res.status(401).json({ error: 'Sesión expirada' });
  res.setHeader('Set-Cookie', sessionCookie(makeToken(me.id)));
  res.setHeader('Cache-Control', 'no-store');

  const isAdm = can(me, 'admin', 'ver');
  const [users, clients, products, cprices, pos, lines, desp, invs, pays, purch, stock, loads, fcv, fcl, sales, audit, cfg, roles, opps, acts, sups, sos, sol, imgs, apprs, mails] = await Promise.all([
    sql`select u.id, u.name, u.img, u.email, u.role_id, u.active, coalesce(r.name, u.role) as role, to_char(u.last_login at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') last_login from users u left join roles r on r.id = u.role_id order by u.active desc, u.name`,
    sql`select id, name, rut, com, term, cds, stage, owner, contact, phone, mail, price_mode, rooms from clients order by com`,
    sql`select sku, name, brand, cat, ean, dun, grams, ucj, cjp, cost, price, img, lead_days, moq, mult, ss, supplier, active, upd, dpb from products order by active desc, sku`,
    sql`select client_id, sku, price, to_char(valid_from,'DD-MM-YYYY') as from_d, valid_from, created_by from client_prices order by client_id, sku, valid_from desc, id desc`,
    sql`select id, number, client_id, to_char(issued,'DD-MM-YYYY') f, to_char(requested,'DD-MM-YYYY') req, cd, status, ai, reason from purchase_orders order by issued desc, id desc`,
    sql`select po_id, line, sku, qty, price::float as price, accepted, boxes::float as boxes from po_lines order by po_id, line`,
    sql`select id, po_number, client_id, to_char(shipped,'DD-MM-YYYY') f, to_char(delivered,'DD-MM-YYYY') ent, to_char(committed,'DD-MM-YYYY') comp, requested, dispatched, accepted, reason, status from dispatches order by committed desc, id desc`,
    sql`select id, folio, dte, client_id, to_char(issued,'DD-MM-YYYY') f, to_char(due,'DD-MM-YYYY') v, net, iva, total, ref_folio, po_numbers, dispatch_ids from invoices order by issued desc, folio desc`,
    sql`select id, invoice_id, to_char(paid_at,'DD-MM-YYYY') f, amount, method from payments order by paid_at`,
    can(me, 'finanzas', 'ver') ? sql`select id, supplier, supplier_rut, folio, dte, to_char(issued,'DD-MM-YYYY') f, to_char(issued,'YYYY-MM') m, to_char(due,'DD-MM-YYYY') v, supplier_id, category, net, iva, total, paid from purchases order by issued desc` : Promise.resolve([]),
    sql`select sku, assigned, reserved, transit, to_char(eta,'DD-MM-YYYY') eta, plan from stock`,
    sql`select load_no, to_char(cutoff at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') cutoff, cutoff as cutoff_ts, file_name, status, created_by from stock_loads order by load_no desc limit 12`,
    sql`select version, status, to_char(frozen_at,'DD-MM-YYYY') frozen from forecast_versions order by version`,
    sql`select version, client_id, sku, m from forecast_lines order by client_id, sku`,
    sql`select to_char(month,'YYYY-MM') m, client_id, net, cost from sales_monthly order by month`,
    isAdm ? sql`select to_char(at at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') at, user_id, record, detail from audit_log order by id desc limit 300` : Promise.resolve([]),
    sql`select key, value from app_config`,
    sql`select id, name, description, perms, system, (select count(*)::int from users u where u.role_id = roles.id) as users from roles order by id`,
    sql`select id, name, stage, value, owner, note from crm_opportunities order by id`,
    sql`select id, to_char(at,'DD-MM-YYYY') d, time, kind, target, description, owner, status from crm_activities order by at desc, id desc`,
    sql`select id, name, rut, country, category, contact, phone, mail, term, currency, active, notes from suppliers order by name`,
    sql`select id, number, supplier_id, to_char(issued,'DD-MM-YYYY') f, to_char(eta,'DD-MM-YYYY') eta, status, currency, notes from supplier_orders order by issued desc, id desc`,
    sql`select order_id, line, sku, qty, unit_cost::float as cost from supplier_order_lines order by order_id, line`,
    sql`select id, name from images order by id desc limit 200`,
    sql`select id, doc_type, doc_id, doc_label, requested_by, to_char(requested_at at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') req_at, approver, status, decided_by, to_char(decided_at at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') dec_at, comment from approvals order by id desc limit 400`,
    sql`select doc_type, doc_id, to_addr, subject, status, error, sent_by, to_char(sent_at at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') at from emails order by id desc limit 300`
  ]);

  const byPo = {};
  for (const l of lines) (byPo[l.po_id] ||= []).push(l);
  const byInv = {};
  for (const p of pays) (byInv[p.invoice_id] ||= []).push({ id: p.id, f: p.f, amount: Number(p.amount), method: p.method });
  const fc = {};
  for (const r of fcl) (fc[r.version] ||= []).push({ c: r.client_id, s: r.sku, m: r.m });
  const st = {};
  for (const s of stock) st[s.sku] = { asg: s.assigned, res: s.reserved, tr: s.transit, eta: s.eta || '', plan: s.plan || {} };

  res.json({
    me: { id: me.id, name: me.name, img: me.img, role: me.role, perms: me.perms, fin: me.fin, admin: me.admin },
    mods: MODS,
    users: users.map(u => isAdm ? u : { id: u.id, name: u.name, img: u.img, role: u.role, active: u.active }),
    roles: isAdm ? roles : [],
    opps: opps,
    acts: acts,
    cfg: Object.fromEntries(cfg.map(r => [r.key, r.value])),
    clients: clients.map(c => ({ rooms: c.rooms, id: c.id, name: c.name, rut: c.rut, com: c.com, term: c.term, cds: c.cds, stage: c.stage, owner: c.owner, contact: c.contact, phone: c.phone, mail: c.mail, priceMode: c.price_mode })),
    skus: products.map(p => ({ sku: p.sku, name: p.name, brand: p.brand, cat: p.cat, ean: p.ean, dun: p.dun, g: p.grams, ucj: p.ucj, cjp: p.cjp, cost: me.fin ? p.cost : null, price: p.price, img: p.img, lead: p.lead_days, moq: p.moq, mult: p.mult, ss: p.ss, prov: p.supplier, active: p.active, upd: p.upd, dpb: p.dpb })),
    clientPrices: cprices.map(p => ({ cli: p.client_id, sku: p.sku, price: p.price, from: p.from_d, fromIso: p.valid_from, by: p.created_by })),
    ocs: pos.map(o => {
      const ls = byPo[o.id] || [];
      return { id: o.id, n: o.number, cli: o.client_id, f: o.f, req: o.req, cd: o.cd, st: o.status, ai: o.ai, motivo: o.reason,
        lines: ls.map(l => [l.sku, l.qty, l.price, l.line, l.boxes]), acc: ls.some(l => l.accepted != null) ? ls.map(l => l.accepted ?? 0) : null };
    }),
    desp: desp.map(d => ({ id: d.id, oc: d.po_number, cli: d.client_id, f: d.f || '—', ent: d.ent || '—', comp: d.comp, sol: d.requested, desp: d.dispatched, acc: d.accepted, mot: d.reason || '', st: d.status })),
    invs: invs.map(f => ({ id: f.id, fo: f.folio, t: f.dte, cli: f.client_id, f: f.f, v: f.v || '—', net: Number(f.net), iva: Number(f.iva), tot: Number(f.total), ref: f.ref_folio, oc: f.po_numbers, ds: f.dispatch_ids, pays: byInv[f.id] || [] })),
    purchases: purch.map(p => ({ ...p, net: Number(p.net), iva: Number(p.iva), total: Number(p.total) })),
    stock: st,
    loads: loads.map(l => ({ no: l.load_no, cutoff: l.cutoff, ts: l.cutoff_ts, file: l.file_name, st: l.status, by: l.created_by })),
    fcVersions: fcv,
    fc,
    sales: mergeSales(sales, invs, pos, lines, products).map(s => ({ ...s, cost: me.fin ? s.cost : null })),
    suppliers: sups,
    approvals: apprs,
    emails: mails,
    mailReady: !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
    sorders: sos.map(o => ({ ...o, lines: sol.filter(l => l.order_id === o.id).map(l => ({ sku: l.sku, qty: l.qty, cost: l.cost })) })),
    images: imgs.map(i => ({ id: i.id, name: i.name, url: `/api/img?id=${i.id}` })),
    audit: audit.map(a => [a.at, a.user_id, a.record, a.detail])
  });
}

/* Ventas para el dashboard: si un cliente tiene facturas en un mes, se usan las facturas reales
   (facturas − NC). Si no, se usa el histórico importado (sales_monthly). El costo de una factura se estima
   con los costos de las OC asociadas; si no tiene OC, con el margen de lista promedio. */
function mergeSales(hist, invs, pos, lines, products) {
  const cost = Object.fromEntries(products.map(p => [p.sku, p.cost]));
  const avgRatio = products.length ? products.reduce((a, p) => a + p.cost / p.price, 0) / products.length : 0.7;
  const poBy = {};
  for (const po of pos) poBy[po.client_id + '|' + po.number] = po.id;
  const lBy = {};
  for (const l of lines) (lBy[l.po_id] ||= []).push(l);
  const agg = {};
  for (const f of invs) {
    const m = f.f.split('-').reverse().slice(0, 2).join('-'), k = m + '|' + f.client_id;
    let c = 0, v = 0;
    for (const n of f.po_numbers || []) for (const l of lBy[poBy[f.client_id + '|' + n]] || []) { const q = l.accepted ?? l.qty; c += q * (cost[l.sku] || 0); v += q * l.price; }
    const ratio = v ? c / v : avgRatio;
    const a = (agg[k] ||= { m, c: f.client_id, net: 0, cost: 0 });
    a.net += Number(f.net); a.cost += Math.round(Number(f.net) * ratio);
  }
  const out = Object.values(agg);
  for (const h of hist) if (!agg[h.m + '|' + h.client_id]) out.push({ m: h.m, c: h.client_id, net: Number(h.net), cost: Number(h.cost) });
  return out.sort((a, b) => a.m.localeCompare(b.m));
}
