import { body, json, passwordOk, makeSessionCookie, clearSessionCookie, isAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { admin: isAdmin(req) });
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearSessionCookie()); return json(res, 200, { ok: true }); }
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const { password } = body(req);
  if (!passwordOk(password)) {
    await new Promise((r) => setTimeout(r, 700));
    return json(res, 401, { error: 'Contraseña incorrecta.' });
  }
  res.setHeader('Set-Cookie', makeSessionCookie());
  json(res, 200, { ok: true });
}
