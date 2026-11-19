// Generación de documentos HTML (vista previa, impresión y correo) con la identidad PAROCK.
import { sql } from './db.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = v => Math.round(Number(v) || 0).toLocaleString('es-CL');
const clp = v => (v < 0 ? '−$' : '$') + N(Math.abs(v));
const money = (v, c) => (c && c !== 'CLP') ? `${c} ${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` : clp(v);
const iso = d => d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : '';
const fmt = d => d ? iso(d).split('-').reverse().join('-') : '—';
const NAVY = '#0F1D2B', GOLD = '#A9864E', CREAM = '#F7F3EC', LINE = '#E6DFD3', MUTED = '#5E6875';

function frame({ base, kind, title, subtitle, to, meta, body, note }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>@media print{.noprint{display:none}body{background:#fff!important}}</style></head>
<body style="margin:0;background:#F4F1EA;font-family:Arial,Helvetica,sans-serif;color:#1B2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA;padding:24px 0"><tr><td align="center">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid ${LINE}">
<tr><td style="background:${NAVY};padding:22px 28px">
  <table role="presentation" width="100%"><tr><td><img src="${base}/assets/logo-parock-white.png" alt="PAROCK Group" height="38" style="display:block;height:38px"></td>
  <td align="right" style="color:#C9A86B;font-size:11px;letter-spacing:3px;text-transform:uppercase">${esc(kind)}</td></tr></table></td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${NAVY},${GOLD},#C9A86B,${GOLD},${NAVY})"></td></tr>
<tr><td style="padding:26px 28px 6px">
  <div style="font-size:22px;font-weight:bold;color:${NAVY}">${esc(title)}</div>
  <div style="font-size:13px;color:${MUTED};margin-top:4px">${subtitle}</div></td></tr>
<tr><td style="padding:14px 28px"><table role="presentation" width="100%" style="background:${CREAM};border-radius:10px"><tr>
  <td style="padding:14px 16px;font-size:13px;vertical-align:top;width:55%">${to}</td>
  <td style="padding:14px 16px;font-size:13px;vertical-align:top" align="right">${meta}</td></tr></table></td></tr>
<tr><td style="padding:8px 28px 4px">${body}</td></tr>
${note ? `<tr><td style="padding:10px 28px;font-size:13px;color:${MUTED}">${note}</td></tr>` : ''}
<tr><td style="padding:22px 28px;border-top:1px solid ${LINE};font-size:11px;color:${MUTED}">PAROCK SpA · Documento generado por el sistema de gestión PAROCK · Montos en pesos chilenos salvo indicación.</td></tr>
</table></td></tr></table></body></html>`;
}
const th = (t, r) => `<th style="text-align:${r ? 'right' : 'left'};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};padding:9px 8px;border-bottom:2px solid ${LINE}">${t}</th>`;
const td = (t, r, b) => `<td style="text-align:${r ? 'right' : 'left'};font-size:13px;padding:9px 8px;border-bottom:1px solid #F0EBE2;${b ? 'font-weight:bold;color:' + NAVY : ''}">${t}</td>`;
const table = (heads, rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${heads.map(h => th(h[0], h[1])).join('')}</tr>${rows.join('')}</table>`;
const totals = list => `<table role="presentation" width="100%" style="margin-top:10px"><tr><td></td><td width="260">${list.map(([l, v, b]) => `<table role="presentation" width="100%"><tr><td style="font-size:13px;padding:4px 8px;color:${b ? NAVY : MUTED};${b ? 'font-weight:bold' : ''}">${l}</td><td align="right" style="font-size:${b ? 16 : 13}px;padding:4px 8px;${b ? 'font-weight:bold;color:' + NAVY : ''}">${v}</td></tr></table>`).join('')}</td></tr></table>`;
const pkg = p => p.upd && p.dpb ? `${p.dpb} displays × ${p.upd} un` : `${p.ucj || 1} un/caja`;

export async function buildDoc(type, id, base, opts = {}) {
  if (type === 'oc') {
    const [o] = await sql`select po.*, c.name cname, c.com, c.rut, c.mail, c.contact from purchase_orders po join clients c on c.id = po.client_id where po.id = ${id}`;
    if (!o) return null;
    const ls = await sql`select l.*, l.price::float as price, l.boxes::float as boxes, p.name, p.ucj, p.upd, p.dpb, p.dun, p.ean from po_lines l join products p on p.sku = l.sku where l.po_id = ${id} order by l.line`;
    let net = 0;
    const rows = ls.map(l => {
      const ucj = l.ucj || 1, boxes = l.boxes ?? l.qty / ucj, sub = l.qty * l.price; net += sub;
      return `<tr>${td(`<b>${esc(l.name)}</b><br><span style="color:${MUTED};font-size:11px">${esc(l.sku)} · DUN ${esc(l.dun || '—')} · ${pkg(l)}</span>`)}${td(N(boxes), 1)}${td(N(l.qty), 1)}${td(clp(l.price * ucj), 1)}${td(clp(sub), 1, 1)}</tr>`;
    });
    const iva = Math.round(net * 0.19);
    return { to: o.mail, name: o.com, subject: `Orden de compra ${o.number} · PAROCK`, html: frame({ base, kind: 'Orden de compra', title: `Orden de compra N° ${o.number}`,
      subtitle: `Emitida el ${fmt(o.issued)} · Entrega solicitada ${fmt(o.requested)}`,
      to: `<b style="color:${NAVY}">${esc(o.com)}</b><br>${esc(o.cname)}<br>RUT ${esc(o.rut)}${o.contact ? '<br>' + esc(o.contact) : ''}`,
      meta: `<b>Destino:</b> ${esc(o.cd || '—')}<br><b>Estado:</b> ${esc(o.status)}`,
      body: table([['Producto'], ['Cajas', 1], ['Unidades', 1], ['Precio caja', 1], ['Subtotal', 1]], rows) + totals([['Neto', clp(net)], ['IVA 19%', clp(iva)], ['Total', clp(net + iva), 1]]),
      note: opts.message ? esc(opts.message).replace(/\n/g, '<br>') : '' }) };
  }
  if (type === 'so') {
    const [o] = await sql`select so.*, s.name sname, s.rut, s.mail, s.contact, s.country from supplier_orders so join suppliers s on s.id = so.supplier_id where so.id = ${id}`;
    if (!o) return null;
    const ls = await sql`select l.*, l.unit_cost::float cost, p.name, p.ucj, p.upd, p.dpb from supplier_order_lines l join products p on p.sku = l.sku where l.order_id = ${id} order by l.line`;
    let tot = 0;
    const rows = ls.map(l => { const sub = l.qty * l.cost; tot += sub; return `<tr>${td(`<b>${esc(l.name)}</b><br><span style="color:${MUTED};font-size:11px">${esc(l.sku)} · ${pkg(l)}</span>`)}${td(N(l.qty), 1)}${td(money(l.cost, o.currency), 1)}${td(money(sub, o.currency), 1, 1)}</tr>`; });
    return { to: o.mail, name: o.sname, subject: `Purchase order / Orden de compra ${o.number} · PAROCK`, html: frame({ base, kind: 'Orden de compra a proveedor', title: `Orden de compra N° ${o.number}`,
      subtitle: `Emitida el ${fmt(o.issued)}${o.eta ? ' · ETA ' + fmt(o.eta) : ''}`,
      to: `<b style="color:${NAVY}">${esc(o.sname)}</b><br>${o.rut ? 'RUT / Tax ID ' + esc(o.rut) + '<br>' : ''}${esc(o.country || '')}${o.contact ? '<br>' + esc(o.contact) : ''}`,
      meta: `<b>Moneda:</b> ${esc(o.currency)}<br><b>Estado:</b> ${esc(o.status)}`,
      body: table([['Producto'], ['Unidades', 1], ['Costo unitario', 1], ['Subtotal', 1]], rows) + totals([['Total', money(tot, o.currency), 1]]),
      note: [o.notes, opts.message].filter(Boolean).map(x => esc(x).replace(/\n/g, '<br>')).join('<br><br>') }) };
  }
  if (type === 'invoice') {
    const [f] = await sql`select i.*, c.name cname, c.com, c.rut, c.mail from invoices i join clients c on c.id = i.client_id where i.id = ${id}`;
    if (!f) return null;
    const pays = await sql`select paid_at, amount from payments where invoice_id = ${id} order by paid_at`;
    const ncs = await sql`select folio, issued, total from invoices where dte = 61 and ref_folio = ${f.folio} and client_id = ${f.client_id}`;
    const saldo = Number(f.total) - pays.reduce((a, p) => a + Number(p.amount), 0) + ncs.reduce((a, n) => a + Number(n.total), 0);
    const kind = f.dte === 61 ? 'Nota de crédito' : 'Factura';
    const mov = [`<tr>${td(fmt(f.issued))}${td(`${kind} ${f.folio}`)}${td(clp(f.total), 1)}</tr>`,
      ...ncs.map(n => `<tr>${td(fmt(n.issued))}${td('Nota de crédito ' + n.folio)}${td(clp(n.total), 1)}</tr>`),
      ...pays.map(p => `<tr>${td(fmt(p.paid_at))}${td('Pago recibido')}${td(clp(-p.amount), 1)}</tr>`)];
    return { to: f.mail, name: f.com, subject: `${kind} ${f.folio} · PAROCK`, html: frame({ base, kind, title: `${kind} electrónica N° ${f.folio}`,
      subtitle: `Emitida en SII el ${fmt(f.issued)}${f.due ? ' · Vence ' + fmt(f.due) : ''}`,
      to: `<b style="color:${NAVY}">${esc(f.com)}</b><br>${esc(f.cname)}<br>RUT ${esc(f.rut)}`,
      meta: `<b>OC:</b> ${esc((f.po_numbers || []).join(', ') || '—')}<br><b>Tipo DTE:</b> ${f.dte}`,
      body: totals([['Neto', clp(f.net)], ['IVA 19%', clp(f.iva)], ['Total', clp(f.total), 1]]) + (f.dte === 61 ? '' : `<div style="margin-top:18px">${table([['Fecha'], ['Movimiento'], ['Monto', 1]], mov)}</div>` + totals([['Saldo pendiente', clp(Math.max(0, saldo)), 1]])),
      note: (opts.message ? esc(opts.message).replace(/\n/g, '<br>') + '<br><br>' : '') + 'El documento tributario oficial está disponible en el sitio del SII.' }) };
  }
  if (type === 'statement') {
    const [c] = await sql`select * from clients where id = ${String(id)}`;
    if (!c) return null;
    const inv = await sql`select i.id, i.folio, i.issued, i.due, i.total,
        i.total - coalesce((select sum(amount) from payments p where p.invoice_id = i.id), 0) + coalesce((select sum(n.total) from invoices n where n.dte = 61 and n.ref_folio = i.folio and n.client_id = i.client_id), 0) as saldo
      from invoices i where i.client_id = ${c.id} and i.dte <> 61 order by i.issued`;
    const open = inv.filter(i => Number(i.saldo) > 0);
    const today = new Date().toISOString().slice(0, 10);
    const tot = open.reduce((a, i) => a + Number(i.saldo), 0), over = open.filter(i => i.due && iso(i.due) < today);
    const rows = open.map(i => { const d = iso(i.due); const late = d && d < today;
      return `<tr>${td('Factura ' + i.folio)}${td(fmt(i.issued))}${td(`<span style="color:${late ? '#B23A3A' : 'inherit'}">${fmt(d)}${late ? ' · vencida' : ''}</span>`)}${td(clp(i.total), 1)}${td(clp(i.saldo), 1, 1)}</tr>`; });
    return { to: c.mail, name: c.com, subject: `Estado de cuenta ${c.com} · PAROCK`, html: frame({ base, kind: 'Estado de cuenta', title: 'Estado de cuenta',
      subtitle: `Al ${fmt(today)}`, to: `<b style="color:${NAVY}">${esc(c.com)}</b><br>${esc(c.name)}<br>RUT ${esc(c.rut)}`,
      meta: `<b>Documentos pendientes:</b> ${open.length}<br><b>Vencidos:</b> ${over.length}`,
      body: (rows.length ? table([['Documento'], ['Emisión'], ['Vencimiento'], ['Total', 1], ['Saldo', 1]], rows) : `<p style="font-size:14px">No hay documentos pendientes. ¡Gracias!</p>`) + totals([['Total por pagar', clp(tot), 1]]),
      note: opts.message ? esc(opts.message).replace(/\n/g, '<br>') : '' }) };
  }
  return null;
}

export async function sendMail({ to, cc, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return { ok: false, error: 'El envío de correo no está configurado (faltan RESEND_API_KEY y MAIL_FROM).' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, cc: cc && cc.length ? cc : undefined, subject, html, reply_to: replyTo || process.env.MAIL_REPLY_TO || undefined })
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.message || `Error del proveedor de correo (${r.status})` };
}
