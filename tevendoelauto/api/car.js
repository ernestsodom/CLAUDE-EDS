import { sql } from '../lib/db.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clp = n => '$' + Math.round(n).toLocaleString('es-CL');

// Página de enlace para compartir un vehículo por WhatsApp y redes: genera una vista
// previa con su foto y precio (el sitio normal usa #auto-id, invisible para esos rastreadores),
// y de inmediato lleva a quien hace clic a la ficha real dentro del sitio.
export default async function handler(req, res) {
  const id = Number(req.query.id);
  const base = `https://${req.headers.host}`;
  const fallback = () => { res.writeHead(302, { Location: `${base}/#vehiculos` }); res.end(); };
  if (!Number.isInteger(id)) return fallback();
  try {
    const rows = await sql()`SELECT marca, modelo, version, anio, km, precio::float8 AS precio, fotos, estado
                              FROM vehicles WHERE id = ${id}`;
    const c = rows[0];
    if (!c) return fallback();
    const title = `${c.marca} ${c.modelo} ${c.version} ${c.anio}`.replace(/\s+/g, ' ').trim();
    const sold = c.estado === 'vendido';
    const desc = sold
      ? `Vehículo vendido · ${esc(title)} · TeVendoElAuto.cl`
      : `${clp(c.precio)} · ${c.anio} · ${Number(c.km).toLocaleString('es-CL')} km · Consignación y venta de vehículos en Santiago, Chile.`;
    const photo = (c.fotos || [])[0] || '/img/hero-truck.jpg';
    const image = /^https?:\/\//.test(photo) ? photo : base + (photo.startsWith('/') ? photo : '/' + photo);
    const target = `${base}/#auto-${id}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<title>${esc(title)} · TeVendoElAuto.cl</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TeVendoElAuto.cl">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${base}/auto/${id}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head><body>
<p>Abriendo <a href="${esc(target)}">${esc(title)}</a> en TeVendoElAuto.cl…</p>
</body></html>`);
  } catch (e) {
    console.error(e);
    fallback();
  }
}
