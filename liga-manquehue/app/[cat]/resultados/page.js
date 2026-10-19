import RoundCard from '@/components/MatchList';
import { bySlug } from '@/lib/categories';
import { getRounds } from '@/lib/data';

export default async function ResultsPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const rounds = (await getRounds(category.key))
    .map((r) => ({ ...r, matches: r.matches.filter((m) => m.home_goals != null && m.away_goals != null) }))
    .filter((r) => r.matches.length)
    .reverse();
  return (
    <>
      <h1 className="page-title">Resultados · {category.name}</h1>
      {rounds.length ? rounds.map((r) => <RoundCard key={r.id} round={r} />) : <p className="empty">Todavía no hay resultados cargados.</p>}
    </>
  );
}
