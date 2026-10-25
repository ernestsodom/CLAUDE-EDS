import { sql } from './db';
import { isoDate } from './format';

// Sin las columnas pesadas (escudo y foto en base64)
export async function getTeams(cat) {
  return sql`SELECT id, category, name, info, base_pj, base_pg, base_pe, base_pp, base_gf, base_gc,
                    fp_ta, fp_tr, fp_pts, logo IS NOT NULL AS has_logo, photo IS NOT NULL AS has_photo
             FROM teams WHERE category = ${cat} ORDER BY name`;
}

export async function getStandings(cat) {
  const [teams, matches, sanctions] = await Promise.all([
    getTeams(cat),
    sql`SELECT m.home_team_id, m.away_team_id, m.home_goals, m.away_goals
        FROM matches m JOIN rounds r ON r.id = m.round_id
        WHERE r.category = ${cat} AND m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL`,
    sql`SELECT team_id, SUM(points_deducted)::int AS pts FROM sanctions
        WHERE category = ${cat} AND team_id IS NOT NULL GROUP BY team_id`,
  ]);

  const rows = new Map(
    teams.map((t) => [
      t.id,
      { id: t.id, name: t.name, has_logo: t.has_logo, fp: t.fp_pts, fp_tr: t.fp_tr, pj: t.base_pj, pg: t.base_pg, pe: t.base_pe, pp: t.base_pp, gf: t.base_gf, gc: t.base_gc, desc: 0 },
    ])
  );

  const add = (id, gf, gc) => {
    const r = rows.get(id);
    if (!r) return;
    r.pj++; r.gf += gf; r.gc += gc;
    if (gf > gc) r.pg++; else if (gf === gc) r.pe++; else r.pp++;
  };
  for (const m of matches) {
    add(m.home_team_id, m.home_goals, m.away_goals);
    add(m.away_team_id, m.away_goals, m.home_goals);
  }
  for (const s of sanctions) {
    const r = rows.get(s.team_id);
    if (r) r.desc = s.pts;
  }

  return [...rows.values()]
    .map((r) => ({ ...r, pts: r.pg * 3 + r.pe - r.desc, dif: r.gf - r.gc }))
    // Empate en puntos: define el mejor fair play (menos puntos, luego menos rojas); después diferencia y goles a favor
    .sort((a, b) => b.pts - a.pts || a.fp - b.fp || a.fp_tr - b.fp_tr || b.dif - a.dif || b.gf - a.gf || a.name.localeCompare(b.name));
}

// Fechas con sus partidos, ordenadas por número de fecha
export async function getRounds(cat) {
  const [rounds, matches] = await Promise.all([
    sql`SELECT * FROM rounds WHERE category = ${cat} ORDER BY date NULLS LAST, number, id`,
    sql`SELECT m.*, COALESCE(h.name, m.home_label, 'Por definir') AS home_name,
               COALESCE(a.name, m.away_label, 'Por definir') AS away_name,
               h.logo IS NOT NULL AS home_logo, a.logo IS NOT NULL AS away_logo
        FROM matches m
        JOIN rounds r ON r.id = m.round_id
        LEFT JOIN teams h ON h.id = m.home_team_id
        LEFT JOIN teams a ON a.id = m.away_team_id
        WHERE r.category = ${cat}
        ORDER BY m.id`,
  ]);
  return rounds.map((r) => ({ ...r, matches: matches.filter((m) => m.round_id === r.id) }));
}

export async function getSanctions(cat) {
  return sql`SELECT s.*, t.name AS team_name FROM sanctions s
             LEFT JOIN teams t ON t.id = s.team_id
             WHERE s.category = ${cat} ORDER BY s.created_at DESC`;
}

export async function getAnnouncements(cat, limit = 100) {
  return sql`SELECT * FROM announcements WHERE category IS NULL OR category = ${cat}
             ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function getPhotos(cat) {
  return sql`SELECT id, caption, created_at FROM photos WHERE category IS NULL OR category = ${cat}
             ORDER BY created_at DESC`;
}

export async function getTeamsWithPlayers(cat) {
  const [teams, players] = await Promise.all([
    getTeams(cat),
    sql`SELECT p.* FROM players p JOIN teams t ON t.id = p.team_id
        WHERE t.category = ${cat} ORDER BY p.number NULLS LAST, p.name`,
  ]);
  return teams.map((t) => ({ ...t, players: players.filter((p) => p.team_id === t.id) }));
}

// Tabla de goleadores: goles previos + goles cargados en partidos
export async function getScorers(cat, limit = 50) {
  return sql`SELECT p.id, p.name, t.name AS team_name,
                    (p.base_goals + COALESCE(SUM(g.count), 0))::int AS goals
             FROM players p
             JOIN teams t ON t.id = p.team_id
             LEFT JOIN goals g ON g.player_id = p.id
             WHERE t.category = ${cat}
             GROUP BY p.id, t.name
             HAVING p.base_goals + COALESCE(SUM(g.count), 0) > 0
             ORDER BY goals DESC, p.name
             LIMIT ${limit}`;
}

// Goles por partido: { [match_id]: [{ id, player_id, name, team_id, count }] }
export async function getGoalsByMatch(cat) {
  const rows = await sql`SELECT g.id, g.match_id, g.count, p.id AS player_id, p.name, p.team_id
                         FROM goals g
                         JOIN players p ON p.id = g.player_id
                         JOIN matches m ON m.id = g.match_id
                         JOIN rounds r ON r.id = m.round_id
                         WHERE r.category = ${cat}
                         ORDER BY g.id`;
  const map = {};
  for (const g of rows) (map[g.match_id] ??= []).push(g);
  return map;
}

// Próxima fecha: la primera desde hoy (hora de Chile)
export function nextRound(rounds) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  return rounds.find((r) => r.date && isoDate(r.date) >= today) ?? rounds.find((r) => !r.date);
}

export async function getFairPlay(cat) {
  return sql`SELECT id, name, fp_ta, fp_tr, fp_pts FROM teams WHERE category = ${cat} ORDER BY fp_pts, fp_tr, fp_ta, name`;
}

export async function getDocuments() {
  return sql`SELECT id, section, title, position FROM documents ORDER BY position, id`;
}

export async function getPage(slug) {
  const [page] = await sql`SELECT * FROM pages WHERE slug = ${slug}`;
  return page ?? { slug, title: slug, body: '' };
}

export async function getPages() {
  return sql`SELECT * FROM pages ORDER BY slug`;
}
