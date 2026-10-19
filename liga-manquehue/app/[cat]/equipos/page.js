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
          <article key={t.id} className="card team-profile">
            {t.has_photo && (
              <a href={`/api/equipo/${t.id}/foto`} target="_blank" rel="noreferrer">
                <img className="team-photo" src={`/api/equipo/${t.id}/foto`} alt={`Equipo ${t.name}`} loading="lazy" />
              </a>
            )}
            <div className="team-head">
              {t.has_logo && <img className="crest big" src={`/api/equipo/${t.id}/escudo`} alt="" />}
              <h3>{t.name}</h3>
            </div>
            {t.info && <p className="team-info">{t.info}</p>}
            <details>
              <summary>Plantel ({t.players.length})</summary>
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
          </article>
        ))}
      </div>
    </>
  );
}
