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
    { href: `${base}/resultados`, label: 'Resultados y Goleadores' },
    { href: `${base}/tribunal`, label: 'Tribunal' },
    { href: `${base}/comunicados`, label: 'Comunicados' },
    { href: `${base}/equipos`, label: 'Equipos' },
    { href: `${base}/fotos`, label: 'Fotos' },
    { href: `${base}/liga`, label: 'La Liga' },
  ];

  return (
    <>
      <header className="header">
        <div className="container">
          <Link href="/" className="brand">
            <img className="logo" src="/logo.png" alt="Liga de Futbolito SSCC Manquehue" />
            <span>
              <strong>Liga Manquehue</strong>
              <small>Papás, Apoderados y Ex Alumnos · Clausura 2026</small>
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
          <p>Liga de Futbolito SSCC Manquehue · Padre Damián de Veuster #2215, Vitacura, Santiago</p>
          <p>
            <a href="https://www.instagram.com/ligassccmanquehue/" target="_blank" rel="noreferrer">Instagram</a> ·{' '}
            <a href="https://www.facebook.com/ligassccmanquehue" target="_blank" rel="noreferrer">Facebook</a> ·{' '}
            <a href="mailto:liga.sscc.manquehue@gmail.com">liga.sscc.manquehue@gmail.com</a> ·{' '}
            <Link href="/admin">Administrador</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
