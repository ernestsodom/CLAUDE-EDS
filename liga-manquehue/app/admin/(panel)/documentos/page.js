import { getDocuments } from '@/lib/data';
import { Submit, Delete, FileField } from '@/components/admin';
import { addDocument, deleteDocument } from '../../actions';

const SECTIONS = { reglamentos: 'Reglas y normas', anexos: 'Anexos reglamentarios' };

export default async function AdminDocuments() {
  const docs = await getDocuments();
  return (
    <>
      <h1 className="page-title">Documentos</h1>
      <p className="muted">Aparecen en &quot;La Liga → Reglamentos&quot; del sitio público, para ambas categorías.</p>
      <section className="card">
        <h2>Subir documento</h2>
        <form action={addDocument} className="stack">
          <label>
            Título
            <input name="title" required placeholder="Ej: Reglamento 2027" />
          </label>
          <label>
            Sección
            <select name="section" defaultValue="reglamentos">
              {Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <FileField name="file" label="Archivo PDF (máx. 3 MB)" accept="application/pdf" required />
          <Submit>Subir documento</Submit>
        </form>
      </section>
      {Object.entries(SECTIONS).map(([section, title]) => (
        <section key={section} className="card">
          <h2>{title}</h2>
          <ul className="admin-list">
            {docs.filter((d) => d.section === section).map((d) => (
              <li key={d.id}>
                <a href={`/api/documento/${d.id}`} target="_blank" rel="noreferrer">📄 {d.title}</a>
                <Delete action={deleteDocument} id={d.id} question={`¿Eliminar "${d.title}"?`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
