import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { moduleVisible } from '@/lib/permissions';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const metadata: Metadata = { title: 'Reportes' };

/**
 * Reportes (§65).
 *
 * Cada reporte es una vista analitica ya existente en PostgreSQL con los
 * filtros aplicados. No se recalcula nada en el navegador, por lo que un
 * reporte y el dashboard nunca pueden dar cifras distintas.
 */
const REPORTS = [
  { title: 'Reporte comercial', description: 'Pipeline, oportunidades por etapa y tasa de conversion.', href: '/comercial/oportunidades', module: 'opportunities' },
  { title: 'Reporte de ventas', description: 'Ventas por estado, cliente y periodo, con avance de entrega.', href: '/ventas', module: 'sales' },
  { title: 'Reporte de fabricacion', description: 'Avance por proyecto, atrasos y materiales faltantes.', href: '/operaciones/fabricacion', module: 'manufacturing' },
  { title: 'Reporte operacional', description: 'Canchas por estado en toda la cadena.', href: '/operaciones/canchas', module: 'courts' },
  { title: 'Reporte de logistica', description: 'Embarques, contenedores, aduana y ETAs.', href: '/operaciones/logistica', module: 'logistics' },
  { title: 'Reporte de instalaciones', description: 'Instalaciones planificadas, en curso y recepcionadas.', href: '/operaciones/instalaciones', module: 'installations' },
  { title: 'Reporte financiero', description: 'Facturacion, cobros, cuentas por cobrar y por pagar con aging.', href: '/finanzas/facturas', module: 'invoices' },
  { title: 'Reporte de rentabilidad', description: 'Margen estimado vs real por venta y desviaciones de costo.', href: '/finanzas/rentabilidad', module: 'profitability' },
  { title: 'Reporte de clientes', description: 'Cartera, pipeline por cliente y deuda pendiente.', href: '/comercial/clientes', module: 'clients' },
];

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
        {available.map((report) => (
          <Link key={report.href} href={`${base}${report.href}`} className="card card-hover group p-4">
            <div className="flex items-start justify-between gap-2">
              <BarChart3 size={16} className="text-accent" />
              <ArrowUpRight size={14} className="text-content-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <h3 className="mt-3 text-sm font-medium">{report.title}</h3>
            <p className="mt-1 text-2xs leading-relaxed text-content-secondary">{report.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-2xs text-content-muted">
        Cada listado incluye exportacion a CSV. La exportacion respeta los mismos filtros y los
        mismos permisos que la pantalla.
      </p>
    </>
  );
}
