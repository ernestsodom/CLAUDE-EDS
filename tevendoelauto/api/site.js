import { sql, getSettings, send } from '../lib/db.js';

// Datos públicos del sitio: configuración + vehículos publicados
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  try {
    const [settings, vehicles] = await Promise.all([
      getSettings(),
      sql()`SELECT id, marca, modelo, version, anio, km, trans, comb, precio::float8 AS precio, tipo, trac, color,
                   descripcion, equipamiento, fotos, estado, destacado, orden
            FROM vehicles ORDER BY orden, id`
    ]);
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    send(res, 200, { settings, vehicles });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'No se pudieron cargar los datos' });
  }
}
