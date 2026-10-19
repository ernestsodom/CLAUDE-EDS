import { getPages } from '@/lib/data';
import { Submit } from '@/components/admin';
import { savePage } from '../../actions';

const ORDER = ['historia', 'directiva', 'administracion', 'contacto'];

export default async function AdminPages() {
  const pages = (await getPages()).sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
  return (
    <>
      <h1 className="page-title">Historia y textos</h1>
      <section className="card help">
        <strong>Formato:</strong> deja una línea en blanco entre párrafos.
        Usa <code>## Título</code> para un subtítulo, <code>- texto</code> para una lista,
        <code>**negrita**</code>, <code>[texto](https://enlace)</code> para un link y
        <code>![descripción](/api/foto/12)</code> para mostrar una foto subida en &quot;Fotos&quot; (el número es el de la foto).
      </section>
      {pages.map((p) => (
        <details key={p.slug} className="card">
          <summary><strong>{p.title}</strong></summary>
          <form action={savePage} className="stack" key={p.updated_at}>
            <input type="hidden" name="slug" value={p.slug} />
            <label>
              Título
              <input name="title" defaultValue={p.title} required />
            </label>
            <label>
              Texto
              <textarea name="body" rows={16} defaultValue={p.body} />
            </label>
            <Submit>Guardar</Submit>
          </form>
        </details>
      ))}
    </>
  );
}
