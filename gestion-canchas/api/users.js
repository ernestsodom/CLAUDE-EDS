const { sql, hashPassword, checkPassword, currentUser, visibleUsers, send, handler } = require('./_lib');
const FIELDS = ['usuario', 'email', 'nombre', 'empresa', 'telefono', 'ciudad', 'rol', 'negocios', 'modulos', 'activo'];
// op 'mypw': cambia la propia contraseña. op 'sync': aplica la lista de usuarios editada en pantalla, con permisos:
// el super administrador administra a todos; el equipo solo crea, edita y elimina clientes. `_clave` fija una contraseña nueva.
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const me = await currentUser(req);
  if (!me) return send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
  const body = req.body || {};
  if (body.op === 'mypw') {
    const [row] = await sql`select hash from usuarios where id = ${me.id}`;
    if (!checkPassword(String(body.actual || ''), row.hash)) return send(res, 400, { error: 'La contraseña actual no es correcta.' });
    if (String(body.nueva || '').length < 6) return send(res, 400, { error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    await sql`update usuarios set hash = ${hashPassword(body.nueva)} where id = ${me.id}`;
    return send(res, 200, { ok: true });
  }
  if (body.op !== 'sync' || !Array.isArray(body.users)) return send(res, 400, { error: 'Solicitud no válida.' });
  if (me.rol === 'cliente') return send(res, 403, { error: 'No tienes permiso para administrar usuarios.' });
  const isSuper = me.rol === 'superadmin';
  const canManage = rol => isSuper || rol === 'cliente';
  const visible = await visibleUsers(me), byId = Object.fromEntries(visible.map(u => [u.id, u]));
  const incoming = body.users.filter(u => u && u.id);
  const ids = new Set(incoming.map(u => u.id));
  const errors = [];
  // eliminaciones: usuarios visibles que ya no vienen en la lista
  for (const u of visible) if (!ids.has(u.id) && u.id !== me.id && canManage(u.rol)) await sql`delete from usuarios where id = ${u.id}`;
  for (const u of incoming) {
    const prev = byId[u.id];
    const rol = ['superadmin', 'usuario', 'cliente'].includes(u.rol) ? u.rol : 'cliente';
    if (!canManage(prev ? prev.rol : rol) || !canManage(rol)) continue;
    if (prev && prev.id === me.id && (rol !== me.rol || u.activo === false)) continue; // nadie se quita su propio rol ni se desactiva
    const v = { ...Object.fromEntries(FIELDS.map(k => [k, u[k]])), rol };
    v.usuario = String(v.usuario || v.email || '').trim();
    if (!v.usuario || !v.nombre) { errors.push(`Faltan datos de ${v.usuario || 'un usuario'}.`); continue; }
    const hash = u._clave ? hashPassword(String(u._clave)) : null;
    if (!prev) {
      if (!hash) { errors.push(`Falta la contraseña inicial de ${v.usuario}.`); continue; }
      const [dup] = await sql`select 1 from usuarios where lower(usuario) = lower(${v.usuario}) or (email <> '' and lower(email) = lower(${v.email || ''}))`;
      if (dup) { errors.push(`Ya existe un acceso con ${v.usuario}.`); continue; }
      await sql`insert into usuarios (id, usuario, email, nombre, empresa, telefono, ciudad, rol, negocios, modulos, activo, hash)
        values (${u.id}, ${v.usuario}, ${v.email || ''}, ${v.nombre}, ${v.empresa || ''}, ${v.telefono || ''}, ${v.ciudad || ''}, ${rol},
        ${JSON.stringify(v.negocios || [])}::jsonb, ${v.modulos ? JSON.stringify(v.modulos) : null}::jsonb, ${v.activo !== false}, ${hash})`;
    } else {
      await sql`update usuarios set nombre = ${v.nombre}, email = ${v.email || ''}, empresa = ${v.empresa || ''}, telefono = ${v.telefono || ''}, ciudad = ${v.ciudad || ''},
        rol = ${rol}, negocios = ${JSON.stringify(v.negocios || [])}::jsonb, modulos = ${v.modulos ? JSON.stringify(v.modulos) : null}::jsonb, activo = ${v.activo !== false}
        where id = ${u.id}`;
      if (hash) await sql`update usuarios set hash = ${hash} where id = ${u.id}`;
    }
  }
  // siempre queda al menos un super administrador activo
  const [{ n }] = await sql`select count(*)::int as n from usuarios where rol = 'superadmin' and activo`;
  if (n === 0) { await sql`update usuarios set rol = 'superadmin', activo = true where id = ${me.id}`; errors.push('Debe quedar al menos un super administrador activo.'); }
  send(res, 200, { users: await visibleUsers(me), errors });
});
