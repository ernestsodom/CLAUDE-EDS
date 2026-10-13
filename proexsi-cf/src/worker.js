// Proexsi: sitio público + back office en un Worker de Cloudflare, con datos en Neon.
import { getDb } from './db.js';
import { DEFAULTS } from './defaults.js';
import { renderPath, renderNotFound } from './render.js';
import { checkPassword, makeCookie, clearCookie, isAuthed, config } from './auth.js';
import { BLOCKS, CATEGORY_FIELDS, CATEGORY_PAGE_FIELDS, SITE_FIELDS, NAV_FIELDS, PAGE_FIELDS, PALETTES, COLOR_TOKENS } from './schema.js';
import { FONTS } from './fonts.js';
import { ICONS, iconSvg } from './icons.js';
import { STATIC_IMAGES } from './static-images.js';
import { isBot, parseUA, classifySource, computeStats } from './stats.js';

const ASSET_VERSION = 4;
const MAX_UPLOAD = 6 * 1024 * 1024;
const RESERVED = new Set(['productos', 'admin', 'api', 'media', 'img', 'site.css', 'site.js', 'favicon.ico', 'robots.txt', 'sitemap.xml']);
const IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif', 'image/svg+xml']);

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const html = (body, status = 200, cache = 'public, max-age=0, s-maxage=30') =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });

/* ---------- contenido ---------- */
export function mergeContent(saved) {
  const d = structuredClone(DEFAULTS);
  if (!saved || typeof saved !== 'object') return d;
  const out = { ...d, ...saved };
  for (const k of ['site', 'theme', 'categoryPage']) out[k] = { ...d[k], ...(saved[k] || {}) };
  out.theme.colors = { ...d.theme.colors, ...(saved.theme?.colors || {}) };
  out.home = { ...d.home, ...(saved.home || {}) };
  return out;
}

let cache = null; // { data, updated_at, at }
async function loadContent(db, fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 10_000) return cache;
  const row = await db.getContent();
  cache = { data: mergeContent(row?.data), updated_at: row?.updated_at || null, at: Date.now() };
  return cache;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function validate(c) {
  if (!c || typeof c !== 'object') return 'El contenido no es válido.';
  if (!c.site || !c.theme || !Array.isArray(c.home?.blocks) || !Array.isArray(c.categories) || !Array.isArray(c.pages) || !Array.isArray(c.nav))
    return 'Faltan partes del contenido (sitio, diseño, inicio, productos, páginas o menú).';
  const seen = new Set();
  for (const cat of c.categories) {
    if (!cat.name) return 'Hay un producto sin nombre.';
    if (!SLUG.test(cat.slug || '')) return `La dirección del producto "${cat.name}" solo puede tener minúsculas, números y guiones.`;
    if (seen.has('p/' + cat.slug)) return `Hay dos productos con la dirección "${cat.slug}".`;
    seen.add('p/' + cat.slug);
  }
  for (const p of c.pages) {
    if (!p.title) return 'Hay una página sin nombre.';
    if (!SLUG.test(p.slug || '')) return `La dirección de la página "${p.title}" solo puede tener minúsculas, números y guiones.`;
    if (RESERVED.has(p.slug)) return `La dirección "${p.slug}" está reservada por el sistema. Elige otra para la página "${p.title}".`;
    if (seen.has(p.slug)) return `Hay dos páginas con la dirección "${p.slug}".`;
    seen.add(p.slug);
    if (!Array.isArray(p.blocks)) return `La página "${p.title}" no tiene secciones válidas.`;
  }
  for (const b of [...c.home.blocks, ...c.pages.flatMap(p => p.blocks)]) {
    if (!BLOCKS[b?.type]) return `Hay una sección de tipo desconocido (${b?.type}).`;
  }
  return null;
}

/* ---------- límite de intentos de acceso ---------- */
const fails = new Map();
function tooMany(ip) {
  const f = fails.get(ip);
  return f && f.n >= 8 && Date.now() - f.t < 10 * 60_000;
}
function addFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.t > 10 * 60_000) fails.set(ip, { n: 1, t: Date.now() });
  else f.n++;
}

/* ---------- API del back office ---------- */
async function adminApi(req, env, url, db) {
  const path = url.pathname.replace(/^\/admin\/api\/?/, '');
  const secure = url.protocol === 'https:';
  const ip = req.headers.get('CF-Connecting-IP') || 'local';

  if (path === 'login' && req.method === 'POST') {
    if (tooMany(ip)) return json({ error: 'Demasiados intentos. Espera 10 minutos e inténtalo de nuevo.' }, 429);
    const { password } = await req.json().catch(() => ({}));
    if (!config(env).password) return json({ error: 'Falta configurar la clave del back office (ADMIN_PASSWORD) en Cloudflare.' }, 500);
    if (!config(env).secret) return json({ error: 'Falta configurar SESSION_SECRET en Cloudflare: sin ella no se puede iniciar sesión.' }, 500);
    if (!(await checkPassword(env, password))) { addFail(ip); return json({ error: 'La clave no es correcta.' }, 401); }
    fails.delete(ip);
    return json({ ok: true }, 200, { 'Set-Cookie': await makeCookie(env, secure) });
  }
  if (path === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(secure) });
  if (!(await isAuthed(env, req))) return json({ error: 'Tu sesión expiró. Vuelve a ingresar.' }, 401);

  // Protección CSRF: las escrituras deben venir del mismo sitio
  if (req.method !== 'GET') {
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Origen no permitido.' }, 403);
  }

  if (path === 'session') return json({ ok: true, db: db.kind });

  if (path === 'meta') {
    return json({
      blocks: BLOCKS, categoryFields: CATEGORY_FIELDS, categoryPageFields: CATEGORY_PAGE_FIELDS, siteFields: SITE_FIELDS, navFields: NAV_FIELDS, pageFields: PAGE_FIELDS,
      palettes: PALETTES, colorTokens: COLOR_TOKENS, fonts: FONTS,
      icons: Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, { name: v[0], svg: iconSvg(k) }])),
      staticImages: STATIC_IMAGES, reserved: [...RESERVED], db: db.kind,
    });
  }

  if (path === 'content' && req.method === 'GET') {
    const c = await loadContent(db, true);
    return json({ content: c.data, updated_at: c.updated_at });
  }
  if (path === 'content' && req.method === 'PUT') {
    const body = await req.json().catch(() => null);
    if (!body?.content) return json({ error: 'No llegó el contenido.' }, 400);
    const err = validate(body.content);
    if (err) return json({ error: err }, 400);
    const cur = await loadContent(db, true);
    if (!body.force && cur.updated_at && body.base && new Date(body.base).getTime() !== new Date(cur.updated_at).getTime())
      return json({ error: 'Otra persona guardó cambios mientras editabas. Recarga para ver la versión más reciente o publica de todos modos.', conflict: true }, 409);
    const updated_at = await db.saveContent(body.content, String(body.note || '').slice(0, 200));
    cache = null;
    return json({ ok: true, updated_at });
  }
  if (path === 'preview' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    if (!body?.content) return json({ error: 'No llegó el contenido.' }, 400);
    const content = mergeContent(body.content);
    content.__assetVersion = ASSET_VERSION;
    const out = renderPath(content, body.path || '/', { preview: true, origin: url.origin }) || renderNotFound(content, { preview: true });
    return html(out, 200, 'no-store');
  }

  if (path === 'history') return json({ items: await db.listHistory() });
  let m = path.match(/^history\/(\d+)$/);
  if (m) {
    const data = await db.getHistory(m[1]);
    return data ? json({ content: mergeContent(data) }) : json({ error: 'No existe esa versión.' }, 404);
  }

  if (path === 'media' && req.method === 'GET') return json({ items: await db.listMedia() });
  if (path === 'media' && req.method === 'POST') {
    const mime = (req.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!IMAGE_TYPES.has(mime)) return json({ error: 'Formato no admitido. Usa JPG, PNG, WebP, GIF, AVIF o SVG.' }, 400);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) return json({ error: 'El archivo está vacío.' }, 400);
    if (buf.length > MAX_UPLOAD) return json({ error: 'La imagen pesa más de 6 MB. Redúcela e inténtalo de nuevo.' }, 413);
    if (mime === 'image/svg+xml' && /<script|on\w+\s*=|javascript:/i.test(new TextDecoder().decode(buf)))
      return json({ error: 'El SVG contiene código no permitido.' }, 400);
    const name = decodeURIComponent(req.headers.get('X-File-Name') || 'imagen').slice(0, 120);
    const id = await db.addMedia({ name, mime, bytes: buf, width: Number(req.headers.get('X-Width')) || null, height: Number(req.headers.get('X-Height')) || null });
    return json({ ok: true, id, url: `/media/${id}` });
  }
  m = path.match(/^media\/(\d+)$/);
  if (m && req.method === 'DELETE') {
    await db.deleteMedia(m[1]);
    await caches.default.delete(new Request(`${url.origin}/media/${m[1]}`)).catch(() => {});
    return json({ ok: true });
  }

  if (path === 'stats') {
    const days = [7, 30, 90, 365].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    const since = new Date(Date.now() - 2 * days * 86400000).toISOString();
    const [events, leads, c] = await Promise.all([db.listEvents(since), db.leadsSince(since), loadContent(db)]);
    return json(computeStats({ events, leads, days, content: c.data }));
  }
  if (path === 'leads' && req.method === 'GET') return json({ items: await db.listLeads() });
  m = path.match(/^leads\/(\d+)$/);
  if (m && req.method === 'DELETE') { await db.deleteLead(m[1]); return json({ ok: true }); }

  return json({ error: 'No encontrado.' }, 404);
}

/* ---------- público ---------- */
async function media(req, env, url, db, ctx) {
  const id = url.pathname.split('/')[2];
  if (!/^\d+$/.test(id)) return new Response('No encontrado', { status: 404 });
  const key = new Request(url.origin + url.pathname);
  const hit = await caches.default.match(key).catch(() => null);
  if (hit) return hit;
  const m = await db.getMedia(id);
  if (!m) return new Response('No encontrado', { status: 404 });
  const res = new Response(m.bytes, { headers: {
    'Content-Type': m.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    ...(m.mime === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}),
  } });
  ctx.waitUntil(caches.default.put(key, res.clone()).catch(() => {}));
  return res;
}

// Datos de contexto de quien visita (los entrega Cloudflare en cada solicitud)
function place(req) {
  const cf = req.cf || {};
  return { country: cf.country || null, region: cf.region || null, city: cf.city || null };
}

async function track(req, db, url) {
  const ua = req.headers.get('User-Agent') || '';
  if (isBot(ua)) return new Response(null, { status: 204 });
  const raw = await req.text();
  if (raw.length > 4000) return new Response(null, { status: 413 });
  let b; try { b = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const type = ['pageview', 'section', 'click'].includes(b.type) ? b.type : null;
  if (!type) return new Response(null, { status: 400 });
  const str = (v, n = 160) => (v == null || v === '' ? null : String(v).slice(0, n));
  const e = {
    type, path: str(b.path, 200), section: str(b.section, 200), label: str(b.label, 120),
    visitor: str(b.visitor, 40), session: str(b.session, 40),
    ...place(req), ...parseUA(ua),
  };
  if (type === 'pageview' && b.first) {
    e.referrer = str(b.referrer, 300);
    e.campaign = str(b.utm_campaign, 80);
    e.source = classifySource(b.referrer, b.utm_source, url.hostname.replace(/^www\./, ''));
  }
  await db.addEvent(e);
  return new Response(null, { status: 204 });
}

async function lead(req, db) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > 20_000) return json({ error: 'Solicitud demasiado grande.' }, 413);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ error: 'Datos no válidos.' }, 400);
  if (b.empresa_web) return json({ ok: true }); // trampa para robots
  const clean = {};
  for (const k of ['nombre', 'cargo', 'institucion', 'correo', 'telefono', 'producto', 'mensaje']) clean[k] = String(b[k] ?? '').trim().slice(0, k === 'mensaje' ? 2000 : 200);
  if (!clean.nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.correo)) return json({ error: 'Escribe tu nombre y un correo válido.' }, 400);
  clean._meta = { visitor: String(b.visitor || '').slice(0, 40) || null, session: String(b.session || '').slice(0, 40) || null, ...place(req), ...parseUA(req.headers.get('User-Agent') || '') };
  await db.addLead(clean);
  await db.addEvent({ type: 'click', label: 'Envió solicitud de demo', section: '#contacto', path: '/', visitor: clean._meta.visitor, session: clean._meta.session, ...place(req) }).catch(() => {});
  return json({ ok: true });
}

function sitemap(content, origin) {
  const urls = ['/', ...content.categories.filter(c => !c.hidden).map(c => `/productos/${c.slug}`), ...content.pages.filter(p => !p.hidden).map(p => `/${p.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${origin}${u}</loc></url>`).join('')}</urlset>`;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    // www.cultura360.cl → cultura360.cl
    // El paso de http a https lo hace Cloudflare (Always Use HTTPS); hacerlo aquí provocaba redirecciones en bucle
    if (url.hostname.startsWith('www.')) { url.hostname = url.hostname.slice(4); return Response.redirect(url.toString(), 301); }
    const db = getDb(env);
    try {
      if (url.pathname.startsWith('/admin/api/')) return await adminApi(req, env, url, db);
      if (url.pathname === '/admin') return Response.redirect(url.origin + '/admin/', 301);
      if (url.pathname.startsWith('/media/') && req.method === 'GET') return await media(req, env, url, db, ctx);
      if (url.pathname === '/api/lead' && req.method === 'POST') return await lead(req, db);
      if (url.pathname === '/api/t' && req.method === 'POST') return await track(req, db, url);
      if (url.pathname === '/api/estado') {
        // Diagnóstico sin datos sensibles: secretos configurados y prueba de cada parte de la base de datos
        const probar = async fn => { try { await fn(); return 'ok'; } catch (e) { return 'error: ' + String(e.message || e).slice(0, 160); } };
        const out = {
          baseDeDatos: env.DATABASE_URL ? 'configurada' : 'falta DATABASE_URL (modo de prueba)',
          claveAdmin: env.ADMIN_PASSWORD ? 'configurada' : 'falta ADMIN_PASSWORD',
          sesion: env.SESSION_SECRET ? 'configurada' : 'falta SESSION_SECRET',
          protocolo: url.protocol, cfVisitor: req.headers.get('CF-Visitor') || null,
        };
        if (env.DATABASE_URL) {
          out.contenido = await probar(() => db.getContent());
          out.imagenes = await probar(() => db.listMedia());
          out.solicitudes = await probar(() => db.listLeads());
          out.visitas = await probar(() => db.listEvents(new Date(Date.now() - 86400000).toISOString()));
        }
        if (env.SESSION_SECRET) {
          out.pruebaSesion = await probar(async () => {
            const c = (await makeCookie(env, true)).split(';')[0];
            if (!(await isAuthed(env, new Request(url.origin, { headers: { Cookie: c } })))) throw new Error('la cookie firmada no se valida');
          });
        }
        return json(out);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método no permitido', { status: 405 });

      // Archivos fijos (back office, imágenes, estilos): pasan por las redirecciones de arriba y luego se entregan tal cual
      if (!url.pathname.startsWith('/productos/') && url.pathname !== '/') {
        const asset = await env.ASSETS.fetch(req);
        if (asset.status !== 404) return asset;
      }
      const { data } = await loadContent(db);
      const content = { ...data, __assetVersion: ASSET_VERSION };
      if (url.pathname === '/robots.txt') return new Response(`User-agent: *\nDisallow: /admin/\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain' } });
      if (url.pathname === '/sitemap.xml') return new Response(sitemap(content, url.origin), { headers: { 'Content-Type': 'application/xml' } });
      const out = renderPath(content, url.pathname, { origin: url.origin });
      return out ? html(out) : html(renderNotFound(content, { origin: url.origin }), 404);
    } catch (e) {
      console.error(e);
      if (url.pathname.startsWith('/admin/api/')) return json({ error: 'Error del servidor: ' + (e.message || e) }, 500);
      return html('<!doctype html><meta charset="utf-8"><title>Error</title><p style="font-family:system-ui;padding:40px">El sitio no está disponible en este momento. Inténtalo de nuevo en unos minutos.</p>', 500, 'no-store');
    }
  },
};
