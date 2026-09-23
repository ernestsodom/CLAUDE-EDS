import { sql, send, clip } from '../lib/db.js';

const TIPOS = new Set(['cotizacion', 'visita', 'credito', 'parte_pago', 'venta', 'contacto']);

// Formularios del sitio: cotizaciones, visitas, crédito, parte de pago, venta y contacto
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (b.website) return send(res, 200, { ok: true }); // honeypot anti-spam
    const tipo = TIPOS.has(b.tipo) ? b.tipo : 'contacto';
    const nombre = clip(b.nombre, 120), telefono = clip(b.telefono, 40), email = clip(b.email, 160);
    if (!nombre || (!telefono && !email)) return send(res, 400, { error: 'Indica tu nombre y un teléfono o email.' });
    const datos = {};
    for (const [k, v] of Object.entries(b.datos || {}).slice(0, 20)) datos[clip(k, 40)] = clip(v, 500);
    let vid = Number.isInteger(b.vehicle_id) ? b.vehicle_id : null, label = '';
    if (vid) {
      const r = await sql()`SELECT marca, modelo, version, anio FROM vehicles WHERE id = ${vid}`;
      if (r[0]) label = `${r[0].marca} ${r[0].modelo} ${r[0].version} ${r[0].anio}`.replace(/\s+/g, ' ');
      else vid = null;
    }
    const rows = await sql()`INSERT INTO leads (tipo, nombre, telefono, email, vehicle_id, vehicle_label, mensaje, datos)
      VALUES (${tipo}, ${nombre}, ${telefono}, ${email}, ${vid}, ${label}, ${clip(b.mensaje, 2000)}, ${JSON.stringify(datos)})
      RETURNING id`;
    send(res, 200, { ok: true, id: rows[0].id });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.' });
  }
}
