const crypto = require('crypto');
const { sql, currentUser, isStaffAtila, send, handler } = require('./_lib');
// Abre una cotización: { qid, clave }. Si está protegida exige su clave (sirve para el enlace público y para el portal);
// si no lo está, solo la ve el equipo, el cliente dueño (publicada en el portal) o un usuario con quien se compartió.
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const qid = String(req.body?.qid || ''), clave = String(req.body?.clave || '');
  const [row] = await sql`select data from entidades where tipo = 'negocio' and data->'cotizaciones' @> ${JSON.stringify([{ id: qid }])}::jsonb limit 1`;
  const d = row && row.data, q = d && (d.cotizaciones || []).find(x => x.id === qid);
  if (!q) return send(res, 404, { error: 'La cotización no existe o ya no está disponible.' });
  const me = await currentUser(req).catch(() => null);
  const staff = me && isStaffAtila(me);
  if (q.share && q.share.hash && !staff) {
    const h = crypto.createHash('sha256').update(`cot|${q.share.salt}|${clave}`).digest('hex');
    if (h.length !== q.share.hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(q.share.hash))) {
      await new Promise(r => setTimeout(r, 600));
      return send(res, 403, { error: 'Clave incorrecta.' });
    }
  } else if (!staff && !(me && ((d.clienteId === me.id && q.portal) || (q.compartidaCon || []).includes(me.id)))) {
    return send(res, 404, { error: 'La cotización no existe o ya no está disponible.' });
  }
  const { share, compartidaCon, ...qPub } = q;
  const dz = q.dz || d.dz || {};
  const strip = f => f ? { name: f.name, type: f.type, size: f.size } : null;
  const models = (await sql`select data from entidades where tipo = 'modelo'`).map(r => r.data);
  send(res, 200, {
    d: { id: d.id, cliente: d.cliente, contacto: d.contacto, email: d.email, telefono: d.telefono, ciudad: d.ciudad, prov: d.prov, comuna: d.comuna,
      canchas: d.canchas, instal: d.instal, modelo: d.modelo, clienteId: d.clienteId },
    q: { ...qPub, dz: { ...dz, logo: strip(dz.logo), mapa: strip(dz.mapa) } }, models
  });
});
