import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getRounds } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Submit } from '@/components/admin';
import { saveResult } from '../../actions';

export default async function AdminResults() {
  const cat = await adminCat();
  const rounds = await getRounds(cat);
  // Primero las fechas con partidos pendientes
  const sorted = [
    ...rounds.filter((r) => r.matches.some((m) => m.home_goals == null)),
    ...rounds.filter((r) => r.matches.length && r.matches.every((m) => m.home_goals != null)).reverse(),
  ];

  return (
    <>
      <h1 className="page-title">Resultados · {byKey(cat).name}</h1>
      <p className="muted">Escribe los goles y presiona ✔. Para borrar un resultado, deja los casilleros vacíos y guarda.</p>
      {!sorted.length && <p className="empty">Primero arma el fixture.</p>}
      {sorted.map((r) => (
        <section key={r.id} className="card">
          <h3 className="round-title">
            Fecha {r.number}
            {r.date && <small>{fmtDate(r.date)}</small>}
          </h3>
          {r.matches.map((m) => (
            <form key={`${m.id}-${m.home_goals}-${m.away_goals}`} action={saveResult}
              className={`result-form ${m.home_goals != null ? 'saved' : ''}`}>
              <input type="hidden" name="id" value={m.id} />
              <span className="home">{m.home_name}</span>
              <input type="number" name="home_goals" min={0} inputMode="numeric" defaultValue={m.home_goals ?? ''} aria-label={`Goles ${m.home_name}`} />
              <span>-</span>
              <input type="number" name="away_goals" min={0} inputMode="numeric" defaultValue={m.away_goals ?? ''} aria-label={`Goles ${m.away_name}`} />
              <span className="away">{m.away_name}</span>
              <Submit className="btn btn-small">✔</Submit>
            </form>
          ))}
        </section>
      ))}
    </>
  );
}
