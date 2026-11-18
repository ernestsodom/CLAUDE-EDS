import { sessionCookie } from '../lib/auth.js';
export default function handler(req, res) {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ ok: true });
}
