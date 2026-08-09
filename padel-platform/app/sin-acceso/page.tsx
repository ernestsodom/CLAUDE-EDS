import { ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { SignOutButton } from '@/components/shared/sign-out-button';

export default async function NoAccessPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="card max-w-md p-8 text-center">
        <ShieldAlert size={32} strokeWidth={1.5} className="mx-auto mb-4 text-warning" />
        <h1 className="text-lg font-semibold">Sin acceso a proyectos</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Tu cuenta <span className="text-content">{session.user?.email}</span> existe, pero
          todavia no tiene acceso a ninguna unidad de negocio.
        </p>
        <p className="mt-2 text-sm text-content-muted">
          Pide a un administrador que te asigne un rol en Configuracion → Usuarios.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
