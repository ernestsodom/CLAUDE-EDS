// GET / → sitio público armado con el contenido de la base de datos.
import { getContent } from '../lib/content.js';
import { renderPage } from '../lib/render.js';
import { isAuthed } from '../lib/auth.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const preview = url.searchParams.get('preview') === '1' && isAuthed(req);
    const content = await getContent({ fresh: preview });
    const html = renderPage(content, { preview });
    send(res, 200, html, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': preview ? 'no-store' : 'public, max-age=0, s-maxage=20, stale-while-revalidate=300',
    });
  } catch (e) {
    console.error(e);
    send(res, 500, '<h1>El sitio no está disponible en este momento.</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
  }
}
