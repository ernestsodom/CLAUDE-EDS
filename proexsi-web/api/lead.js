// POST /api/lead → guarda una solicitud de demo del formulario de contacto.
import { hasDb, sql, ensureSchema, mem } from '../lib/db.js';
import { readJson, send, clip } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  try {
    const b = await readJson(req, 20_000);
    const lead = {
      ts: new Date().toISOString(),
      nombre: clip(b.nombre, 120), cargo: clip(b.cargo, 120), institucion: clip(b.institucion, 160),
      correo: clip(b.correo, 160), producto: clip(b.tipo || b.producto, 120), mensaje: clip(b.mensaje, 2000),
      source: clip(req.headers.referer, 200),
    };
    if (!lead.nombre || !lead.correo || !/.+@.+\..+/.test(lead.correo)) return send(res, 400, { error: 'Nombre y correo son obligatorios' });
    if (hasDb()) {
      await ensureSchema();
      await sql()`insert into leads (nombre, cargo, institucion, correo, producto, mensaje, source)
        values (${lead.nombre}, ${lead.cargo}, ${lead.institucion}, ${lead.correo}, ${lead.producto}, ${lead.mensaje}, ${lead.source})`;
    } else {
      mem.leads.unshift({ id: mem.leads.length + 1, ...lead });
    }
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'No se pudo guardar la solicitud' });
  }
}
