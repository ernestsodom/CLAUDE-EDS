import { sql, getSettings, send, clip, DEFAULT_SETTINGS } from '../lib/db.js';
import { checkPassword, issueToken, isAuthed } from '../lib/auth.js';

const ESTADOS_V = ['disponible', 'reservado', 'vendido'];
const ESTADOS_L = ['nuevo', 'contactado', 'negociando', 'cerrado', 'descartado'];
const TZ = 'America/Santiago';


export default async function handler(req, res) {
  const action = req.query.action;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  try {
    if (action === 'login') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
      await new Promise(r => setTimeout(r, 400));
      if (!checkPassword(body.password)) return send(res, 401, { error: 'Contraseña incorrecta.' });
      return send(res, 200, { token: issueToken() });
    }
    if (!isAuthed(req)) return send(res, 401, { error: 'Tu sesión expiró. Vuelve a ingresar.' });
    const db = sql();

    switch (action) {
      case 'stats': return send(res, 200, await stats(db, Math.min(365, Math.max(1, Number(req.query.days) || 30))));

      case 'leads': {
        const rows = await db`SELECT * FROM leads ORDER BY created_at DESC LIMIT 2000`;
        return send(res, 200, { leads: rows });
      }
      case 'lead_update': {
        const estado = ESTADOS_L.includes(body.estado) ? body.estado : null;
        const rows = await db`UPDATE leads SET estado = COALESCE(${estado}, estado), notas = COALESCE(${body.notas ?? null}, notas), updated_at = now()
                              WHERE id = ${Number(body.id)} RETURNING *`;
        return send(res, 200, { lead: rows[0] });
      }
      case 'lead_delete': {
        await db`DELETE FROM leads WHERE id = ${Number(body.id)}`;
        return send(res, 200, { ok: true });
      }

      case 'vehicles': {
        const rows = await db`SELECT id, marca, modelo, version, anio, km, trans, comb, precio::float8 AS precio, tipo, trac, color,
                                     descripcion, equipamiento, fotos, estado, destacado, orden, updated_at FROM vehicles ORDER BY orden, id`;
        return send(res, 200, { vehicles: rows });
      }
      case 'vehicle_save': {
        const v = body.vehicle || {};
        const f = {
          marca: clip(v.marca, 60), modelo: clip(v.modelo, 80), version: clip(v.version, 120),
          anio: parseInt(v.anio) || new Date().getFullYear(), km: parseInt(v.km) || 0, precio: parseInt(v.precio) || 0,
          trans: clip(v.trans, 30) || 'Manual', comb: clip(v.comb, 30) || 'Bencina', tipo: clip(v.tipo, 40) || 'SUV',
          trac: clip(v.trac, 10) || '4x2', color: clip(v.color, 40), descripcion: clip(v.descripcion, 5000),
          equipamiento: JSON.stringify((v.equipamiento || []).map(x => clip(x, 120)).filter(Boolean).slice(0, 40)),
          fotos: JSON.stringify((v.fotos || []).map(x => clip(x, 300)).filter(Boolean).slice(0, 20)),
          estado: ESTADOS_V.includes(v.estado) ? v.estado : 'disponible', destacado: !!v.destacado, orden: parseInt(v.orden) || 0
        };
        if (!f.marca || !f.modelo || !f.precio) return send(res, 400, { error: 'Marca, modelo y precio son obligatorios.' });
        let rows;
        if (v.id) {
          rows = await db`UPDATE vehicles SET marca=${f.marca}, modelo=${f.modelo}, version=${f.version}, anio=${f.anio}, km=${f.km}, precio=${f.precio},
            trans=${f.trans}, comb=${f.comb}, tipo=${f.tipo}, trac=${f.trac}, color=${f.color}, descripcion=${f.descripcion},
            equipamiento=${f.equipamiento}::jsonb, fotos=${f.fotos}::jsonb, estado=${f.estado}, destacado=${f.destacado}, orden=${f.orden}, updated_at=now()
            WHERE id=${Number(v.id)} RETURNING id`;
        } else {
          rows = await db`INSERT INTO vehicles (marca, modelo, version, anio, km, precio, trans, comb, tipo, trac, color, descripcion, equipamiento, fotos, estado, destacado, orden)
            VALUES (${f.marca}, ${f.modelo}, ${f.version}, ${f.anio}, ${f.km}, ${f.precio}, ${f.trans}, ${f.comb}, ${f.tipo}, ${f.trac}, ${f.color}, ${f.descripcion},
            ${f.equipamiento}::jsonb, ${f.fotos}::jsonb, ${f.estado}, ${f.destacado}, ${f.orden}) RETURNING id`;
        }
        return send(res, 200, { id: rows[0]?.id });
      }
      case 'vehicle_estado': {
        if (!ESTADOS_V.includes(body.estado)) return send(res, 400, { error: 'Estado no válido.' });
        await db`UPDATE vehicles SET estado = ${body.estado}, updated_at = now() WHERE id = ${Number(body.id)}`;
        return send(res, 200, { ok: true });
      }
      case 'vehicle_flag': {
        await db`UPDATE vehicles SET destacado = ${!!body.destacado}, updated_at = now() WHERE id = ${Number(body.id)}`;
        return send(res, 200, { ok: true });
      }
      case 'vehicle_delete': {
        await db`DELETE FROM vehicles WHERE id = ${Number(body.id)}`;
        return send(res, 200, { ok: true });
      }

      case 'settings_save': {
        const s = body.settings || {};
        const clean = {};
        for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in s) clean[k] = s[k];
        const json = JSON.stringify(clean);
        if (json.length > 400000) return send(res, 400, { error: 'La configuración es demasiado grande.' });
        await db`INSERT INTO settings (key, value) VALUES ('site', ${json}::jsonb)
                 ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`;
        return send(res, 200, { settings: await getSettings() });
      }

      case 'upload': {
        const m = /^data:(image\/(jpeg|png|webp|svg\+xml|gif));base64,(.+)$/.exec(body.data || '');
        if (!m) return send(res, 400, { error: 'Formato de imagen no soportado.' });
        const bytes = Math.floor(m[3].length * 3 / 4);
        if (bytes > 3_000_000) return send(res, 400, { error: 'La imagen supera 3 MB.' });
        const rows = await db`INSERT INTO media (mime, data, bytes) VALUES (${m[1]}, ${m[3]}, ${bytes}) RETURNING id`;
        return send(res, 200, { url: `/api/media?id=${rows[0].id}` });
      }

      default: return send(res, 404, { error: 'Acción desconocida' });
    }
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Error del servidor: ' + e.message });
  }
}

async function stats(db, days) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [tot, today, daily, vehicles, pages, devices, refs, leadsBy, leadsEstado, leadsDaily] = await Promise.all([
    db`SELECT count(DISTINCT visitor_id)::int AS visitantes, count(DISTINCT session_id)::int AS sesiones,
              count(*) FILTER (WHERE type='pageview')::int AS paginas, count(*) FILTER (WHERE type='whatsapp')::int AS whatsapp,
              count(*) FILTER (WHERE type='vehicle_view')::int AS fichas,
              count(*) FILTER (WHERE type='app_install')::int AS instalaciones,
              count(DISTINCT visitor_id) FILTER (WHERE type='app_open')::int AS usuarios_app
       FROM events WHERE created_at >= ${since}`,
    db`SELECT count(DISTINCT visitor_id)::int AS visitantes FROM events
       WHERE (created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date`,
    db`SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS dia, count(DISTINCT visitor_id)::int AS visitantes,
              count(*) FILTER (WHERE type='pageview')::int AS paginas
       FROM events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 1`,
    db`SELECT v.id, v.marca, v.modelo, v.version, v.anio, v.estado, v.fotos,
              count(e.*) FILTER (WHERE e.type='vehicle_view')::int AS vistas,
              count(e.*) FILTER (WHERE e.type='vehicle_click')::int AS clics,
              count(e.*) FILTER (WHERE e.type='whatsapp')::int AS whatsapp,
              count(e.*) FILTER (WHERE e.type='cotizar_open')::int AS cotizar,
              (SELECT count(*)::int FROM leads l WHERE l.vehicle_id = v.id AND l.created_at >= ${since}) AS contactos
       FROM vehicles v LEFT JOIN events e ON e.vehicle_id = v.id AND e.created_at >= ${since}
       GROUP BY v.id ORDER BY (count(e.*) FILTER (WHERE e.type IN ('vehicle_view','vehicle_click'))) DESC, v.id LIMIT 15`,
    db`SELECT path, count(*)::int AS n FROM events WHERE type='pageview' AND created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    db`SELECT device, count(DISTINCT visitor_id)::int AS n FROM events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    db`SELECT COALESCE(NULLIF(referrer,''),'Directo') AS ref, count(DISTINCT session_id)::int AS n FROM events
       WHERE type='pageview' AND created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    db`SELECT tipo, count(*)::int AS n FROM leads WHERE created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    db`SELECT estado, count(*)::int AS n FROM leads GROUP BY 1`,
    db`SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS dia, count(*)::int AS n FROM leads WHERE created_at >= ${since} GROUP BY 1`
  ]);
  return { days, totales: { ...tot[0], hoy: today[0].visitantes }, daily, vehicles, pages, devices, refs, leadsBy, leadsEstado, leadsDaily };
}
