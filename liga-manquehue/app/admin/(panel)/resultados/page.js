import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getRounds, getTeamsWithPlayers, getGoalsByMatch } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Submit, Delete } from '@/components/admin';
import { saveResult, addGoal, deleteGoal, setBaseGoals } from '../../actions';

function PlayerOptions({ teams }) {
  return teams.map((t) => (
    <optgroup key={t.id} label={t.name}>
      {t.players.map((p) => (
        <option key={p.id} value={p.id}>{p.number != null ? `${p.number} · ` : ''}{p.name}</option>
      ))}
    </optgroup>
  ));
}

export default async function AdminResults() {
  const cat = await adminCat();
  const [rounds, teams, goals] = await Promise.all([getRounds(cat), getTeamsWithPlayers(cat), getGoalsByMatch(cat)]);
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const withPrevious = teams.flatMap((t) => t.players.filter((p) => p.base_goals > 0).map((p) => ({ ...p, team: t.name })));
  // Primero las fechas con partidos pendientes
  const sorted = [
    ...rounds.filter((r) => r.matches.some((m) => m.home_goals == null)),
    ...rounds.filter((r) => r.matches.length && r.matches.every((m) => m.home_goals != null)).reverse(),
  ];

  return (
    <>
      <h1 className="page-title">Resultados y Goleadores · {byKey(cat).name}</h1>
      <p className="muted">
        1) Escribe los goles y presiona ✔. 2) Abajo de cada partido elige quién hizo los goles y presiona &quot;+ Gol&quot;.
        Para borrar un resultado, deja los casilleros vacíos y guarda.
      </p>
      {!sorted.length && <p className="empty">Primero arma el fixture.</p>}
      {sorted.map((r) => (
        <section key={r.id} className="card">
          <h3 className="round-title">
            Fecha {r.number}
            {r.date && <small>{fmtDate(r.date)}</small>}
          </h3>
          {r.matches.map((m) => {
            const matchTeams = [teamById[m.home_team_id], teamById[m.away_team_id]].filter(Boolean);
            const hasPlayers = matchTeams.some((t) => t.players.length);
            return (
              <div key={m.id} className="match-block">
                <form key={`${m.home_goals}-${m.away_goals}`} action={saveResult}
                  className={`result-form ${m.home_goals != null ? 'saved' : ''}`}>
                  <input type="hidden" name="id" value={m.id} />
                  <span className="home">{m.home_name}</span>
                  <input type="number" name="home_goals" min={0} inputMode="numeric" defaultValue={m.home_goals ?? ''} aria-label={`Goles ${m.home_name}`} />
                  <span>-</span>
                  <input type="number" name="away_goals" min={0} inputMode="numeric" defaultValue={m.away_goals ?? ''} aria-label={`Goles ${m.away_name}`} />
                  <span className="away">{m.away_name}</span>
                  <Submit className="btn btn-small">✔</Submit>
                </form>
                <div className="goal-box">
                  {(goals[m.id] ?? []).map((g) => (
                    <span key={g.id} className="chip">
                      ⚽ {g.name}{g.count > 1 && ` ×${g.count}`}
                      <Delete action={deleteGoal} id={g.id} label="×" question={`¿Quitar gol de ${g.name}?`} />
                    </span>
                  ))}
                  {hasPlayers ? (
                    <form action={addGoal} className="goal-form">
                      <input type="hidden" name="match_id" value={m.id} />
                      <select name="player_id" required defaultValue="">
                        <option value="" disabled>¿Quién hizo el gol?</option>
                        <PlayerOptions teams={matchTeams} />
                      </select>
                      <input type="number" name="count" min={1} defaultValue={1} inputMode="numeric" aria-label="Cantidad de goles" />
                      <Submit className="btn-secondary">+ Gol</Submit>
                    </form>
                  ) : (
                    <span className="muted small">Agrega jugadores en &quot;Equipos y Jugadores&quot; para anotar goleadores.</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <section className="card">
        <h2>Goles previos</h2>
        <p className="muted small">
          Goles que cada jugador ya llevaba antes de usar este sitio. Se suman a la tabla de goleadores.
        </p>
        <form action={setBaseGoals} className="goal-form">
          <select name="player_id" required defaultValue="">
            <option value="" disabled>Jugador</option>
            <PlayerOptions teams={teams.filter((t) => t.players.length)} />
          </select>
          <input type="number" name="base_goals" min={0} defaultValue={0} inputMode="numeric" aria-label="Goles previos" />
          <Submit className="btn-secondary">Guardar</Submit>
        </form>
        {withPrevious.length > 0 && (
          <ul className="admin-list">
            {withPrevious.map((p) => (
              <li key={p.id}>
                <span>{p.name} <span className="muted">· {p.team}</span></span>
                <strong>{p.base_goals}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
