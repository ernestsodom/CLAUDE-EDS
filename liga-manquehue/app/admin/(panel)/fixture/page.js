import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getRounds, getTeams } from '@/lib/data';
import { fmtDate, isoDate } from '@/lib/format';
import { Submit, Delete, ConfirmForm } from '@/components/admin';
import { addRound, updateRound, deleteRound, addMatch, deleteMatch, generateFixture } from '../../actions';

export default async function AdminFixture() {
  const cat = await adminCat();
  const [teams, rounds] = await Promise.all([getTeams(cat), getRounds(cat)]);
  const nextNumber = (rounds.at(-1)?.number ?? 0) + 1;

  return (
    <>
      <h1 className="page-title">Fixture · {byKey(cat).name}</h1>

      <div className="grid-2">
        <section className="card">
          <h2>Agregar fecha</h2>
          <form action={addRound} className="stack">
            <input type="hidden" name="category" value={cat} />
            <div className="row">
              <label>
                N° de fecha
                <input type="number" name="number" defaultValue={nextNumber} min={1} />
              </label>
              <label>
                Día
                <input type="date" name="date" />
              </label>
            </div>
            <Submit>Crear fecha</Submit>
          </form>
        </section>

        <section className="card">
          <h2>Fixture automático</h2>
          <p className="muted small">Crea todas las fechas &quot;todos contra todos&quot; con los {teams.length} equipos, una por semana.</p>
          <ConfirmForm action={generateFixture} className="stack"
            question={`Se crearán ${Math.max(teams.length - 1 + (teams.length % 2), 0)} fechas nuevas a partir de la Fecha ${nextNumber}. ¿Continuar?`}>
            <input type="hidden" name="category" value={cat} />
            <label>
              Día de la primera fecha
              <input type="date" name="start" />
            </label>
            <Submit>Generar fixture</Submit>
          </ConfirmForm>
        </section>
      </div>

      {rounds.map((r) => (
        <section key={r.id} className="card">
          <div className="row-between">
            <h3 className="round-title">
              Fecha {r.number}
              {r.date && <small>{fmtDate(r.date)}</small>}
            </h3>
            <Delete action={deleteRound} id={r.id} label="Eliminar fecha"
              question={`¿Eliminar la Fecha ${r.number} con todos sus partidos?`} />
          </div>

          <form action={updateRound} className="row">
            <input type="hidden" name="id" value={r.id} />
            <input type="date" name="date" defaultValue={isoDate(r.date)} key={isoDate(r.date)} />
            <Submit className="btn-secondary">Cambiar día</Submit>
          </form>

          <ul className="admin-list">
            {r.matches.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.home_name}</strong> vs <strong>{m.away_name}</strong>
                  <span className="muted"> {m.time && `· ${m.time}`} {m.field && `· Cancha ${m.field}`}</span>
                  {m.home_goals != null && <span className="badge gray">{m.home_goals}-{m.away_goals}</span>}
                </span>
                <Delete action={deleteMatch} id={m.id} label="Quitar" question="¿Quitar este partido?" />
              </li>
            ))}
          </ul>

          <form action={addMatch} className="match-form">
            <input type="hidden" name="round_id" value={r.id} />
            <select name="home" required defaultValue="">
              <option value="" disabled>Local</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select name="away" required defaultValue="">
              <option value="" disabled>Visita</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input name="time" placeholder="Hora (ej: 10:00)" />
            <input name="field" placeholder="Cancha" />
            <Submit>+ Partido</Submit>
          </form>
        </section>
      ))}
    </>
  );
}
