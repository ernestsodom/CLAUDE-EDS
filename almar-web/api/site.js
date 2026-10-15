import { db, json } from './_lib.js';

// Contenido público: textos modificados y configuración de categorías.
export default async function handler(req, res) {
  try {
    const sql = db();
    const [content, galleries] = await Promise.all([
      sql`SELECT key, value FROM content`,
      sql`SELECT key, data FROM galleries`
    ]);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.status(200).json({
      content: Object.fromEntries(content.map((r) => [r.key, r.value])),
      galleries: Object.fromEntries(galleries.map((r) => [r.key, r.data]))
    });
  } catch (e) {
    console.error('site', e);
    json(res, 200, { content: {}, galleries: {} });
  }
}
