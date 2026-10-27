import { db } from './_lib.js';

// Aviso por WhatsApp a la dueña del sitio cuando llega una cotización.
// Usa CallMeBot (gratuito, uso personal): el número debe activarse una vez en
// https://www.callmebot.com/blog/free-api-whatsapp-messages/ para obtener la apikey.
// La configuración vive en la tabla privada `settings` (nunca se expone en /api/site);
// las variables CALLMEBOT_PHONE / CALLMEBOT_APIKEY sirven de respaldo.

const KEYS = ['notify_enabled', 'notify_phone', 'notify_apikey'];
const SRC = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', directo: 'Directo (escribieron la dirección)', otro: 'Otro sitio' };

export async function getNotifySettings() {
  const rows = await db()`SELECT key, value FROM settings WHERE key = ANY(${KEYS})`;
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: (s.notify_enabled ?? '1') === '1',
    phone: (s.notify_phone || process.env.CALLMEBOT_PHONE || '').replace(/\D/g, ''),
    apikey: s.notify_apikey || process.env.CALLMEBOT_APIKEY || ''
  };
}

export async function saveNotifySettings({ enabled, phone, apikey }) {
  const sql = db();
  const q = [];
  const put = (k, v) => q.push(sql`INSERT INTO settings (key, value) VALUES (${k}, ${v})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  if (enabled !== undefined) put('notify_enabled', enabled ? '1' : '0');
  if (phone !== undefined) put('notify_phone', String(phone).replace(/\D/g, '').slice(0, 20));
  if (apikey !== undefined && apikey !== '') put('notify_apikey', String(apikey).trim().slice(0, 80));
  if (q.length) await sql.transaction(q);
}

const fdate = (s) => {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });
};
function waOf(n) { let d = String(n || '').replace(/\D/g, ''); if (d.length === 9 && d[0] === '9') d = '56' + d; return d; }

export function leadMessage(l, origin) {
  const lines = [
    '*🔔 Nueva cotización desde la página web*',
    'Alguien cotizó *directamente en el formulario* de tu sitio.',
    '',
    `👤 *Nombre:* ${l.nombre}`,
    `🎉 *Evento:* ${l.tipo || 'No indicado'}`,
    l.fecha ? `📅 *Fecha:* ${fdate(l.fecha)}` : '📅 *Fecha:* No indicada',
    l.lugar ? `📍 *Lugar:* ${l.lugar}` : null,
    `✉️ *Correo:* ${l.email}`,
    l.whatsapp ? `📱 *WhatsApp:* ${l.whatsapp}` : null,
    '',
    `💬 *Solicitud:*\n${(l.mensaje || 'Sin mensaje').slice(0, 1200)}`,
    '',
    `🔎 *Llegó desde:* ${SRC[l.source] || 'Directo'}`,
    waOf(l.whatsapp) ? `↩️ Responder: https://wa.me/${waOf(l.whatsapp)}` : null,
    origin ? `📋 Ver en el panel: ${origin}/admin#presupuestos` : null
  ];
  return lines.filter((x) => x !== null).join('\n').trim();
}

// Envía el texto; devuelve { ok, detail }. Nunca lanza: el formulario no debe fallar por el aviso.
export async function sendWhatsApp(text, cfg) {
  try {
    cfg = cfg || await getNotifySettings();
    if (!cfg.enabled) return { ok: false, detail: 'desactivado' };
    if (!cfg.phone || !cfg.apikey) return { ok: false, detail: 'sin configurar' };
    const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${cfg.phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(cfg.apikey)}`;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
    const body = (await r.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const ok = r.ok && !/error|invalid|not (been )?activated|apikey is not|blocked/i.test(body);
    return { ok, detail: ok ? 'enviado' : `rechazado: ${body.slice(0, 140) || 'HTTP ' + r.status}` };
  } catch (e) {
    return { ok: false, detail: e.name === 'AbortError' ? 'tiempo agotado' : 'error de red' };
  }
}

export async function notifyLead(lead, origin) {
  const res = await sendWhatsApp(leadMessage(lead, origin));
  try {
    await db()`UPDATE leads SET notify_status = ${res.detail}, notify_at = now() WHERE id = ${lead.id}`;
  } catch (e) { console.error('notify status', e); }
  return res;
}

export const originOf = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `https://${host}` : '';
};
