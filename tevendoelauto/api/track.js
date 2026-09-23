import { sql, send, clip } from '../lib/db.js';

const TYPES = new Set(['pageview', 'vehicle_view', 'vehicle_click', 'whatsapp', 'cotizar_open']);
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const ua = req.headers['user-agent'] || '';
    if (!TYPES.has(b.type) || BOT.test(ua)) return res.status(204).end();
    const device = /mobile|android|iphone|ipod/i.test(ua) ? 'móvil' : /ipad|tablet/i.test(ua) ? 'tablet' : 'escritorio';
    let ref = '';
    try { const u = new URL(b.referrer || ''); if (u.host !== req.headers.host) ref = u.host; } catch {}
    const vid = Number.isInteger(b.vehicle_id) ? b.vehicle_id : null;
    await sql()`INSERT INTO events (type, path, vehicle_id, visitor_id, session_id, referrer, device)
                VALUES (${b.type}, ${clip(b.path, 80)}, ${vid}, ${clip(b.visitor_id, 64)}, ${clip(b.session_id, 64)}, ${clip(ref, 120)}, ${device})`;
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(204).end();
  }
}
