import { sql } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';

// Sirve imágenes subidas por los usuarios (solo con sesión activa)
export default async function handler(req, res) {
  const u = await currentUser(req, sql);
  if (!u) return res.status(401).end();
  const id = Number(req.query?.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).end();
  const [r] = await sql`select mime, encode(data, 'base64') as b64 from images where id = ${id}`;
  if (!r) return res.status(404).end();
  res.setHeader('Content-Type', r.mime);
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(Buffer.from(r.b64, 'base64'));
}
