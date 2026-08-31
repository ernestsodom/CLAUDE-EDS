import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, ArrowUpRight, Download } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can, moduleVisible } from '@/lib/permissions';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const metadata: Metadata = { title: 'Reportes' };

/**
 * Reportes (§65).
 *
 * Cada reporte es una vista analitica ya existente en PostgreSQL con los
 * filtros aplicados. No se recalcula nada en el navegador, por lo que un
 * reporte y el dashboard nunca pueden dar cifras distintas. `entity`
 * referencia una clave de `lib/services/export-registry.ts` — nunca un
 * nombre de tabla libre — y la ruta de exportacion exige el mismo permiso
 * `<module>.export` y aplica la misma RLS que la pantalla.
 */
const REPORTS = [
  { title: 'Reporte de negocios', description: 'Negocios por estado, canchas comprometidas, comision y fechas de entrega.', href: '/negocios', module: 'deals', entity: 'negocios' },
  { title: 'Reporte comercial', description: 'Pipeline, oportunidades por etapa y tasa de conversion.', href: '/comercial/oportunidades', module: 'opportunities', entity: 'oportunidades' },
  { title: 'Reporte de ventas', description: 'Ventas por estado, cliente y periodo, con avance de entrega.', href: '/ventas', module: 'sales', entity: 'ventas' },
  { title: 'Reporte de fabricacion', description: 'Avance por proyecto, atrasos y materiales faltantes.', href: '/operaciones/fabricacion', module: 'manufacturing', entity: 'fabricacion' },
  { title: 'Reporte operacional', description: 'Canchas por estado en toda la cadena.', href: '/operaciones/canchas', module: 'courts', entity: 'canchas' },
  { title: 'Reporte de logistica', description: 'Embarques, contenedores, aduana y ETAs.', href: '/operaciones/logistica', module: 'logistics', entity: 'logistica' },
  { title: 'Reporte de instalaciones', description: 'Instalaciones planificadas, en curso y recepcionadas.', href: '/operaciones/instalaciones', module: 'installations', entity: 'instalaciones' },
  { title: 'Reporte financiero', description: 'Facturacion, cobros, cuentas por cobrar y por pagar con aging.', href: '/finanzas/facturas', module: 'invoices', entity: 'facturas' },
  { title: 'Reporte de rentabilidad', description: 'Margen estimado vs real por venta y desviaciones de costo.', href: '/finanzas/rentabilidad', module: 'profitability', entity: 'rentabilidad' },
  { title: 'Reporte de clientes', description: 'Cartera, pipeline por cliente y deuda pendiente.', href: '/comercial/clientes', module: 'clients', entity: 'clientes' },
] as const;

export default async function ReportsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const available = REPORTS.filter((r) => moduleVisible(project, r.module));

  return (
    <>
      <PageHeader title="Reportes" subtitle={`${available.length} reportes disponibles para tu rol`} />
      <SectionTitle>Reportes operativos</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {available.map((report) => {
          const canExport = can(project, `${report.module}.export`);
          return (
            <Card key={report.href} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <BarChart3 size={16} className="text-accent" />
                <Link
                  href={`${base}${report.href}`}
                  className="text-content-muted transition hover:text-accent"
                  aria-label={`Ver ${report.title}`}
                >
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <h3 className="mt-3 text-sm font-medium">{report.title}</h3>
              <p className="mt-1 text-2xs leading-relaxed text-content-secondary">{report.description}</p>

              {canExport ? (
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  <a
                    href={`/api/export?project=${project.code}&entity=${report.entity}&format=csv`}
                    download
                    className="btn-ghost text-2xs"
                  >
                    <Download size={12} /> CSV
                  </a>
                  <a
                    href={`/api/export?project=${project.code}&entity=${report.entity}&format=xlsx`}
                    download
                    className="btn-ghost text-2xs"
                  >
                    <Download size={12} /> XLSX
                  </a>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-2xs text-content-muted">
        Cada exportacion consulta con tu sesion: si RLS no te deja ver una fila en pantalla,
        tampoco aparece en el archivo descargado.
      </p>
    </>
  );
}
