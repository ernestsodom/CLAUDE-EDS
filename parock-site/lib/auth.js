import crypto from 'node:crypto';

const COOKIE = 'parock_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días
const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL || 'dev-secret';
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

export function checkPassword(pw) {
  const expected = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  const got = Buffer.from(String(pw || ''));
  return expected.length > 0 && expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

export function setSession(res) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const val = `${exp}.${sign(exp)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function isAdmin(req) {
  const raw = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.status(401).json({ error: 'Sesión expirada. Vuelve a ingresar la clave.' });
  return false;
}

// Protección CSRF básica: las escrituras deben venir del mismo origen.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
