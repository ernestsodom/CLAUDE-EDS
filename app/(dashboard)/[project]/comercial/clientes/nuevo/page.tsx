import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { Card, ErrorState, PageHeader } from '@/components/ui';
import { ClientForm } from '@/components/commercial/client-form';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default async function NewClientPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);

  if (!can(project, 'clients.create')) {
    return (
      <>
        <PageHeader title="Nuevo cliente" />
        <ErrorState title="Sin permiso" description="Tu rol no permite crear clientes en esta unidad de negocio." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/${project.code}/comercial/clientes`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Clientes
          </Link>
        }
        title="Nuevo cliente"
        subtitle={`Se creara en ${project.name}`}
      />
      <Card className="max-w-2xl p-6">
        <ClientForm projectCode={project.code} />
      </Card>
    </>
  );
}
