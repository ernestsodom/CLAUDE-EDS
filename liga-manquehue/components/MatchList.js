import { fmtDate } from '@/lib/format';

const scorerList = (goals) => goals.map((g) => (g.count > 1 ? `${g.name} (${g.count})` : g.name)).join(', ');

export function TeamName({ id, name, hasLogo }) {
  return (
    <>
      {hasLogo && <img className="crest" src={`/api/equipo/${id}/escudo`} alt="" />}
      {name}
    </>
  );
}

export function MatchRow({ m, goals = [] }) {
  const played = m.home_goals != null && m.away_goals != null;
  const home = goals.filter((g) => g.team_id === m.home_team_id);
  const away = goals.filter((g) => g.team_id === m.away_team_id);
  const pending = m.home_team_id == null;
  return (
    <div className={`match ${pending ? 'pending' : ''}`}>
      <span className="home"><TeamName id={m.home_team_id} name={m.home_name} hasLogo={m.home_logo} /></span>
      <span className={played ? 'score' : 'vs'}>
        {played ? `${m.home_goals} - ${m.away_goals}` : m.time || 'vs'}
      </span>
      <span className="away"><TeamName id={m.away_team_id} name={m.away_name} hasLogo={m.away_logo} /></span>
      {(m.note || (!played && m.field)) && (
        <span className="field">{[m.note, !played && m.field && `Cancha ${m.field}`].filter(Boolean).join(' · ')}</span>
      )}
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

export function roundTitle(r) {
  return r.name || `Fecha ${r.number}`;
}

export default function RoundCard({ round, goals = {} }) {
  return (
    <section className="card">
      <h3 className="round-title">
        {roundTitle(round)}
        {(round.date_label || round.date) && <small>{round.date_label || fmtDate(round.date)}</small>}
      </h3>
      {round.matches.length ? (
        round.matches.map((m) => <MatchRow key={m.id} m={m} goals={goals[m.id]} />)
      ) : (
        <p className="empty">Partidos por definir.</p>
      )}
      {round.notes && <p className="round-notes">{round.notes}</p>}
    </section>
  );
}
