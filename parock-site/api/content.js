import { getContent, saveContent, sql } from '../lib/db.js';
import { requireAdmin, sameOrigin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    if (req.query.history) {
      const rows = await sql().query('SELECT id, saved_at FROM site_history ORDER BY id DESC LIMIT 30');
      return res.status(200).json({ versions: rows });
    }
    if (req.query.version) {
      const rows = await sql().query('SELECT data FROM site_history WHERE id = $1', [Number(req.query.version)]);
      if (!rows.length) return res.status(404).json({ error: 'Versión no encontrada' });
      return res.status(200).json({ data: rows[0].data });
    }
    const c = await getContent();
    return res.status(200).json(c);
  }
  if (req.method === 'PUT') {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origen no permitido' });
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || !data.site || !data.portfolio) return res.status(400).json({ error: 'Contenido inválido' });
    await saveContent(data);
    return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
  }
  res.status(405).json({ error: 'Método no permitido' });
}
