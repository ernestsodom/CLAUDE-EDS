import Link from 'next/link';
import { Compass } from 'lucide-react';

/**
 * 404 de toda la aplicacion (FASE 15).
 *
 * Vive en la raiz de `app/` porque cubre rutas que no coinciden con
 * ningun segmento — incluidas las que estan fuera de `/[project]`, donde
 * ya existe `/sin-acceso` para el caso "existe la ruta pero no el
 * acceso". Este es el otro caso: la ruta, directamente, no existe.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-center text-content">
      <Compass size={32} strokeWidth={1.5} className="mb-4 text-content-muted" />
      <h1 className="text-lg font-semibold">Esta pagina no existe</h1>
      <p className="mt-2 max-w-md text-sm text-content-secondary">
        Comprueba el enlace o vuelve al inicio.
      </p>
      <Link
        href="/"
        className="mt-5 rounded bg-accent px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
