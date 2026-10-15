import { db, body, clip, json, isAdmin } from './_lib.js';

const KEY = /^[a-z0-9_]{1,40}$/;
const STATUSES = new Set(['nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado']);
const TZ = 'America/Santiago';

export default async function handler(req, res) {
  if (!(await isAdmin(req))) return json(res, 401, { error: 'Sesión expirada. Vuelve a ingresar.' });
  const action = req.query.action;
  const sql = db();
  try {
    if (req.method === 'GET' && action === 'stats') return json(res, 200, await stats(sql, req.query.days));
    if (req.method === 'GET' && action === 'leads') {
      const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000`;
      return json(res, 200, { leads: rows });
    }
    if (req.method === 'GET' && action === 'content') {
      const [content, galleries] = await Promise.all([
        sql`SELECT key, value, updated_at FROM content`,
        sql`SELECT key, data FROM galleries`
      ]);
      return json(res, 200, {
        content: Object.fromEntries(content.map((r) => [r.key, r.value])),
        galleries: Object.fromEntries(galleries.map((r) => [r.key, r.data]))
      });
    }
    if (req.method === 'POST' && action === 'content') {
      const { set = {}, reset = [] } = body(req);
      const entries = Object.entries(set).filter(([k, v]) => KEY.test(k) && typeof v === 'string');
      const resets = (Array.isArray(reset) ? reset : []).filter((k) => KEY.test(k));
      const q = [];
      for (const [k, v] of entries) {
        q.push(sql`INSERT INTO content (key, value) VALUES (${k}, ${v.slice(0, 6000)})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
      }
      if (resets.length) q.push(sql`DELETE FROM content WHERE key = ANY(${resets})`);
      if (q.length) await sql.transaction(q);
      return json(res, 200, { ok: true, saved: entries.length, reset: resets.length });
    }
    if (req.method === 'POST' && action === 'gallery') {
      const { key, data } = body(req);
      if (!KEY.test(key || '') || typeof data !== 'object' || !data) return json(res, 400, { error: 'Datos inválidos.' });
      const clean = {
        title: clip(data.title, 80) || undefined,
        intro: clip(data.intro, 600) || '',
        visible: data.visible !== false,
        order: Number.isFinite(+data.order) ? +data.order : undefined,
        cover: clip(data.cover, 300) || undefined,
        hidden: (Array.isArray(data.hidden) ? data.hidden : []).slice(0, 2000).map((x) => clip(x, 300)),
        extra: (Array.isArray(data.extra) ? data.extra : []).filter((u) => /^https:\/\/\S+$/i.test(u)).slice(0, 500).map((x) => clip(x, 500))
      };
      await sql`INSERT INTO galleries (key, data) VALUES (${key}, ${JSON.stringify(clean)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'lead') {
      const { id, status, notas } = body(req);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'Solicitud inválida.' });
      if (status !== undefined && !STATUSES.has(status)) return json(res, 400, { error: 'Estado inválido.' });
      const rows = await sql`UPDATE leads SET
          status = COALESCE(${status ?? null}, status),
          notas = COALESCE(${notas === undefined ? null : clip(notas, 4000)}, notas)
        WHERE id = ${id} RETURNING *`;
      return json(res, 200, { lead: rows[0] || null });
    }
    if (req.method === 'DELETE' && action === 'lead') {
      const id = parseInt(req.query.id, 10);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'Solicitud inválida.' });
      await sql`DELETE FROM leads WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Acción desconocida.' });
  } catch (e) {
    console.error('admin', action, e);
    return json(res, 500, { error: 'Error del servidor. Intenta de nuevo.' });
  }
}

async function stats(sql, daysParam) {
  const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const prevSince = new Date(Date.now() - 2 * days * 864e5).toISOString();

  const [totals, prevTotals, sources, daily, pages, clicks, devices, funnel, leadsBySource, leadCount, prevLeadCount, newLeads] = await Promise.all([
    sql`WITH s AS (
          SELECT sid, max(vid) vid,
                 count(*) FILTER (WHERE type = 'pageview') pv,
                 coalesce(sum(duration_ms) FILTER (WHERE type = 'leave'), 0) dur
          FROM events WHERE ts >= ${since} GROUP BY sid)
        SELECT count(*)::int sessions, count(DISTINCT vid)::int visitors,
               coalesce(sum(pv), 0)::int pageviews,
               coalesce(avg(dur), 0)::float avg_ms,
               coalesce(avg((pv <= 1)::int), 0)::float bounce
        FROM s WHERE pv > 0`,
    sql`SELECT count(DISTINCT sid)::int sessions FROM events WHERE type = 'pageview' AND ts >= ${prevSince} AND ts < ${since}`,
    sql`SELECT source, count(DISTINCT sid)::int sessions FROM events
        WHERE type = 'pageview' AND ts >= ${since} GROUP BY source`,
    sql`SELECT to_char(date_trunc('day', ts AT TIME ZONE ${TZ}), 'YYYY-MM-DD') d,
               count(DISTINCT sid)::int sessions, count(*)::int pageviews
        FROM events WHERE type = 'pageview' AND ts >= ${since} GROUP BY 1 ORDER BY 1`,
    sql`SELECT path, count(*) FILTER (WHERE type = 'pageview')::int views,
               coalesce(avg(duration_ms) FILTER (WHERE type = 'leave'), 0)::float avg_ms
        FROM events WHERE ts >= ${since} AND path IS NOT NULL GROUP BY path
        HAVING count(*) FILTER (WHERE type = 'pageview') > 0 ORDER BY views DESC LIMIT 12`,
    sql`SELECT label, count(*)::int n FROM events WHERE type = 'click' AND ts >= ${since} GROUP BY label ORDER BY n DESC`,
    sql`SELECT device, count(DISTINCT sid)::int sessions FROM events WHERE type = 'pageview' AND ts >= ${since} GROUP BY device`,
    sql`SELECT count(DISTINCT sid)::int sessions,
               count(DISTINCT sid) FILTER (WHERE path LIKE 'galeria%')::int galleries,
               count(DISTINCT sid) FILTER (WHERE path = 'contacto')::int contact
        FROM events WHERE type = 'pageview' AND ts >= ${since}`,
    sql`SELECT coalesce(source, 'directo') source, count(*)::int n FROM leads WHERE created_at >= ${since} GROUP BY 1`,
    sql`SELECT count(*)::int n FROM leads WHERE created_at >= ${since}`,
    sql`SELECT count(*)::int n FROM leads WHERE created_at >= ${prevSince} AND created_at < ${since}`,
    sql`SELECT count(*)::int n FROM leads WHERE status = 'nuevo'`
  ]);

  return {
    days,
    totals: { ...totals[0], prev_sessions: prevTotals[0].sessions, leads: leadCount[0].n, prev_leads: prevLeadCount[0].n, new_leads: newLeads[0].n },
    sources: Object.fromEntries(sources.map((r) => [r.source, r.sessions])),
    leadsBySource: Object.fromEntries(leadsBySource.map((r) => [r.source, r.n])),
    daily, pages, clicks, devices,
    funnel: funnel[0]
  };
}
