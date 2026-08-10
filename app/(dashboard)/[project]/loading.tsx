import { Skeleton, TableSkeleton } from '@/components/ui';

/**
 * Estado de carga del area de trabajo (FASE 15).
 *
 * Next lo muestra automaticamente mientras la Server Component de la
 * ruta espera sus datos, envolviendola en un `<Suspense>` implicito. Sin
 * este fichero, cambiar de pantalla dentro de `/[project]` se queda en
 * blanco durante la consulta; con el, se ve de inmediato que algo esta
 * pasando, con la forma aproximada de lo que va a aparecer.
 */
export default function ProjectAreaLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
