const { currentUser, send, handler } = require('./_lib');
// Señal de actividad (clics o teclas): mantiene abierta la sesión mientras el usuario trabaja.
module.exports = handler(async (req, res) => {
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión cerrada por inactividad. Vuelve a ingresar.' });
  send(res, 200, { ok: true });
});
