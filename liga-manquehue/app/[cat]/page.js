import Link from 'next/link';
import StandingsTable from '@/components/StandingsTable';
import RoundCard from '@/components/MatchList';
import Announcement from '@/components/Announcement';
import { bySlug } from '@/lib/categories';
import { getStandings, getRounds, getAnnouncements, nextRound } from '@/lib/data';

export default async function TablePage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const [rows, rounds, news] = await Promise.all([
    getStandings(category.key),
    getRounds(category.key),
    getAnnouncements(category.key, 3),
  ]);
  const next = nextRound(rounds);

  return (
    <>
      <section className="hero">
        <video autoPlay muted loop playsInline poster="/video/inicio.jpg" preload="metadata">
          <source src="/video/inicio.mp4" type="video/mp4" />
        </video>
        <div className="hero-text">
          <h1>Te damos la bienvenida a la Liga SSCC Manquehue</h1>
          <p>Anímate a participar en nuestra liga que durante dos décadas ha convocado a gran cantidad de papás en torno al futbolito y la práctica deportiva.</p>
        </div>
      </section>

      <h1 className="page-title">Tabla de Posiciones · {category.name}</h1>
      <StandingsTable rows={rows} />
      <p className="muted small">En caso de empate en puntos, define el mejor comportamiento Fair Play.</p>

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
