import crypto from 'node:crypto';

const TTL = 1000 * 60 * 60 * 24 * 7; // 7 días
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(pw || '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken() {
  const payload = String(Date.now() + TTL);
  return `${payload}.${sign(payload)}`;
}

export function isAuthed(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !secret()) return false;
  const good = sign(payload);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return false;
  return Number(payload) > Date.now();
}
