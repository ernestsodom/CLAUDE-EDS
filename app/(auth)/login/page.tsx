import type { Metadata } from 'next';
import { Zap } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Acceder' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      {/* Acento visual sobrio: un unico halo naranja, sin degradados decorativos */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent">
            <Zap size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Padel Business</h1>
          <p className="mt-1 text-sm text-content-muted">
            Gestion integral de canchas de padel
          </p>
        </div>

        <div className="card p-6">
          <LoginForm redirectTo={redirect} />
        </div>

        <p className="mt-6 text-center text-2xs text-content-muted">
          El acceso a cada unidad de negocio lo determina tu rol.
        </p>
      </div>
    </main>
  );
}
