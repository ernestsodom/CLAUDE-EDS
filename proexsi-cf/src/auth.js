// Sesión del back office: cookie firmada con HMAC-SHA256 (SESSION_SECRET).
const enc = new TextEncoder();
const COOKIE = 'px_admin';
const MAX_AGE = 60 * 60 * 12; // 12 horas

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}

function safeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

// Quita espacios, saltos de línea y comillas que suelen colarse al pegar la clave en el panel
const clean = v => String(v ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();

export const config = env => ({
  password: clean(env.ADMIN_PASSWORD) || (env.DATABASE_URL ? '' : 'admin'),
  secret: env.SESSION_SECRET || (env.DATABASE_URL ? '' : 'dev-secret'),
});

export async function checkPassword(env, pw) {
  const { password } = config(env);
  return !!password && safeEqual(clean(pw), password);
}

export async function makeCookie(env, secure) {
  const { secret } = config(env);
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const val = `${exp}.${await hmac(secret, 'admin.' + exp)}`;
  return `${COOKIE}=${val}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export const clearCookie = secure => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;

export async function isAuthed(env, req) {
  const { secret } = config(env);
  if (!secret) return false;
  const m = (req.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(secret, 'admin.' + exp));
}
