import { bySlug } from '@/lib/categories';
import { getSanctions, getFairPlay } from '@/lib/data';
import { fmtShort } from '@/lib/format';

export default async function TribunalPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const [sanctions, fairPlay] = await Promise.all([getSanctions(category.key), getFairPlay(category.key)]);
  return (
    <>
      <h1 className="page-title">Tribunal y Sanciones · {category.name}</h1>
      <h2>Sanciones</h2>
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
              {!s.matches_suspended && !s.points_deducted && <span className="badge gray">Resolución</span>}
            </div>
            <p>{s.reason}</p>
          </article>
        ))
      ) : (
        <p className="empty">No hay sanciones registradas. ¡Juego limpio! 👏</p>
      )}

      <h2>Tabla Fair Play</h2>
      <p className="muted small">TA: tarjetas amarillas · TR: tarjetas rojas · Menos puntos = más juego limpio. En caso de empate en puntos en la tabla de posiciones, queda arriba el equipo con mejor fair play.</p>
      <div className="table-wrap">
        <table className="standings">
          <thead>
            <tr><th>#</th><th className="left">Equipo</th><th>TA</th><th>TR</th><th>Puntos</th></tr>
          </thead>
          <tbody>
            {fairPlay.map((t, i) => (
              <tr key={t.id}>
                <td>{fairPlay.findIndex((x) => x.fp_pts === t.fp_pts && x.fp_tr === t.fp_tr) + 1}</td>
                <td className="left team">{t.name}</td>
                <td>{t.fp_ta}</td>
                <td>{t.fp_tr}</td>
                <td className="pts">{t.fp_pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
