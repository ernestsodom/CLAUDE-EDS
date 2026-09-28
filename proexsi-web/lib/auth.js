// Sesión del back office: contraseña única (ADMIN_PASSWORD) y cookie firmada con HMAC.
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'px_admin';
const TTL = 60 * 60 * 12; // 12 horas

function secret() {
  const s = process.env.SESSION_SECRET || (process.env.DATABASE_URL ? '' : 'dev-secret');
  if (!s) throw new Error('SESSION_SECRET no está configurada');
  return s;
}
const sign = v => createHmac('sha256', secret()).update(v).digest('base64url');

export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD || (process.env.DATABASE_URL ? '' : 'admin');
  if (!expected || typeof pw !== 'string') return false;
  const a = Buffer.from(pw), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const v = `admin.${exp}`;
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export function isAuthed(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const val = raw.slice(COOKIE.length + 1);
  const i = val.lastIndexOf('.');
  const v = val.slice(0, i), sig = val.slice(i + 1);
  let good;
  try { good = sign(v); } catch { return false; }
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const exp = Number(v.split('.')[1]);
  return exp > Date.now() / 1000;
}
