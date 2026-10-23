// Utilidades compartidas de la API: conexión a Neon, contraseñas y sesión firmada.
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.SESSION_SECRET;
const SESSION_HOURS = 12;
const IDLE_MIN = 60; // sin actividad durante este tiempo la sesión se cierra

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `s1:${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [v, salt, hex] = String(stored || '').split(':');
  if (v !== 's1' || !salt || !hex) return false;
  const a = crypto.scryptSync(pw, salt, 32), b = Buffer.from(hex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const b64 = s => Buffer.from(s).toString('base64url');
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function issueToken(uid, sid) {
  const body = b64(JSON.stringify({ uid, sid, exp: Date.now() + SESSION_HOURS * 3600e3 }));
  return `${body}.${sign(body)}`;
}
function readToken(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
}

const fromRow = r => ({ id: r.id, usuario: r.usuario, email: r.email || '', nombre: r.nombre, empresa: r.empresa || '', telefono: r.telefono || '',
  ciudad: r.ciudad || '', rol: r.rol, negocios: r.negocios || [], modulos: r.modulos || undefined, activo: r.activo });

// Registro de sesiones: cada ingreso abre una fila; la salida, o una hora sin actividad, la cierra.
const ipOf = req => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || null;
async function openSession(req, uid) {
  const sid = crypto.randomBytes(12).toString('base64url');
  await sql`insert into sesiones (id, usuario_id, inicio, ultimo, ip, agente) values (${sid}, ${uid}, now(), now(), ${ipOf(req)}, ${String(req.headers['user-agent'] || '').slice(0, 300)})`;
  return sid;
}
async function closeExpired() {
  await sql`update sesiones set fin = ultimo + make_interval(mins => ${IDLE_MIN}), motivo = 'inactividad'
    where fin is null and ultimo < now() - make_interval(mins => ${IDLE_MIN})`;
}
async function currentUser(req) {
  const t = readToken(req);
  if (!t || !t.sid) return null;
  const [s] = await sql`select fin, ultimo < now() - make_interval(mins => ${IDLE_MIN}) as vencida from sesiones where id = ${t.sid} and usuario_id = ${t.uid}`;
  if (!s || s.fin) return null;
  if (s.vencida) { await closeExpired(); return null; }
  await sql`update sesiones set ultimo = now() where id = ${t.sid} and ultimo < now() - interval '1 minute'`;
  const [r] = await sql`select * from usuarios where id = ${t.uid} and activo`;
  return r ? fromRow(r) : null;
}
// Usuarios que puede ver quien consulta: el super administrador ve todos; el equipo ve los clientes y a sí mismo; el cliente solo a sí mismo.
async function visibleUsers(me) {
  const rows = await sql`select * from usuarios order by creado`;
  return rows.map(fromRow).filter(u => me.rol === 'superadmin' || u.id === me.id || (me.rol === 'usuario' && u.rol === 'cliente'));
}
const isStaffAtila = me => me.rol === 'superadmin' || (me.rol === 'usuario' && me.negocios.includes('atila'));

function send(res, status, data) { res.status(status).setHeader('Cache-Control', 'no-store'); res.json(data); }
function handler(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { console.error(e); send(res, 500, { error: 'Error del servidor. Intenta de nuevo.' }); }
  };
}
module.exports = { sql, hashPassword, checkPassword, issueToken, readToken, openSession, closeExpired, IDLE_MIN, currentUser, visibleUsers, isStaffAtila, send, handler };
