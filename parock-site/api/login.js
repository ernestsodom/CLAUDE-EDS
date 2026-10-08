import { checkPassword, setSession, clearSession, isAdmin, sameOrigin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: isAdmin(req) });
  if (req.method === 'DELETE') { clearSession(res); return res.status(200).json({ ok: true }); }
  if (req.method !== 'POST' || !sameOrigin(req)) return res.status(405).json({ error: 'Método no permitido' });
  if (!checkPassword(req.body?.password)) {
    await new Promise((r) => setTimeout(r, 700)); // frena intentos repetidos
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  setSession(res);
  res.status(200).json({ ok: true });
}
