import crypto from 'node:crypto';
import { sql } from '../lib/db.js';
import { requireAdmin, sameOrigin } from '../lib/auth.js';

const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST' || !sameOrigin(req)) return res.status(405).json({ error: 'Método no permitido' });
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(req.body?.dataUrl || ''));
  if (!m || !OK.includes(m[1])) return res.status(400).json({ error: 'Formato de imagen no permitido. Usa JPG, PNG, WebP o SVG.' });
  const b64 = m[2];
  if (b64.length > 4_000_000) return res.status(413).json({ error: 'La imagen es demasiado grande (máx. 3 MB).' });
  const id = crypto.randomBytes(9).toString('base64url');
  await sql().query(
    `INSERT INTO images (id, mime, bytes, name) VALUES ($1, $2, decode($3, 'base64'), $4)`,
    [id, m[1], b64, String(req.body?.name || '').slice(0, 200)]);
  res.status(200).json({ src: `/api/img?id=${id}` });
}
