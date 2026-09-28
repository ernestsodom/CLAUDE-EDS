// GET /api/img?id=N → imagen subida desde el back office.
import { hasDb, sql, mem } from '../lib/db.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return send(res, 400, 'id inválido');
  let mime, buf;
  if (hasDb()) {
    const row = (await sql()`select mime, encode(data, 'base64') as b64 from images where id = ${id}`)[0];
    if (row) { mime = row.mime; buf = Buffer.from(row.b64, 'base64'); }
  } else {
    const row = mem.images.find(i => i.id === id);
    if (row) { mime = row.mime; buf = row.data; }
  }
  if (!buf) return send(res, 404, 'No encontrada');
  send(res, 200, buf, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
}
