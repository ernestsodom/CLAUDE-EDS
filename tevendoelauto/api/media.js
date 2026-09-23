import { sql } from '../lib/db.js';

// Sirve las imágenes subidas desde el back office (logo, fotos de vehículos)
export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).end();
  try {
    const rows = await sql()`SELECT mime, data FROM media WHERE id = ${id}`;
    if (!rows[0]) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(Buffer.from(rows[0].data, 'base64'));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
}
