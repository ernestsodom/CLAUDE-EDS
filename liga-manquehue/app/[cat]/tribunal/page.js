import { bySlug } from '@/lib/categories';
import { getSanctions } from '@/lib/data';
import { fmtShort } from '@/lib/format';

export default async function TribunalPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const sanctions = await getSanctions(category.key);
  return (
    <>
      <h1 className="page-title">Tribunal y Sanciones · {category.name}</h1>
      {sanctions.length ? (
        sanctions.map((s) => (
          <article key={s.id} className="card sanction">
            <div className="sanction-head">
              <div>
                <strong>{s.player_name || s.team_name}</strong>
                {s.player_name && s.team_name && <span className="muted"> · {s.team_name}</span>}
              </div>
              <small className="muted">{fmtShort(s.created_at)}</small>
            </div>
            <div className="badges">
              {s.matches_suspended > 0 && (
                <span className="badge red">{s.matches_suspended} {s.matches_suspended === 1 ? 'fecha' : 'fechas'} de suspensión</span>
              )}
              {s.points_deducted > 0 && <span className="badge orange">-{s.points_deducted} pts al equipo</span>}
              {!s.matches_suspended && !s.points_deducted && <span className="badge gray">Amonestación</span>}
            </div>
            <p>{s.reason}</p>
          </article>
        ))
      ) : (
        <p className="empty">No hay sanciones registradas. ¡Juego limpio! 👏</p>
      )}
    </>
  );
}
