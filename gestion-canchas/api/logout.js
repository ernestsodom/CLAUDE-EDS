const { sql, readToken, send, handler } = require('./_lib');
// Salida: cierra la sesión del token. El motivo es «salida» (botón Salir) o «inactividad» (1 hora sin clics).
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const t = readToken(req), motivo = req.body?.motivo === 'inactividad' ? 'inactividad' : 'salida';
  if (t && t.sid) await sql`update sesiones set fin = now(), motivo = ${motivo} where id = ${t.sid} and usuario_id = ${t.uid} and fin is null`;
  send(res, 200, { ok: true });
});
