import { db, body, clip, json, classifySource } from './_lib.js';

// Solicitudes de presupuesto desde el formulario de contacto.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const b = body(req);
  if (b.web) return json(res, 200, { ok: true }); // honeypot anti-spam
  const nombre = clip((b.nombre || '').trim(), 120);
  const email = clip((b.email || '').trim(), 160);
  if (!nombre) return json(res, 400, { error: 'Escribe tu nombre para continuar.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return json(res, 400, { error: 'Revisa el correo: falta un formato como nombre@correo.cl.' });
  const source = classifySource(b.src || {}, req.headers.host || '');
  try {
    const sql = db();
    const dup = await sql`SELECT 1 FROM leads WHERE email = ${email} AND created_at > now() - interval '1 minute' LIMIT 1`;
    if (!dup.length) {
      await sql`INSERT INTO leads (nombre, email, whatsapp, tipo, fecha, lugar, mensaje, source)
        VALUES (${nombre}, ${email}, ${clip(b.whatsapp, 40)}, ${clip(b.tipo, 40)}, ${clip(b.fecha, 20)}, ${clip(b.lugar, 160)}, ${clip(b.mensaje, 4000)}, ${source})`;
    }
    json(res, 200, { ok: true });
  } catch (e) {
    console.error('lead', e);
    json(res, 500, { error: 'No pudimos guardar tu mensaje. Intenta de nuevo o escríbenos por WhatsApp.' });
  }
}
