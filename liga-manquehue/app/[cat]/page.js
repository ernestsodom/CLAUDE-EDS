import Link from 'next/link';
import StandingsTable from '@/components/StandingsTable';
import RoundCard from '@/components/MatchList';
import Announcement from '@/components/Announcement';
import { bySlug } from '@/lib/categories';
import { getStandings, getRounds, getAnnouncements } from '@/lib/data';

export default async function TablePage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const [rows, rounds, news] = await Promise.all([
    getStandings(category.key),
    getRounds(category.key),
    getAnnouncements(category.key, 3),
  ]);
  const next = rounds.find((r) => !r.matches.length || r.matches.some((m) => m.home_goals == null));

  return (
    <>
      <h1 className="page-title">Tabla de Posiciones · {category.name}</h1>
      <StandingsTable rows={rows} />

      <div className="grid-2">
        <div>
          <h2>Próxima fecha</h2>
          {next ? <RoundCard round={next} /> : <p className="empty">El fixture aún no está publicado.</p>}
          <Link className="link" href={`/${cat}/fixture`}>Ver fixture completo →</Link>
        </div>
        <div>
          <h2>Comunicados</h2>
          {news.length ? news.map((a) => <Announcement key={a.id} a={a} />) : <p className="empty">Sin comunicados.</p>}
          <Link className="link" href={`/${cat}/comunicados`}>Ver todos →</Link>
        </div>
      </div>
    </>
  );
}
