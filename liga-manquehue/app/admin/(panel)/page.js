import Link from 'next/link';
import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getRounds, getTeams } from '@/lib/data';

const tiles = [
  { href: '/admin/resultados', icon: '📝', title: 'Cargar resultados', text: 'Anota los goles de cada partido. La tabla se actualiza sola.' },
  { href: '/admin/fixture', icon: '📅', title: 'Armar fixture', text: 'Crea las fechas y los partidos, o genéralo automático.' },
  { href: '/admin/tribunal', icon: '⚖️', title: 'Tribunal', text: 'Registra suspensiones y descuentos de puntos.' },
  { href: '/admin/comunicados', icon: '📢', title: 'Comunicados', text: 'Publica avisos para todos.' },
  { href: '/admin/equipos', icon: '👥', title: 'Equipos y jugadores', text: 'Agrega equipos y sus planteles.' },
  { href: '/admin/fotos', icon: '📷', title: 'Fotos', text: 'Sube las fotos de cada fecha.' },
];

export default async function AdminHome() {
  const cat = await adminCat();
  const [teams, rounds] = await Promise.all([getTeams(cat), getRounds(cat)]);
  const pending = rounds.flatMap((r) => r.matches).filter((m) => m.home_goals == null).length;
  return (
    <>
      <h1 className="page-title">Hola 👋 — trabajando en <span className="hl">{byKey(cat).name}</span></h1>
      <p className="muted">
        {teams.length} equipos · {rounds.length} fechas · {pending} partidos sin resultado.
        Cambia de categoría con los botones de arriba.
      </p>
      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="tile">
            <span className="icon">{t.icon}</span>
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
