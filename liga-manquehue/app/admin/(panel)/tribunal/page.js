import { adminCat } from '@/lib/auth';
import { byKey } from '@/lib/categories';
import { getSanctions, getTeamsWithPlayers } from '@/lib/data';
import { fmtShort } from '@/lib/format';
import { Submit, Delete } from '@/components/admin';
import { addSanction, deleteSanction } from '../../actions';

export default async function AdminTribunal() {
  const cat = await adminCat();
  const [teams, sanctions] = await Promise.all([getTeamsWithPlayers(cat), getSanctions(cat)]);
  return (
    <>
      <h1 className="page-title">Tribunal y Sanciones · {byKey(cat).name}</h1>

      <section className="card">
        <h2>Nueva sanción</h2>
        <form action={addSanction} className="stack">
          <input type="hidden" name="category" value={cat} />
          <div className="row">
            <label>
              Equipo
              <select name="team_id" defaultValue="">
                <option value="">— Elegir —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>
              Jugador (opcional)
              <input name="player_name" list="players" placeholder="Nombre del jugador" />
              <datalist id="players">
                {teams.flatMap((t) => t.players).map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </label>
          </div>
          <label>
            Motivo / resolución
            <textarea name="reason" rows={3} required placeholder="Ej: Expulsión por juego brusco en Fecha 6" />
          </label>
          <div className="row">
            <label>
              Fechas de suspensión
              <input type="number" name="matches_suspended" min={0} defaultValue={0} inputMode="numeric" />
            </label>
            <label>
              Descuento de puntos al equipo
              <input type="number" name="points_deducted" min={0} defaultValue={0} inputMode="numeric" />
            </label>
          </div>
          <Submit>Publicar sanción</Submit>
        </form>
      </section>

      {sanctions.map((s) => (
        <article key={s.id} className="card sanction">
          <div className="sanction-head">
            <div>
              <strong>{s.player_name || s.team_name}</strong>
              {s.player_name && s.team_name && <span className="muted"> · {s.team_name}</span>}
              <small className="muted"> · {fmtShort(s.created_at)}</small>
            </div>
            <Delete action={deleteSanction} id={s.id} question="¿Eliminar esta sanción?" />
          </div>
          <div className="badges">
            {s.matches_suspended > 0 && <span className="badge red">{s.matches_suspended} fecha(s)</span>}
            {s.points_deducted > 0 && <span className="badge orange">-{s.points_deducted} pts</span>}
          </div>
          <p>{s.reason}</p>
        </article>
      ))}
    </>
  );
}
