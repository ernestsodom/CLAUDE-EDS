import Link from 'next/link';
import { LoginForm } from '@/components/admin';

export const metadata = { title: 'Ingreso administrador · Liga Manquehue' };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="card">
        <h1>⚽ Liga Manquehue</h1>
        <p className="muted">Panel de administración</p>
        <LoginForm />
        <Link className="link" href="/">← Volver al sitio</Link>
      </div>
    </main>
  );
}
