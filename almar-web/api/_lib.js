import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

let _sql;
export function db() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
  if (Buffer.isBuffer(b)) { try { return JSON.parse(b.toString('utf8')); } catch { return {}; } }
  return b;
}

export const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

export function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(data));
}

// Sesión de administración: cookie firmada con HMAC (exp.firma), válida 7 días.
const COOKIE = 'almar_admin';
const sign = (v) => crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(v).digest('base64url');

export function makeSessionCookie() {
  const exp = String(Date.now() + 7 * 864e5);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isAdmin(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function passwordOk(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Clasifica el origen de la visita a partir del referrer y los parámetros de campaña.
export function classifySource({ ref = '', utm = '', click = '' } = {}, host = '') {
  const u = String(utm).toLowerCase();
  const c = String(click).toLowerCase();
  let h = '';
  try { h = ref ? new URL(ref).hostname.toLowerCase() : ''; } catch { h = ''; }
  if (u.includes('google') || c === 'gclid' || /(^|\.)google\.|googleadservices|googlesyndication/.test(h)) return 'google';
  if (u.includes('instagram') || u === 'ig' || /(^|\.)instagram\.com$/.test(h)) return 'instagram';
  if (u.includes('facebook') || u === 'fb' || c === 'fbclid' || /(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
  if (!h || (host && h === host.toLowerCase())) return u ? 'otro' : 'directo';
  return 'otro';
}
