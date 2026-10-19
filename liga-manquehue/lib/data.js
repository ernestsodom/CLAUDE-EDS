import { sql } from './db';

export async function getTeams(cat) {
  return sql`SELECT * FROM teams WHERE category = ${cat} ORDER BY name`;
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
      { id: t.id, name: t.name, pj: t.base_pj, pg: t.base_pg, pe: t.base_pe, pp: t.base_pp, gf: t.base_gf, gc: t.base_gc, desc: 0 },
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
    .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.name.localeCompare(b.name));
}

// Fechas con sus partidos, ordenadas por número de fecha
export async function getRounds(cat) {
  const [rounds, matches] = await Promise.all([
    sql`SELECT * FROM rounds WHERE category = ${cat} ORDER BY number`,
    sql`SELECT m.*, h.name AS home_name, a.name AS away_name
        FROM matches m
        JOIN rounds r ON r.id = m.round_id
        JOIN teams h ON h.id = m.home_team_id
        JOIN teams a ON a.id = m.away_team_id
        WHERE r.category = ${cat}
        ORDER BY m.time NULLS LAST, m.id`,
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
