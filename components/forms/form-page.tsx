import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, ErrorState, PageHeader } from '@/components/ui';
import type { SessionProject } from '@/types/database.types';
import { can } from '@/lib/permissions';

/**
 * Marco comun de las pantallas de alta y edicion: migas, titulo segun el
 * modo y comprobacion de permiso antes de mostrar nada. Evita que cada
 * formulario reinvente la cabecera o se olvide de comprobar el permiso.
 */
export function FormPage({
  project,
  module,
  isEdit,
  entityLabel,
  backHref,
  backLabel,
  subtitle,
  width = 'max-w-3xl',
  children,
}: {
  project: SessionProject;
  module: string;
  isEdit: boolean;
  entityLabel: string;
  backHref: string;
  backLabel: string;
  subtitle?: string;
  width?: string;
  children: ReactNode;
}) {
  const permission = `${module}.${isEdit ? 'update' : 'create'}`;

  if (!can(project, permission)) {
    return (
      <>
        <PageHeader title={isEdit ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`} />
        <ErrorState
          title="Sin permiso"
          description={`Tu rol en ${project.name} no permite ${isEdit ? 'modificar' : 'crear'} ${entityLabel}.`}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={backHref} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> {backLabel}
          </Link>
        }
        title={isEdit ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`}
        subtitle={subtitle ?? (isEdit ? undefined : `Se creara en ${project.name}`)}
      />
      <Card className={`${width} p-6`}>{children}</Card>
    </>
  );
}
