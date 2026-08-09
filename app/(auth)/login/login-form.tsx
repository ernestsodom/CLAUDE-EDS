'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Login real contra Supabase Auth.
 *
 * Los mensajes de error se traducen a lenguaje del usuario: nunca se
 * muestra el texto tecnico del proveedor de autenticacion (§96).
 */
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(
        authError.message.toLowerCase().includes('invalid')
          ? 'Email o contrasena incorrectos.'
          : authError.message.toLowerCase().includes('confirm')
            ? 'Tu cuenta aun no esta confirmada. Revisa tu correo.'
            : 'No se pudo iniciar sesion. Intentalo de nuevo en unos segundos.',
      );
      return;
    }

    router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="nombre@empresa.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        {loading ? 'Accediendo...' : 'Acceder'}
      </button>
    </form>
  );
}
