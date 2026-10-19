import RoundCard from '@/components/MatchList';
import { bySlug } from '@/lib/categories';
import { getRounds } from '@/lib/data';

export default async function FixturePage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const rounds = await getRounds(category.key);
  return (
    <>
      <h1 className="page-title">Fixture · {category.name}</h1>
      {rounds.length ? rounds.map((r) => <RoundCard key={r.id} round={r} />) : <p className="empty">El fixture aún no está publicado.</p>}
    </>
  );
}
