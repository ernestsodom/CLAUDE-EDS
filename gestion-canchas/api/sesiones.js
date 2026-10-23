const { sql, currentUser, closeExpired, IDLE_MIN, send, handler } = require('./_lib');
// Registro de ingresos y salidas. Solo el super administrador.
module.exports = handler(async (req, res) => {
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
  if (me.rol !== 'superadmin') return send(res, 403, { error: 'Solo el super administrador puede ver el registro de sesiones.' });
  await closeExpired();
  const dias = Math.min(Math.max(parseInt(req.query?.dias, 10) || 30, 1), 3650);
  const rows = await sql`select s.id, s.usuario_id, s.inicio, s.ultimo, s.fin, s.motivo, s.ip, s.agente
    from sesiones s where s.inicio > now() - make_interval(days => ${dias}) order by s.inicio desc limit 5000`;
  send(res, 200, { idleMin: IDLE_MIN, dias, sesiones: rows.map(r => ({ id: r.id, usuarioId: r.usuario_id, inicio: r.inicio, ultimo: r.ultimo, fin: r.fin, motivo: r.motivo, ip: r.ip, agente: r.agente })) });
});
