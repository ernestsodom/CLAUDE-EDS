import { sql } from '../lib/db.js';

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^[\w-]{6,40}$/.test(id)) return res.status(400).end();
  const rows = await sql().query(`SELECT mime, encode(bytes, 'base64') AS b64 FROM images WHERE id = $1`, [id]);
  if (!rows.length) return res.status(404).end();
  res.setHeader('Content-Type', rows[0].mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (rows[0].mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.status(200).send(Buffer.from(rows[0].b64, 'base64'));
}
