import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Ruta de migas — dónde está el usuario, no solo de dónde vino (eso lo
 * cubre BackLink). Útil cuando hay más de un nivel intermedio, como
 * Documentos → Carpeta → Documento.
 */
export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
