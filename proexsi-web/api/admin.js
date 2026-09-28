// API del back office: /api/admin?a=<acción>
import { checkPassword, sessionCookie, clearCookie, isAuthed } from '../lib/auth.js';
import { getContent, saveContent, listHistory, getHistory } from '../lib/content.js';
import { DEFAULTS, META } from '../lib/defaults.js';
import { FONTS } from '../lib/fonts.js';
import { getStats } from '../lib/stats.js';
import { hasDb, sql, ensureSchema, mem } from '../lib/db.js';
import { readJson, send, clip } from '../lib/http.js';

const MIMES = new Set(['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/gif']);

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a');
  try {
    if (a === 'login' && req.method === 'POST') {
      const b = await readJson(req, 5_000);
      if (!checkPassword(b.password)) {
        await new Promise(r => setTimeout(r, 800));
        return send(res, 401, { error: 'Contraseña incorrecta' });
      }
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie() });
    }
    if (a === 'logout') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
    if (!isAuthed(req)) return send(res, 401, { error: 'Sesión expirada. Vuelve a ingresar.' });

    switch (a) {
      case 'me':
        return send(res, 200, { ok: true, db: hasDb() });

      case 'content':
        if (req.method === 'GET') {
          return send(res, 200, { content: await getContent({ fresh: true }), defaults: DEFAULTS, meta: META, fonts: Object.keys(FONTS) },
            { 'Cache-Control': 'no-store' });
        }
        if (req.method === 'PUT') {
          const b = await readJson(req, 2_500_000);
          await saveContent(b.content, clip(b.note, 120) || 'Guardado desde el back office');
          return send(res, 200, { ok: true });
        }
        break;

      case 'history':
        return send(res, 200, { items: await listHistory() });

      case 'restore': {
        const b = await readJson(req, 1_000);
        const data = await getHistory(Number(b.id));
        if (!data) return send(res, 404, { error: 'Versión no encontrada' });
        await saveContent(data, `Restaurada la versión #${b.id}`);
        return send(res, 200, { ok: true });
      }

      case 'upload': {
        if (req.method !== 'POST') break;
        const b = await readJson(req, 6_000_000);
        const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(b.dataUrl || '');
        if (!m || !MIMES.has(m[1])) return send(res, 400, { error: 'Formato de imagen no permitido (usa JPG, PNG, WEBP o SVG)' });
        const size = Math.floor(m[2].length * 3 / 4);
        if (size > 4_000_000) return send(res, 400, { error: 'La imagen supera 4 MB' });
        let id;
        if (hasDb()) {
          await ensureSchema();
          id = (await sql()`insert into images (name, mime, data, size) values (${clip(b.name, 120)}, ${m[1]}, decode(${m[2]}, 'base64'), ${size}) returning id`)[0].id;
        } else {
          id = mem.images.length + 1;
          mem.images.push({ id, name: b.name, mime: m[1], data: Buffer.from(m[2], 'base64'), size });
        }
        return send(res, 200, { id, url: `/api/img?id=${id}` });
      }

      case 'stats':
        return send(res, 200, await getStats(url.searchParams.get('days')), { 'Cache-Control': 'no-store' });

      case 'leads': {
        let items;
        if (hasDb()) { await ensureSchema(); items = await sql()`select * from leads order by ts desc limit 500`; }
        else items = mem.leads;
        return send(res, 200, { items }, { 'Cache-Control': 'no-store' });
      }
    }
    send(res, 404, { error: 'Acción no encontrada' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || 'Error interno' });
  }
}
