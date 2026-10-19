import Link from 'next/link';
import Nav from '@/components/Nav';
import { requireAdmin, adminCat } from '@/lib/auth';
import { CATEGORIES } from '@/lib/categories';
import { logout, setAdminCat } from '../actions';

export const metadata = { title: 'Administrador · Liga Manquehue' };

const items = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/equipos', label: 'Equipos y Jugadores' },
  { href: '/admin/fixture', label: 'Fixture' },
  { href: '/admin/resultados', label: 'Resultados y Goleadores' },
  { href: '/admin/tribunal', label: 'Tribunal' },
  { href: '/admin/comunicados', label: 'Comunicados' },
  { href: '/admin/fotos', label: 'Fotos' },
];

export default async function AdminLayout({ children }) {
  await requireAdmin();
  const current = await adminCat();
  return (
    <>
      <header className="header admin">
        <div className="container">
          <Link href="/admin" className="brand">
            <span className="ball">⚙️</span>
            <span>
              <strong>Panel Administrador</strong>
              <small>Liga Manquehue</small>
            </span>
          </Link>
          <form action={setAdminCat} className="cats">
            {CATEGORIES.map((c) => (
              <button key={c.key} name="cat" value={c.key} className={c.key === current ? 'active' : ''}>
                {c.name}
              </button>
            ))}
          </form>
        </div>
      </header>
      <div className="nav-bar">
        <div className="container">
          <Nav items={items} />
        </div>
      </div>
      <main className="container">{children}</main>
      <footer className="footer">
        <div className="container row-between">
          <Link href="/">Ver sitio público ↗</Link>
          <form action={logout}>
            <button className="btn-link">Cerrar sesión</button>
          </form>
        </div>
      </footer>
    </>
  );
}
