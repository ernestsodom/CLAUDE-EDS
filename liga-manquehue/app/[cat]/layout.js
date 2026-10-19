import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import { CATEGORIES, bySlug } from '@/lib/categories';

export default async function CategoryLayout({ children, params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  if (!category) notFound();

  const base = `/${category.slug}`;
  const items = [
    { href: base, label: 'Tabla' },
    { href: `${base}/fixture`, label: 'Fixture' },
    { href: `${base}/resultados`, label: 'Resultados' },
    { href: `${base}/tribunal`, label: 'Tribunal' },
    { href: `${base}/comunicados`, label: 'Comunicados' },
    { href: `${base}/equipos`, label: 'Equipos' },
    { href: `${base}/fotos`, label: 'Fotos' },
  ];

  return (
    <>
      <header className="header">
        <div className="container">
          <Link href="/" className="brand">
            <span className="ball">⚽</span>
            <span>
              <strong>Liga Manquehue</strong>
              <small>Ex Alumnos y Apoderados · Clausura 2026</small>
            </span>
          </Link>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} className={c.slug === category.slug ? 'active' : ''}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </header>
      <div className="nav-bar">
        <div className="container">
          <Nav items={items} />
        </div>
      </div>
      <main className="container">{children}</main>
      <footer className="footer">
        <div className="container">
          Colegio Sagrados Corazones de Manquehue · <Link href="/admin">Administrador</Link>
        </div>
      </footer>
    </>
  );
}
