import RoundCard from '@/components/MatchList';
import ScorersTable from '@/components/ScorersTable';
import { bySlug } from '@/lib/categories';
import { getRounds, getScorers, getGoalsByMatch } from '@/lib/data';

export default async function ResultsPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const [allRounds, scorers, goals] = await Promise.all([
    getRounds(category.key),
    getScorers(category.key),
    getGoalsByMatch(category.key),
  ]);
  const rounds = allRounds
    .map((r) => ({ ...r, matches: r.matches.filter((m) => m.home_goals != null && m.away_goals != null) }))
    .filter((r) => r.matches.length)
    .reverse();

  return (
    <>
      <h1 className="page-title">Resultados y Goleadores · {category.name}</h1>
      <div className="jump">
        <a href="#resultados">📋 Resultados</a>
        <a href="#goleadores">👟 Goleadores</a>
      </div>
      <div className="grid-results">
        <section id="resultados">
          <h2>Resultados</h2>
          {rounds.length ? (
            rounds.map((r) => <RoundCard key={r.id} round={r} goals={goals} />)
          ) : (
            <p className="empty">Todavía no hay resultados cargados.</p>
          )}
        </section>
        <section id="goleadores">
          <h2>Goleadores</h2>
          <ScorersTable rows={scorers} />
        </section>
      </div>
    </>
  );
}
