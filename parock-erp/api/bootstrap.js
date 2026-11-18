import { sql } from '../lib/db.js';
import { currentUser, makeToken, sessionCookie } from '../lib/auth.js';


export default async function handler(req, res) {
  const me = await currentUser(req, sql);
  if (!me) return res.status(401).json({ error: 'Sesión expirada' });
  res.setHeader('Set-Cookie', sessionCookie(makeToken(me.id)));
  res.setHeader('Cache-Control', 'no-store');

  const [users, clients, products, cprices, pos, lines, desp, invs, pays, purch, stock, loads, fcv, fcl, sales, audit, cfg] = await Promise.all([
    sql`select id, name, role, img from users where active order by id`,
    sql`select id, name, rut, com, term, cds, stage, owner, contact, phone, mail, price_mode from clients order by id`,
    sql`select sku, name, brand, cat, ean, dun, grams, ucj, cjp, cost, price, img, lead_days, moq, mult, ss, supplier from products where active order by sku`,
    sql`select client_id, sku, price, to_char(valid_from,'DD-MM-YYYY') as from_d, valid_from, created_by from client_prices order by client_id, sku, valid_from desc, id desc`,
    sql`select id, number, client_id, to_char(issued,'DD-MM-YYYY') f, to_char(requested,'DD-MM-YYYY') req, cd, status, ai, reason from purchase_orders order by issued desc, id desc`,
    sql`select po_id, line, sku, qty, price, accepted from po_lines order by po_id, line`,
    sql`select id, po_number, client_id, to_char(shipped,'DD-MM-YYYY') f, to_char(delivered,'DD-MM-YYYY') ent, to_char(committed,'DD-MM-YYYY') comp, requested, dispatched, accepted, reason, status from dispatches order by committed desc, id desc`,
    sql`select id, folio, dte, client_id, to_char(issued,'DD-MM-YYYY') f, to_char(due,'DD-MM-YYYY') v, net, iva, total, ref_folio, po_numbers, dispatch_ids from invoices order by issued desc, folio desc`,
    sql`select invoice_id, to_char(paid_at,'DD-MM-YYYY') f, amount, method from payments order by paid_at`,
    me.fin ? sql`select id, supplier, supplier_rut, folio, dte, to_char(issued,'DD-MM-YYYY') f, to_char(issued,'YYYY-MM') m, category, net, iva, total, paid from purchases order by issued desc` : Promise.resolve([]),
    sql`select sku, assigned, reserved, transit, to_char(eta,'DD-MM-YYYY') eta, plan from stock`,
    sql`select load_no, to_char(cutoff at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') cutoff, cutoff as cutoff_ts, file_name, status, created_by from stock_loads order by load_no desc limit 12`,
    sql`select version, status, to_char(frozen_at,'DD-MM-YYYY') frozen from forecast_versions order by version`,
    sql`select version, client_id, sku, m from forecast_lines order by client_id, sku`,
    sql`select to_char(month,'YYYY-MM') m, client_id, net, cost from sales_monthly order by month`,
    me.admin ? sql`select to_char(at at time zone 'America/Santiago','DD-MM-YYYY HH24:MI') at, user_id, record, detail from audit_log order by at desc limit 150` : Promise.resolve([]),
    sql`select key, value from app_config`
  ]);

  const byPo = {};
  for (const l of lines) (byPo[l.po_id] ||= []).push(l);
  const byInv = {};
  for (const p of pays) (byInv[p.invoice_id] ||= []).push({ f: p.f, amount: Number(p.amount), method: p.method });
  const fc = {};
  for (const r of fcl) (fc[r.version] ||= []).push({ c: r.client_id, s: r.sku, m: r.m });
  const st = {};
  for (const s of stock) st[s.sku] = { asg: s.assigned, res: s.reserved, tr: s.transit, eta: s.eta || '', plan: s.plan || {} };

  res.json({
    me,
    users,
    cfg: Object.fromEntries(cfg.map(r => [r.key, r.value])),
    clients: clients.map(c => ({ id: c.id, name: c.name, rut: c.rut, com: c.com, term: c.term, cds: c.cds, stage: c.stage, owner: c.owner, contact: c.contact, phone: c.phone, mail: c.mail, priceMode: c.price_mode })),
    skus: products.map(p => ({ sku: p.sku, name: p.name, brand: p.brand, cat: p.cat, ean: p.ean, dun: p.dun, g: p.grams, ucj: p.ucj, cjp: p.cjp, cost: me.fin ? p.cost : null, price: p.price, img: p.img, lead: p.lead_days, moq: p.moq, mult: p.mult, ss: p.ss, prov: p.supplier })),
    clientPrices: cprices.map(p => ({ cli: p.client_id, sku: p.sku, price: p.price, from: p.from_d, fromIso: p.valid_from, by: p.created_by })),
    ocs: pos.map(o => {
      const ls = byPo[o.id] || [];
      return { id: o.id, n: o.number, cli: o.client_id, f: o.f, req: o.req, cd: o.cd, st: o.status, ai: o.ai, motivo: o.reason,
        lines: ls.map(l => [l.sku, l.qty, l.price, l.line]), acc: ls.some(l => l.accepted != null) ? ls.map(l => l.accepted ?? 0) : null };
    }),
    desp: desp.map(d => ({ id: d.id, oc: d.po_number, cli: d.client_id, f: d.f || '—', ent: d.ent || '—', comp: d.comp, sol: d.requested, desp: d.dispatched, acc: d.accepted, mot: d.reason || '', st: d.status })),
    invs: invs.map(f => ({ id: f.id, fo: f.folio, t: f.dte, cli: f.client_id, f: f.f, v: f.v || '—', net: Number(f.net), iva: Number(f.iva), tot: Number(f.total), ref: f.ref_folio, oc: f.po_numbers, ds: f.dispatch_ids, pays: byInv[f.id] || [] })),
    purchases: purch.map(p => ({ ...p, net: Number(p.net), iva: Number(p.iva), total: Number(p.total) })),
    stock: st,
    loads: loads.map(l => ({ no: l.load_no, cutoff: l.cutoff, ts: l.cutoff_ts, file: l.file_name, st: l.status, by: l.created_by })),
    fcVersions: fcv,
    fc,
    sales: sales.map(s => ({ m: s.m, c: s.client_id, net: Number(s.net), cost: me.fin ? Number(s.cost) : null })),
    audit: audit.map(a => [a.at, a.user_id, a.record, a.detail])
  });
}
