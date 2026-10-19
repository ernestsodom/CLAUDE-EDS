import RichText from '@/components/RichText';
import { getDocuments, getPages } from '@/lib/data';

const SECTIONS = [
  ['historia', '📜 Historia'],
  ['directiva', '👔 Directiva'],
  ['documentos', '📄 Reglamentos'],
  ['administracion', '💳 Administración'],
  ['contacto', '✉️ Contacto'],
];

export default async function LeaguePage() {
  const [pages, docs] = await Promise.all([getPages(), getDocuments()]);
  const page = Object.fromEntries(pages.map((p) => [p.slug, p]));
  const docList = (section) => docs.filter((d) => d.section === section);

  return (
    <>
      <h1 className="page-title">La Liga</h1>
      <div className="jump wrap">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </div>

      {['historia', 'directiva'].map((slug) => page[slug] && (
        <section key={slug} id={slug} className="card page-section">
          <h2>{page[slug].title}</h2>
          <RichText text={page[slug].body} />
        </section>
      ))}

      <section id="documentos" className="card page-section">
        <h2>Reglamentos y documentos</h2>
        {[['reglamentos', 'Reglas y normas'], ['anexos', 'Anexos reglamentarios']].map(([section, title]) =>
          docList(section).length > 0 && (
            <div key={section}>
              <h3>{title}</h3>
              <ul className="docs">
                {docList(section).map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documento/${d.id}`} target="_blank" rel="noreferrer">📄 {d.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </section>

      {['administracion', 'contacto'].map((slug) => page[slug] && (
        <section key={slug} id={slug} className="card page-section">
          <h2>{page[slug].title}</h2>
          <RichText text={page[slug].body} />
        </section>
      ))}
    </>
  );
}
