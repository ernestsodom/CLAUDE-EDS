import { getContent } from '../lib/db.js';
import { renderPage } from '../static/render.js';

export default async function handler(req, res) {
  const path = typeof req.query.path === 'string' ? '/' + req.query.path : '/';
  const { data } = await getContent();
  const out = renderPage(data, path);
  if (out.status === 302) { res.setHeader('Location', out.location); return res.status(302).end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60');
  res.status(out.status).send(out.html);
}
