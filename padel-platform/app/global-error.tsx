'use client';

import { useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';

/**
 * Frontera de error de toda la aplicacion (FASE 15).
 *
 * `global-error.tsx` es el unico limite que atrapa un fallo en el propio
 * `layout.tsx` raiz — por eso, a diferencia del resto de boundaries,
 * tiene que traer su propio `<html>` y `<body>`: sustituye por completo
 * el arbol raiz mientras esta activo.
 *
 * No muestra el mensaje tecnico del error: eso es lo que impide que un
 * stack trace de Supabase o de una Server Action acabe en pantalla de un
 * usuario sin permisos para leerlo. Queda en el log del servidor.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error.digest ?? error.message, error);
  }, [error]);

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-base text-content antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <AlertOctagon size={32} strokeWidth={1.5} className="mb-4 text-critical" />
          <h1 className="text-lg font-semibold">Algo ha fallado</h1>
          <p className="mt-2 max-w-md text-sm text-content-secondary">
            La aplicacion ha encontrado un error inesperado. Ya ha quedado registrado.
            {error.digest ? (
              <span className="mt-1 block text-2xs text-content-muted">Referencia: {error.digest}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded bg-accent px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
