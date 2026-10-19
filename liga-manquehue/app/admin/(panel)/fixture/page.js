import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getRounds, getTeams } from '@/lib/data';
import { fmtDate, isoDate } from '@/lib/format';
import { roundTitle } from '@/components/MatchList';
import { Submit, Delete, ConfirmForm } from '@/components/admin';
import { addRound, updateRound, deleteRound, addMatch, updateMatch, deleteMatch, generateFixture } from '../../actions';

// Equipo de un lado del partido: un equipo de la lista o, si aún no se sabe, un texto (ej: "1° lugar")
function SideFields({ side, teams, m }) {
  const label = side === 'home' ? 'Local' : 'Visita';
  return (
    <>
      <select name={side} defaultValue={m?.[`${side}_team_id`] ?? ''}>
        <option value="">{label}: por definir ↓</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input name={`${side}_label`} defaultValue={m?.[`${side}_label`] ?? ''} placeholder={`${label} por definir (ej: 1° lugar)`} />
    </>
  );
}

export default async function AdminFixture() {
  const cat = await adminCat();
  const [teams, rounds] = await Promise.all([getTeams(cat), getRounds(cat)]);
  const nextNumber = Math.max(0, ...rounds.map((r) => r.number)) + 1;

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
                <input type="number" name="number" defaultValue={nextNumber} min={0} />
              </label>
              <label>
                Día
                <input type="date" name="date" />
              </label>
            </div>
            <label>
              Nombre especial (opcional)
              <input name="name" placeholder="Ej: Fecha recuperativa, Fecha 11 (Play off)" />
            </label>
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
              {roundTitle(r)}
              {(r.date_label || r.date) && <small>{r.date_label || fmtDate(r.date)}</small>}
            </h3>
            <Delete action={deleteRound} id={r.id} label="Eliminar fecha"
              question={`¿Eliminar ${roundTitle(r)} con todos sus partidos?`} />
          </div>

          <details className="sub">
            <summary>Editar fecha (día, nombre, equipos libres)</summary>
            <form action={updateRound} className="stack" key={`${r.date}-${r.name}-${r.notes}-${r.date_label}`}>
              <input type="hidden" name="id" value={r.id} />
              <div className="row">
                <label>
                  N°
                  <input type="number" name="number" defaultValue={r.number} min={0} />
                </label>
                <label>
                  Día
                  <input type="date" name="date" defaultValue={isoDate(r.date)} />
                </label>
              </div>
              <label>
                Nombre especial
                <input name="name" defaultValue={r.name ?? ''} placeholder={`Fecha ${r.number}`} />
              </label>
              <label>
                Texto del día (si son varios días)
                <input name="date_label" defaultValue={r.date_label ?? ''} placeholder="Ej: Lunes 5 / Jueves 8 de octubre" />
              </label>
              <label>
                Nota al pie (equipos libres, avisos)
                <input name="notes" defaultValue={r.notes ?? ''} placeholder="Ej: Libres: SANTA FE, SANTOS" />
              </label>
              <Submit className="btn-secondary">Guardar fecha</Submit>
            </form>
          </details>

          <ul className="admin-list">
            {r.matches.map((m) => (
              <li key={m.id} className="match-admin">
                <div className="row-between">
                  <span>
                    <strong>{m.home_name}</strong> vs <strong>{m.away_name}</strong>
                    <span className="muted"> {m.time && `· ${m.time}`} {m.field && `· Cancha ${m.field}`}</span>
                    {m.home_goals != null && <span className="badge gray">{m.home_goals}-{m.away_goals}</span>}
                    {m.note && <span className="muted small"> · {m.note}</span>}
                  </span>
                  <Delete action={deleteMatch} id={m.id} label="Quitar" question="¿Quitar este partido?" />
                </div>
                <details className="sub">
                  <summary>Editar partido</summary>
                  <form action={updateMatch} className="match-form" key={`${m.home_team_id}-${m.away_team_id}-${m.time}-${m.note}-${m.home_label}`}>
                    <input type="hidden" name="id" value={m.id} />
                    <SideFields side="home" teams={teams} m={m} />
                    <SideFields side="away" teams={teams} m={m} />
                    <input name="time" defaultValue={m.time ?? ''} placeholder="Hora (ej: 10:10)" />
                    <input name="field" defaultValue={m.field ?? ''} placeholder="Cancha" />
                    <input name="note" defaultValue={m.note ?? ''} placeholder="Nota (ej: Suspendido, Final Oro)" />
                    <Submit className="btn-secondary">Guardar</Submit>
                  </form>
                </details>
              </li>
            ))}
          </ul>

          <form action={addMatch} className="match-form">
            <input type="hidden" name="round_id" value={r.id} />
            <SideFields side="home" teams={teams} />
            <SideFields side="away" teams={teams} />
            <input name="time" placeholder="Hora (ej: 10:00)" />
            <input name="field" placeholder="Cancha" />
            <input name="note" placeholder="Nota (opcional)" />
            <Submit>+ Partido</Submit>
          </form>
        </section>
      ))}
    </>
  );
}
