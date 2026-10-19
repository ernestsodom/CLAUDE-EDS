import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getTeamsWithPlayers } from '@/lib/data';
import { Submit, Delete, FileField } from '@/components/admin';
import { addTeam, updateTeam, deleteTeam, addPlayers, deletePlayer } from '../../actions';

const FAIR = [['fp_ta', 'Amarillas'], ['fp_tr', 'Rojas'], ['fp_pts', 'Puntos']];

const BASE = [
  ['base_pj', 'PJ'], ['base_pg', 'PG'], ['base_pe', 'PE'],
  ['base_pp', 'PP'], ['base_gf', 'GF'], ['base_gc', 'GC'],
];

export default async function AdminTeams() {
  const cat = await adminCat();
  const teams = await getTeamsWithPlayers(cat);
  return (
    <>
      <h1 className="page-title">Equipos y Jugadores · {byKey(cat).name}</h1>

      <section className="card">
        <h2>Nuevo equipo</h2>
        <form action={addTeam} className="row">
          <input type="hidden" name="category" value={cat} />
          <input name="name" placeholder="Nombre del equipo" required />
          <Submit>Agregar equipo</Submit>
        </form>
      </section>

      {teams.map((t) => (
        <details key={t.id} className="card team-card">
          <summary>
            <strong>
              {t.has_logo && <img className="crest" src={`/api/equipo/${t.id}/escudo`} alt="" />}
              {t.name}
            </strong>
            <span className="muted">{t.players.length} jugadores</span>
          </summary>

          <h3>Jugadores</h3>
          {t.players.length ? (
            <ul className="admin-list">
              {t.players.map((p) => (
                <li key={p.id}>
                  <span><span className="num">{p.number ?? '–'}</span> {p.name}</span>
                  <Delete action={deletePlayer} id={p.id} label="Quitar" question={`¿Quitar a ${p.name}?`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Sin jugadores aún.</p>
          )}
          <form action={addPlayers} className="stack">
            <input type="hidden" name="team_id" value={t.id} />
            <label>
              Agregar jugadores — uno por línea (opcional: número al inicio)
              <textarea name="names" rows={4} placeholder={'10 Juan Pérez\n7 Pedro Soto\nDiego Rojas'} required />
            </label>
            <Submit>Agregar jugadores</Submit>
          </form>

          <details className="sub">
            <summary>Editar equipo: escudo, foto, fair play y arrastre</summary>
            <form action={updateTeam} className="stack">
              <input type="hidden" name="id" value={t.id} />
              <label>
                Nombre
                <input name="name" defaultValue={t.name} required />
              </label>
              <label>
                Descripción (opcional)
                <textarea name="info" rows={2} defaultValue={t.info ?? ''} placeholder="Ej: Fundado en 2002. Capitán: ..." />
              </label>
              <div className="row">
                <FileField name="logo" label={t.has_logo ? 'Cambiar escudo' : 'Subir escudo'} max={256} type="image/png" />
                <FileField name="photo" label={t.has_photo ? 'Cambiar foto del equipo' : 'Subir foto del equipo'} />
              </div>
              {t.has_photo && <img className="admin-thumb" src={`/api/equipo/${t.id}/foto`} alt="" />}
              <p className="muted small">Fair Play (menos puntos = más juego limpio)</p>
              <div className="base-grid">
                {FAIR.map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input type="number" name={k} defaultValue={t[k]} min={0} inputMode="numeric" />
                  </label>
                ))}
              </div>
              <p className="muted small">
                Arrastre: partidos jugados antes de usar este sitio. Se suman a los resultados que cargues.
              </p>
              <div className="base-grid">
                {BASE.map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input type="number" name={k} defaultValue={t[k]} min={0} inputMode="numeric" />
                  </label>
                ))}
              </div>
              <Submit>Guardar cambios</Submit>
            </form>
            <Delete action={deleteTeam} id={t.id} label="Eliminar equipo"
              question={`¿Eliminar ${t.name}? Se borrarán también sus jugadores y partidos.`} />
          </details>
        </details>
      ))}
    </>
  );
}
