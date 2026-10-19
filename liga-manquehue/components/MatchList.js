import { fmtDate } from '@/lib/format';

const scorerList = (goals) => goals.map((g) => (g.count > 1 ? `${g.name} (${g.count})` : g.name)).join(', ');

export function MatchRow({ m, goals = [] }) {
  const played = m.home_goals != null && m.away_goals != null;
  const home = goals.filter((g) => g.team_id === m.home_team_id);
  const away = goals.filter((g) => g.team_id === m.away_team_id);
  return (
    <div className="match">
      <span className="home">{m.home_name}</span>
      <span className={played ? 'score' : 'vs'}>
        {played ? `${m.home_goals} - ${m.away_goals}` : m.time || 'vs'}
      </span>
      <span className="away">{m.away_name}</span>
      {!played && m.field && <span className="field">Cancha {m.field}</span>}
      {goals.length > 0 && (
        <>
          <span className="scorers-line home">{home.length > 0 && `⚽ ${scorerList(home)}`}</span>
          <span />
          <span className="scorers-line away">{away.length > 0 && `${scorerList(away)} ⚽`}</span>
        </>
      )}
    </div>
  );
}

export default function RoundCard({ round, goals = {} }) {
  return (
    <section className="card">
      <h3 className="round-title">
        Fecha {round.number}
        {round.date && <small>{fmtDate(round.date)}</small>}
      </h3>
      {round.matches.length ? (
        round.matches.map((m) => <MatchRow key={m.id} m={m} goals={goals[m.id]} />)
      ) : (
        <p className="empty">Partidos por definir.</p>
      )}
    </section>
  );
}
