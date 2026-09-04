import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Botón "Volver" — un único componente para que todas las fichas y
 * subpantallas regresen al nivel inmediatamente anterior de la misma forma,
 * sin depender de que el usuario use el menú principal.
 *
 * Se ubica siempre arriba a la izquierda, antes del título de la pantalla.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
