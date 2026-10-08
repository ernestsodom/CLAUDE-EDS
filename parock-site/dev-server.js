// Servidor local que imita el enrutamiento de Vercel (solo para pruebas).
if (process.env.DEV_MOCK_DB) await import('./dev-mock.js');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = u.pathname;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  res.send = (b) => res.end(b);
  if (p === '/admin') p = '/admin/index.html';
  if (p.startsWith('/static/') || p.startsWith('/admin/')) {
    const f = path.join(root, p);
    if (f.startsWith(root) && fs.existsSync(f)) { res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); return fs.createReadStream(f).pipe(res); }
    res.statusCode = 404; return res.end();
  }
  let fn = p.startsWith('/api/') ? p.slice(5) : 'page';
  if (fn === 'page' && !p.startsWith('/api/')) u.searchParams.set('path', p.slice(1));
  req.query = Object.fromEntries(u.searchParams);
  const chunks = []; for await (const c of req) chunks.push(c);
  try { req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; } catch { req.body = {}; }
  try { const mod = await import(path.join(root, 'api', fn + '.js')); await mod.default(req, res); }
  catch (e) { console.error(e); res.statusCode = 500; res.end(String(e)); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
