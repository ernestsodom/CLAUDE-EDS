import { bySlug } from '@/lib/categories';
import { getTeamsWithPlayers } from '@/lib/data';

export default async function TeamsPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const teams = await getTeamsWithPlayers(category.key);
  return (
    <>
      <h1 className="page-title">Equipos · {category.name}</h1>
      {!teams.length && <p className="empty">Aún no hay equipos en esta categoría.</p>}
      <div className="teams">
        {teams.map((t) => (
          <details key={t.id} className="card team-card">
            <summary>
              <strong>{t.name}</strong>
              <span className="muted">{t.players.length} jugadores</span>
            </summary>
            {t.players.length ? (
              <ul className="players">
                {t.players.map((p) => (
                  <li key={p.id}>
                    <span className="num">{p.number ?? '–'}</span> {p.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">Plantel por confirmar.</p>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
