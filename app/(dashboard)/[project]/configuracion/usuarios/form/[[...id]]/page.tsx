import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getRoleOptions } from '@/lib/services/options';
import { can } from '@/lib/permissions';
import { Card, ErrorState, PageHeader } from '@/components/ui';
import { UserForm, type UserRecord } from '@/components/settings/user-form';

export const metadata: Metadata = { title: 'Usuario' };

export default async function UserFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/configuracion/usuarios`;

  if (!can(project, 'settings.manage')) {
    return (
      <>
        <PageHeader title={id ? 'Editar usuario' : 'Nuevo usuario'} />
        <ErrorState
          title="Sin acceso"
          description="Solo un administrador de este proyecto puede gestionar usuarios."
        />
      </>
    );
  }

  let record: UserRecord | null = null;
  if (id) {
    const supabase = await createClient();
    const [profileRes, accessRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, job_title, active').eq('id', id).maybeSingle(),
      supabase
        .from('user_project_access')
        .select('role_id')
        .eq('user_id', id)
        .eq('project_id', project.id)
        .maybeSingle(),
    ]);
    if (!profileRes.data) notFound();
    record = { ...profileRes.data, role_id: accessRes.data?.role_id ?? null };
  }

  const roles = await getRoleOptions();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={back} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Usuarios
          </Link>
        }
        title={id ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle={id ? record?.email : `Se creara en ${project.name}`}
      />
      <Card className="max-w-2xl p-6">
        <UserForm projectCode={project.code} record={record} roles={roles} cancelHref={back} />
      </Card>
    </>
  );
}
