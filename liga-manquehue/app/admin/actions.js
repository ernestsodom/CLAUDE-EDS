'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { COOKIE, token, requireAdmin } from '@/lib/auth';

const CATS = ['tc', 'senior'];
const int = (v) => (v === '' || v == null ? null : Number.parseInt(v, 10));
const txt = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const cat = (v) => (CATS.includes(v) ? v : 'tc');
const catOrAll = (v) => (CATS.includes(v) ? v : null);
const done = () => revalidatePath('/', 'layout');
const dataUrl = (v) => {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(typeof v === 'string' ? v : '');
  return m && { mime: m[1], data: m[2] };
};
const matchSide = (form, side) => {
  const team = int(form.get(side));
  return [team || null, team ? null : txt(form.get(`${side}_label`))];
};

// ---------- Sesión ----------
export async function login(_prev, form) {
  if (!process.env.ADMIN_PASSWORD) return 'Falta configurar ADMIN_PASSWORD en Vercel.';
  if (form.get('password') !== process.env.ADMIN_PASSWORD) return 'Clave incorrecta.';
  const jar = await cookies();
  jar.set(COOKIE, token(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect('/admin/login');
}

export async function setAdminCat(form) {
  await requireAdmin();
  (await cookies()).set('admin_cat', cat(form.get('cat')), { path: '/admin', maxAge: 60 * 60 * 24 * 365 });
  done();
}

// ---------- Equipos y jugadores ----------
export async function addTeam(form) {
  await requireAdmin();
  const name = txt(form.get('name'));
  if (!name) return;
  await sql`INSERT INTO teams (category, name) VALUES (${cat(form.get('category'))}, ${name.toUpperCase()})
            ON CONFLICT DO NOTHING`;
  done();
}

export async function updateTeam(form) {
  await requireAdmin();
  const f = (k) => int(form.get(k)) ?? 0;
  const id = int(form.get('id'));
  await sql`UPDATE teams SET name = ${txt(form.get('name'))?.toUpperCase()}, info = ${txt(form.get('info'))},
              base_pj = ${f('base_pj')}, base_pg = ${f('base_pg')}, base_pe = ${f('base_pe')},
              base_pp = ${f('base_pp')}, base_gf = ${f('base_gf')}, base_gc = ${f('base_gc')},
              fp_ta = ${f('fp_ta')}, fp_tr = ${f('fp_tr')}, fp_pts = ${f('fp_pts')}
            WHERE id = ${id}`;
  const logo = dataUrl(form.get('logo'));
  if (logo) await sql`UPDATE teams SET logo = ${logo.data}, logo_mime = ${logo.mime} WHERE id = ${id}`;
  const photo = dataUrl(form.get('photo'));
  if (photo) await sql`UPDATE teams SET photo = ${photo.data}, photo_mime = ${photo.mime} WHERE id = ${id}`;
  done();
}

export async function deleteTeam(form) {
  await requireAdmin();
  await sql`DELETE FROM teams WHERE id = ${int(form.get('id'))}`;
  done();
}

// Acepta varios jugadores, uno por línea. Opcional: número al inicio ("10 Juan Pérez").
export async function addPlayers(form) {
  await requireAdmin();
  const teamId = int(form.get('team_id'));
  const lines = String(form.get('names') || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d{1,3})[\s.\-)]+(.+)$/);
    const number = m ? Number(m[1]) : null;
    const name = m ? m[2].trim() : line;
    await sql`INSERT INTO players (team_id, name, number) VALUES (${teamId}, ${name}, ${number})`;
  }
  done();
}

export async function deletePlayer(form) {
  await requireAdmin();
  await sql`DELETE FROM players WHERE id = ${int(form.get('id'))}`;
  done();
}

// ---------- Fixture ----------
export async function addRound(form) {
  await requireAdmin();
  const c = cat(form.get('category'));
  let number = int(form.get('number'));
  if (!number) {
    const [{ next }] = await sql`SELECT COALESCE(MAX(number), 0)::int + 1 AS next FROM rounds WHERE category = ${c}`;
    number = next;
  }
  await sql`INSERT INTO rounds (category, number, name, date, notes)
            VALUES (${c}, ${number}, ${txt(form.get('name'))}, ${txt(form.get('date'))}, ${txt(form.get('notes'))})`;
  done();
}

export async function updateRound(form) {
  await requireAdmin();
  await sql`UPDATE rounds SET number = ${int(form.get('number')) ?? 0}, name = ${txt(form.get('name'))},
              date = ${txt(form.get('date'))}, date_label = ${txt(form.get('date_label'))}, notes = ${txt(form.get('notes'))}
            WHERE id = ${int(form.get('id'))}`;
  done();
}

export async function deleteRound(form) {
  await requireAdmin();
  await sql`DELETE FROM rounds WHERE id = ${int(form.get('id'))}`;
  done();
}

export async function addMatch(form) {
  await requireAdmin();
  const [home, homeLabel] = matchSide(form, 'home');
  const [away, awayLabel] = matchSide(form, 'away');
  if ((!home && !homeLabel) || (!away && !awayLabel) || (home && home === away)) return;
  await sql`INSERT INTO matches (round_id, home_team_id, away_team_id, home_label, away_label, time, field, note)
            VALUES (${int(form.get('round_id'))}, ${home}, ${away}, ${homeLabel}, ${awayLabel},
                    ${txt(form.get('time'))}, ${txt(form.get('field'))}, ${txt(form.get('note'))})`;
  done();
}

export async function updateMatch(form) {
  await requireAdmin();
  const [home, homeLabel] = matchSide(form, 'home');
  const [away, awayLabel] = matchSide(form, 'away');
  await sql`UPDATE matches SET home_team_id = ${home}, away_team_id = ${away}, home_label = ${homeLabel}, away_label = ${awayLabel},
              time = ${txt(form.get('time'))}, field = ${txt(form.get('field'))}, note = ${txt(form.get('note'))}
            WHERE id = ${int(form.get('id'))}`;
  done();
}

export async function deleteMatch(form) {
  await requireAdmin();
  await sql`DELETE FROM matches WHERE id = ${int(form.get('id'))}`;
  done();
}

// Todos contra todos (método del círculo). Crea las fechas a continuación de las existentes.
export async function generateFixture(form) {
  await requireAdmin();
  const c = cat(form.get('category'));
  const teams = (await sql`SELECT id FROM teams WHERE category = ${c} ORDER BY random()`).map((t) => t.id);
  if (teams.length < 2) return;
  if (teams.length % 2) teams.push(null); // equipo libre
  const [{ max }] = await sql`SELECT COALESCE(MAX(number), 0)::int AS max FROM rounds WHERE category = ${c}`;
  const start = txt(form.get('start'));
  const n = teams.length;
  let order = [...teams];
  for (let r = 0; r < n - 1; r++) {
    let date = null;
    if (start) {
      const d = new Date(`${start}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7 * r);
      date = d.toISOString().slice(0, 10);
    }
    const [round] = await sql`INSERT INTO rounds (category, number, date) VALUES (${c}, ${max + r + 1}, ${date}) RETURNING id`;
    for (let i = 0; i < n / 2; i++) {
      let [a, b] = [order[i], order[n - 1 - i]];
      if (a == null || b == null) continue;
      if (r % 2) [a, b] = [b, a];
      await sql`INSERT INTO matches (round_id, home_team_id, away_team_id) VALUES (${round.id}, ${a}, ${b})`;
    }
    order = [order[0], order[n - 1], ...order.slice(1, n - 1)];
  }
  done();
}

// ---------- Resultados ----------
export async function saveResult(form) {
  await requireAdmin();
  const h = int(form.get('home_goals'));
  const a = int(form.get('away_goals'));
  const both = h != null && a != null;
  await sql`UPDATE matches SET home_goals = ${both ? h : null}, away_goals = ${both ? a : null}
            WHERE id = ${int(form.get('id'))}`;
  done();
}

// ---------- Tribunal ----------
export async function addSanction(form) {
  await requireAdmin();
  const reason = txt(form.get('reason'));
  const teamId = int(form.get('team_id'));
  const player = txt(form.get('player_name'));
  if (!reason || (!teamId && !player)) return;
  await sql`INSERT INTO sanctions (category, team_id, player_name, reason, matches_suspended, points_deducted)
            VALUES (${cat(form.get('category'))}, ${teamId}, ${player}, ${reason},
                    ${int(form.get('matches_suspended')) ?? 0}, ${int(form.get('points_deducted')) ?? 0})`;
  done();
}

export async function deleteSanction(form) {
  await requireAdmin();
  await sql`DELETE FROM sanctions WHERE id = ${int(form.get('id'))}`;
  done();
}

// ---------- Comunicados ----------
export async function addAnnouncement(form) {
  await requireAdmin();
  const title = txt(form.get('title'));
  const body = txt(form.get('body'));
  if (!title || !body) return;
  await sql`INSERT INTO announcements (category, title, body) VALUES (${catOrAll(form.get('category'))}, ${title}, ${body})`;
  done();
}

export async function deleteAnnouncement(form) {
  await requireAdmin();
  await sql`DELETE FROM announcements WHERE id = ${int(form.get('id'))}`;
  done();
}

// ---------- Fotos ----------
export async function addPhoto({ category, caption, dataUrl }) {
  await requireAdmin();
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Imagen inválida');
  await sql`INSERT INTO photos (category, caption, mime, data) VALUES (${catOrAll(category)}, ${txt(caption)}, ${m[1]}, ${m[2]})`;
  done();
}

export async function deletePhoto(form) {
  await requireAdmin();
  await sql`DELETE FROM photos WHERE id = ${int(form.get('id'))}`;
  done();
}

// ---------- Goleadores ----------
export async function addGoal(form) {
  await requireAdmin();
  const matchId = int(form.get('match_id'));
  const playerId = int(form.get('player_id'));
  const count = Math.max(int(form.get('count')) ?? 1, 1);
  if (!matchId || !playerId) return;
  await sql`INSERT INTO goals (match_id, player_id, count) VALUES (${matchId}, ${playerId}, ${count})`;
  done();
}

export async function deleteGoal(form) {
  await requireAdmin();
  await sql`DELETE FROM goals WHERE id = ${int(form.get('id'))}`;
  done();
}

export async function setBaseGoals(form) {
  await requireAdmin();
  await sql`UPDATE players SET base_goals = ${Math.max(int(form.get('base_goals')) ?? 0, 0)}
            WHERE id = ${int(form.get('player_id'))}`;
  done();
}

// ---------- Documentos y páginas ----------
export async function addDocument(form) {
  await requireAdmin();
  const file = dataUrl(form.get('file'));
  const title = txt(form.get('title'));
  if (!file || !title) return;
  const section = form.get('section') === 'anexos' ? 'anexos' : 'reglamentos';
  await sql`INSERT INTO documents (section, title, mime, data, position)
            VALUES (${section}, ${title}, ${file.mime}, ${file.data}, (SELECT COALESCE(MAX(position), 0) + 1 FROM documents))`;
  done();
}

export async function deleteDocument(form) {
  await requireAdmin();
  await sql`DELETE FROM documents WHERE id = ${int(form.get('id'))}`;
  done();
}

export async function savePage(form) {
  await requireAdmin();
  const slug = txt(form.get('slug'));
  if (!slug) return;
  await sql`INSERT INTO pages (slug, title, body) VALUES (${slug}, ${txt(form.get('title')) ?? slug}, ${form.get('body') ?? ''})
            ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()`;
  done();
}
