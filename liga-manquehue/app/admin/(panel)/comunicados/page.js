import { adminCat } from '@/lib/auth';
import { getAnnouncements } from '@/lib/data';
import { fmtShort } from '@/lib/format';
import { Submit, Delete } from '@/components/admin';
import { addAnnouncement, deleteAnnouncement } from '../../actions';

const LABEL = { tc: 'Todo Competidor', senior: 'Senior' };

export default async function AdminNews() {
  const cat = await adminCat();
  const news = await getAnnouncements(cat);
  return (
    <>
      <h1 className="page-title">Comunicados</h1>
      <section className="card">
        <h2>Nuevo comunicado</h2>
        <form action={addAnnouncement} className="stack">
          <label>
            Título
            <input name="title" required placeholder="Ej: Suspensión de la Fecha 8 por lluvia" />
          </label>
          <label>
            Mensaje
            <textarea name="body" rows={5} required />
          </label>
          <label>
            Para
            <select name="category" defaultValue="">
              <option value="">Ambas categorías</option>
              <option value="tc">Solo Todo Competidor</option>
              <option value="senior">Solo Senior</option>
            </select>
          </label>
          <Submit>Publicar</Submit>
        </form>
      </section>

      {news.map((a) => (
        <article key={a.id} className="card announcement">
          <div className="row-between">
            <small>{fmtShort(a.created_at)} · {a.category ? LABEL[a.category] : 'Ambas categorías'}</small>
            <Delete action={deleteAnnouncement} id={a.id} question="¿Eliminar este comunicado?" />
          </div>
          <h3>{a.title}</h3>
          <p>{a.body}</p>
        </article>
      ))}
    </>
  );
}
