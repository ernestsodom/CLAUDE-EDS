// Servidor local para probar el sitio y el back office sin Vercel (usa almacén en memoria si no hay DATABASE_URL).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path === '/' ) return (await import('../api/render.js')).default(req, res);
    if (path.startsWith('/api/')) return (await import(`../api/${path.slice(5).replace(/[^\w-]/g, '')}.js`)).default(req, res);
    const file = normalize(join(root, 'public', path === '/admin' ? '/admin/index.html' : path));
    if (!file.startsWith(join(root, 'public'))) throw new Error('ruta');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch (e) { res.writeHead(404); res.end('No encontrado'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
