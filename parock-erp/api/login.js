import { sql } from '../lib/db.js';
import { verifyPassword, makeToken, sessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { user, password } = req.body || {};
  const id = String(user || '').trim().toLowerCase().slice(0, 40);
  const r = await sql`select id, pass_hash from users where id = ${id} and active`;
  const ok = r[0] && verifyPassword(String(password || ''), r[0].pass_hash);
  if (!ok) {
    await new Promise(z => setTimeout(z, 700));
    await sql`insert into audit_log(user_id, record, detail) values (${id}, 'Sesión', 'Intento de inicio de sesión fallido')`;
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  await sql`insert into audit_log(user_id, record, detail) values (${id}, 'Sesión', 'Inicio de sesión')`;
  res.setHeader('Set-Cookie', sessionCookie(makeToken(id)));
  res.json({ ok: true });
}
