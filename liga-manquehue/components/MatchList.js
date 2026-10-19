import { fmtDate } from '@/lib/format';

export function MatchRow({ m }) {
  const played = m.home_goals != null && m.away_goals != null;
  return (
    <div className="match">
      <span className="home">{m.home_name}</span>
      <span className={played ? 'score' : 'vs'}>
        {played ? `${m.home_goals} - ${m.away_goals}` : m.time || 'vs'}
      </span>
      <span className="away">{m.away_name}</span>
      {!played && m.field && <span className="field">Cancha {m.field}</span>}
    </div>
  );
}

export default function RoundCard({ round }) {
  return (
    <section className="card">
      <h3 className="round-title">
        Fecha {round.number}
        {round.date && <small>{fmtDate(round.date)}</small>}
      </h3>
      {round.matches.length ? (
        round.matches.map((m) => <MatchRow key={m.id} m={m} />)
      ) : (
        <p className="empty">Partidos por definir.</p>
      )}
    </section>
  );
}
