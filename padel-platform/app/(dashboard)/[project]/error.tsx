'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui';

/**
 * Frontera de error del area de trabajo (FASE 15).
 *
 * Cubre cualquier pagina bajo `/[project]`: si una Server Component
 * lanza (una consulta que rompe, un `throw` inesperado), esto evita que
 * el usuario vea la pantalla blanca de Next y le da un boton para volver
 * a intentarlo sin perder la sesion ni el proyecto activo.
 *
 * Deliberadamente no muestra `error.message`: puede contener detalle de
 * PostgreSQL que no es para el usuario final. Va al log del servidor con
 * el `digest` que Next asigna, que es lo que hace falta para buscarlo.
 */
export default function ProjectAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[project-error]', error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="py-8">
      <ErrorState
        title="Esta pantalla no ha podido cargar"
        description={
          error.digest
            ? `Ha ocurrido un problema inesperado. Referencia: ${error.digest}`
            : 'Ha ocurrido un problema inesperado. Vuelve a intentarlo; si persiste, avisa al administrador.'
        }
      />
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={reset} className="btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
