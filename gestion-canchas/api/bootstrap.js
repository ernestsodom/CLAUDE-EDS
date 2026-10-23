const { sql, currentUser, visibleUsers, isStaffAtila, send, handler } = require('./_lib');
// Carga inicial: usuario conectado, usuarios visibles y datos de Atila según el rol.
// Lo que ve un cliente de un negocio: sus cotizaciones publicadas (o las compartidas con él); las protegidas
// llegan sin precios hasta que ingrese la clave. De un negocio ajeno solo recibe la cotización compartida.
function forClient(d, me) {
  const own = d.clienteId === me.id;
  const qs = (d.cotizaciones || []).filter(q => (own && q.portal) || (q.compartidaCon || []).includes(me.id)).map(q => {
    const { share, compartidaCon, ...rest } = q;
    return share && share.hash ? { id: q.id, numero: q.numero, fecha: q.fecha, validez: q.validez, moneda: q.moneda, estado: q.estado, portal: q.portal,
      compartidaCon: (compartidaCon || []).includes(me.id) ? [me.id] : [], protegida: true, items: [], notas: '' } : { ...rest, compartidaCon: (compartidaCon || []).includes(me.id) ? [me.id] : [] };
  });
  if (own) return { ...d, cotizaciones: qs };
  return { id: d.id, cliente: d.cliente, contacto: d.contacto, ciudad: d.ciudad, prov: d.prov, comuna: d.comuna, canchas: d.canchas, instal: d.instal,
    modelo: d.modelo, dz: d.dz, etapa: d.etapa, creado: d.creado, actualizado: d.actualizado, clienteId: d.clienteId, compartida: true, hist: [], cotizaciones: qs };
}
module.exports = handler(async (req, res) => {
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
  const users = await visibleUsers(me);
  let rows = [];
  if (isStaffAtila(me)) rows = await sql`select tipo, data from entidades`;
  else if (me.rol === 'cliente') {
    rows = await sql`select tipo, data from entidades where tipo = 'modelo' or data->>'clienteId' = ${me.id}
      or (tipo = 'negocio' and data->'cotizaciones' @> ${JSON.stringify([{ compartidaCon: [me.id] }])}::jsonb)`;
    rows = rows.map(r => r.tipo === 'negocio' ? { tipo: r.tipo, data: forClient(r.data, me) } : r);
  }
  const [seq] = await sql`select valor from meta where clave = 'quoteSeq'`;
  const pick = t => rows.filter(r => r.tipo === t).map(r => r.data);
  send(res, 200, { me, users, state: { v: 4, models: pick('modelo'), deals: pick('negocio'), projects: pick('proyecto'), quoteSeq: seq ? seq.valor : 0 } });
});
