import { body, json, passwordOk, makeSessionCookie, clearSessionCookie, isAdmin, setPassword } from './_lib.js';

const slow = () => new Promise((r) => setTimeout(r, 700));

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return json(res, 200, { admin: await isAdmin(req) });
    if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearSessionCookie()); return json(res, 200, { ok: true }); }

    // Cambiar contraseña: requiere sesión activa y la contraseña actual
    if (req.method === 'PUT') {
      if (!(await isAdmin(req))) return json(res, 401, { error: 'Sesión expirada. Vuelve a ingresar.' });
      const { current, next } = body(req);
      if (!(await passwordOk(current))) { await slow(); return json(res, 400, { error: 'La contraseña actual no es correcta.' }); }
      if (typeof next !== 'string' || next.length < 8) return json(res, 400, { error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      if (next.length > 128) return json(res, 400, { error: 'La nueva contraseña es demasiado larga (máximo 128 caracteres).' });
      if (next === current) return json(res, 400, { error: 'La nueva contraseña debe ser distinta de la actual.' });
      await setPassword(next);
      res.setHeader('Set-Cookie', await makeSessionCookie()); // esta sesión sigue abierta; las demás se cierran
      return json(res, 200, { ok: true });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
    const { password } = body(req);
    if (!(await passwordOk(password))) { await slow(); return json(res, 401, { error: 'Contraseña incorrecta.' }); }
    res.setHeader('Set-Cookie', await makeSessionCookie());
    json(res, 200, { ok: true });
  } catch (e) {
    console.error('login', e);
    json(res, 500, { error: 'Error del servidor. Intenta de nuevo.' });
  }
}
