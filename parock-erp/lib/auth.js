import crypto from 'node:crypto';

const TTL = 8 * 3600; // la sesión expira tras 8 h sin actividad (se renueva en cada carga)

export function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [, salt, h] = String(stored).split('$');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET no configurado');
  return s;
};
const sign = p => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

export function makeToken(uid) {
  const p = Buffer.from(JSON.stringify({ u: uid, e: Math.floor(Date.now() / 1000) + TTL })).toString('base64url');
  return `${p}.${sign(p)}`;
}
export function readToken(t) {
  if (!t) return null;
  const [p, s] = t.split('.');
  if (!p || !s) return null;
  const exp = sign(p);
  if (s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.e > Date.now() / 1000 ? d.u : null; }
  catch { return null; }
}
export const sessionCookie = (token, maxAge = TTL) =>
  `prk_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export async function currentUser(req, sql) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)prk_session=([^;]+)/);
  const uid = readToken(m && m[1]);
  if (!uid) return null;
  const r = await sql`select id, name, role, fin, admin, img from users where id = ${uid} and active`;
  return r[0] || null;
}
