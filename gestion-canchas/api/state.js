const { sql, currentUser, isStaffAtila, send, handler } = require('./_lib');
const TIPOS = ['modelo', 'negocio', 'proyecto'];
// Guarda los cambios de datos: { upserts: [{tipo,id,data}], deletes: [{tipo,id}], quoteSeq }.
// El equipo de Atila guarda todo; un cliente solo sus propias solicitudes (negocios con su clienteId).
module.exports = handler(async (req, res) => {
  if (req.method !== 'PUT') return send(res, 405, { error: 'Método no permitido' });
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
  const staff = isStaffAtila(me);
  if (!staff && me.rol !== 'cliente') return send(res, 403, { error: 'No tienes permiso para modificar estos datos.' });
  const { upserts = [], deletes = [], quoteSeq } = req.body || {};
  let skipped = 0;
  const ok = [];
  for (const u of upserts) {
    if (!TIPOS.includes(u.tipo) || !u.id || !u.data) { skipped++; continue; }
    if (!staff && (u.tipo !== 'negocio' || u.data.clienteId !== me.id)) { skipped++; continue; }
    ok.push({ tipo: u.tipo, id: String(u.id), data: u.data });
  }
  if (!staff && ok.length) {
    // Un cliente solo crea solicitudes nuevas o, en las suyas, acepta cotizaciones y agrega historial; el resto se conserva del servidor.
    const prevs = Object.fromEntries((await sql`select id, data from entidades where tipo = 'negocio' and id = any(${ok.map(u => u.id)})`).map(r => [r.id, r.data]));
    for (let i = ok.length - 1; i >= 0; i--) {
      const inc = ok[i].data, prev = prevs[ok[i].id];
      if (!prev) { ok[i].data = { ...inc, clienteId: me.id, portal: true, aceptada: false, etapa: 'nuevo', cotizaciones: [], proyectoId: null }; continue; }
      if (prev.clienteId !== me.id) { ok.splice(i, 1); skipped++; continue; }
      const next = { ...prev, cotizaciones: (prev.cotizaciones || []).map(q => ({ ...q })) };
      for (const q of inc.cotizaciones || []) {
        const pq = next.cotizaciones.find(x => x.id === q.id);
        if (pq && pq.portal && q.estado === 'aceptada' && pq.estado !== 'aceptada') { pq.estado = 'aceptada'; pq.aceptadaEl = q.aceptadaEl; }
      }
      if (inc.etapa === 'negociacion' && ['nuevo', 'propuesta'].includes(next.etapa)) next.etapa = 'negociacion';
      const ph = next.hist || [];
      if (Array.isArray(inc.hist) && inc.hist.length > ph.length) next.hist = [...ph, ...inc.hist.slice(ph.length)];
      next.actualizado = inc.actualizado || next.actualizado;
      ok[i].data = next;
    }
  }
  if (ok.length) await sql`insert into entidades (tipo, id, data, actualizado)
    select x.tipo, x.id, x.data, now() from jsonb_to_recordset(${JSON.stringify(ok)}::jsonb) as x(tipo text, id text, data jsonb)
    on conflict (tipo, id) do update set data = excluded.data, actualizado = now()`;
  if (staff) {
    const del = deletes.filter(d => d && TIPOS.includes(d.tipo) && d.id);
    if (del.length) await sql`delete from entidades e using jsonb_to_recordset(${JSON.stringify(del)}::jsonb) as x(tipo text, id text) where e.tipo = x.tipo and e.id = x.id`;
    if (Number.isInteger(quoteSeq)) await sql`insert into meta (clave, valor) values ('quoteSeq', ${JSON.stringify(quoteSeq)}::jsonb)
      on conflict (clave) do update set valor = greatest((meta.valor)::int, (excluded.valor)::int)::text::jsonb`;
  }
  const saved = ok.length;
  send(res, 200, { saved, skipped });
});
