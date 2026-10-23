const { sql, checkPassword, issueToken, openSession, send, handler } = require('./_lib');
// Ingreso con usuario (equipo) o correo (clientes) y contraseña.
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const usuario = String(req.body?.usuario || '').trim().toLowerCase(), clave = String(req.body?.clave || '');
  const [u] = await sql`select * from usuarios where lower(usuario) = ${usuario} or lower(email) = ${usuario} limit 1`;
  if (!u || !checkPassword(clave, u.hash)) return send(res, 401, { error: 'Usuario, correo o contraseña incorrectos.' });
  if (!u.activo) return send(res, 403, { error: 'Este acceso está desactivado. Comunícate con ATILA para reactivarlo.' });
  send(res, 200, { token: issueToken(u.id, await openSession(req, u.id)) });
});
