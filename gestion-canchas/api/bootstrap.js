const { sql, currentUser, visibleUsers, isStaffAtila, send, handler } = require('./_lib');
// Carga inicial: usuario conectado, usuarios visibles y datos de Atila según el rol.
module.exports = handler(async (req, res) => {
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
  const users = await visibleUsers(me);
  let rows = [];
  if (isStaffAtila(me)) rows = await sql`select tipo, data from entidades`;
  else if (me.rol === 'cliente') rows = await sql`select tipo, data from entidades where tipo = 'modelo' or data->>'clienteId' = ${me.id}`;
  const [seq] = await sql`select valor from meta where clave = 'quoteSeq'`;
  const pick = t => rows.filter(r => r.tipo === t).map(r => r.data);
  send(res, 200, { me, users, state: { v: 4, models: pick('modelo'), deals: pick('negocio'), projects: pick('proyecto'), quoteSeq: seq ? seq.valor : 0 } });
});
