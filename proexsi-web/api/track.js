// POST /api/track → registra visitas, secciones vistas y clics del sitio público.
import { hasDb, sql, ensureSchema, mem } from '../lib/db.js';
import { readJson, send, clip } from '../lib/http.js';

const TYPES = new Set(['pageview', 'section', 'click', 'lead']);
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu)\./i;
const SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|t\.co|twitter|x\.com|youtube|youtu\.be|tiktok|whatsapp|wa\.me|pinterest|threads)\b/i;

function classify(referrer, host, utm) {
  if (utm) return 'Campañas';
  if (!referrer) return 'Directo';
  let h;
  try { h = new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'Directo'; }
  if (host && h === host.replace(/^www\./, '')) return 'Directo';
  if (SEARCH.test(h)) return 'Buscadores';
  if (SOCIAL.test(h)) return 'Redes sociales';
  if (/mail|outlook|gmail/i.test(h)) return 'Correo';
  return 'Otros sitios';
}
function device(ua, w) {
  if (/ipad|tablet/i.test(ua) || (w >= 600 && w < 1024 && /mobile|android/i.test(ua))) return 'Tablet';
  if (/mobi|iphone|android/i.test(ua) || (w && w < 600)) return 'Celular';
  return 'Computador';
}
function browser(ua) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Otro';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  try {
    const ua = req.headers['user-agent'] || '';
    if (/bot|crawl|spider|slurp|headless|lighthouse/i.test(ua)) return send(res, 204);
    const b = await readJson(req, 10_000);
    if (!TYPES.has(b.type)) return send(res, 400, { error: 'Tipo inválido' });
    let refHost = null;
    try { refHost = b.referrer ? new URL(b.referrer).hostname.replace(/^www\./, '') : null; } catch {}
    const host = req.headers.host || '';
    if (refHost && refHost === host.replace(/^www\./, '')) refHost = null;
    const city = req.headers['x-vercel-ip-city'];
    const row = {
      ts: new Date().toISOString(), type: b.type, path: clip(b.path, 120), section: clip(b.section, 80), label: clip(b.label, 120),
      visitor: clip(b.visitor, 60), session: clip(b.session, 60), referrer: refHost,
      source: b.utm_source ? 'Campañas' : classify(b.referrer, host, b.utm_source),
      utm_source: clip(b.utm_source, 80), utm_medium: clip(b.utm_medium, 80), utm_campaign: clip(b.utm_campaign, 80),
      device: device(ua, Number(b.w) || 0), browser: browser(ua),
      country: clip(req.headers['x-vercel-ip-country'], 8) || null,
      city: city ? clip(decodeURIComponent(city), 80) : null,
    };
    if (hasDb()) {
      await ensureSchema();
      await sql()`insert into events (type, path, section, label, visitor, session, referrer, source, utm_source, utm_medium, utm_campaign, device, browser, country, city)
        values (${row.type}, ${row.path}, ${row.section}, ${row.label}, ${row.visitor}, ${row.session}, ${row.referrer}, ${row.source},
                ${row.utm_source}, ${row.utm_medium}, ${row.utm_campaign}, ${row.device}, ${row.browser}, ${row.country}, ${row.city})`;
    } else {
      mem.events.push(row);
    }
    send(res, 204);
  } catch (e) {
    console.error(e);
    send(res, 400, { error: 'No se pudo registrar' });
  }
}
