import { db, body, clip, classifySource } from './_lib.js';

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|whatsapp/i;
const TYPES = new Set(['pageview', 'leave', 'click']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const ua = req.headers['user-agent'] || '';
  if (BOT.test(ua)) return res.status(204).end();
  const b = body(req);
  if (!TYPES.has(b.type) || !b.sid) return res.status(204).end();
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'movil' : 'escritorio';
  const source = classifySource(b.src || {}, req.headers.host || '');
  let refHost = null;
  try { refHost = b.src?.ref ? new URL(b.src.ref).hostname : null; } catch {}
  const dur = Number.isFinite(+b.duration) ? Math.max(0, Math.min(+b.duration, 3 * 3600e3)) | 0 : null;
  try {
    await db()`INSERT INTO events (sid, vid, type, path, source, referrer, duration_ms, device, label)
      VALUES (${clip(b.sid, 64)}, ${clip(b.vid, 64)}, ${b.type}, ${clip(b.path, 80)}, ${source}, ${clip(refHost, 120)}, ${b.type === 'leave' ? dur : null}, ${device}, ${clip(b.label, 60)})`;
  } catch (e) { console.error('track', e); }
  res.status(204).end();
}
