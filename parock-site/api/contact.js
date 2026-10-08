import { sql } from '../lib/db.js';
import { requireAdmin, sameOrigin } from '../lib/auth.js';

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origen no permitido' });
    const b = req.body || {};
    if (b.website) return res.status(200).json({ ok: true }); // honeypot: bot
    const row = { nombre: clip(b.nombre, 120), empresa: clip(b.empresa, 160), email: clip(b.email, 160), mensaje: clip(b.mensaje, 4000) };
    if (!row.nombre || !row.mensaje || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return res.status(400).json({ error: 'Completa nombre, correo válido y mensaje.' });
    await sql().query('INSERT INTO contact_messages (nombre, empresa, email, mensaje) VALUES ($1,$2,$3,$4)', [row.nombre, row.empresa, row.email, row.mensaje]);
    return res.status(200).json({ ok: true });
  }
  if (!requireAdmin(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const rows = await sql().query('SELECT id, nombre, empresa, email, mensaje, leido, created_at FROM contact_messages ORDER BY id DESC LIMIT 200');
    return res.status(200).json({ messages: rows });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origen no permitido' });
  if (req.method === 'PATCH') {
    await sql().query('UPDATE contact_messages SET leido = $2 WHERE id = $1', [Number(req.body?.id), !!req.body?.leido]);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await sql().query('DELETE FROM contact_messages WHERE id = $1', [Number(req.query.id)]);
    return res.status(200).json({ ok: true });
  }
  res.status(405).json({ error: 'Método no permitido' });
}
