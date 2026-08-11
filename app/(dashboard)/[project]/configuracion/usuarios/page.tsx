import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, UserCog } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { Card, ErrorState, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToggleAccessButton } from '@/components/settings/toggle-access-button';
import { ResetPasswordButton } from '@/components/settings/reset-password-button';

export const metadata: Metadata = { title: 'Usuarios' };

interface UserRow {
  id: string;
  user_id: string;
  active: boolean;
  profiles: { full_name: string | null; email: string; job_title: string | null } | null;
  roles: { id: string; code: string; name: string } | null;
}

export default async function UsersPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  if (!can(project, 'settings.manage')) {
    return (
      <>
        <PageHeader title="Usuarios" />
        <ErrorState
          title="Sin acceso"
          description="Solo un administrador de este proyecto puede gestionar usuarios."
        />
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_project_access')
    // Misma desambiguacion de FK que en configuracion/page.tsx (§ ver ahi).
    .select('id, user_id, active, profiles!user_project_access_user_id_fkey(full_name, email, job_title), roles(id, code, name)')
    .eq('project_id', project.id)
    .order('active', { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Usuarios" />
        <ErrorState retryHref={`${base}/configuracion/usuarios`} />
      </>
    );
  }

  const users = (data ?? []) as unknown as UserRow[];

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={`${users.length} con acceso a ${project.name}`}
        actions={
          <Link href={`${base}/configuracion/usuarios/form`} className="btn-primary">
            <Plus size={15} />
            Nuevo usuario
          </Link>
        }
      />

      <Card padded={false}>
        <div className="px-4 pt-4">
          <SectionTitle>Usuarios del proyecto</SectionTitle>
        </div>
        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-content-muted">
            <UserCog size={22} />
            <p className="text-sm">Todavia no hay usuarios asignados a este proyecto.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`${base}/configuracion/usuarios/form/${u.user_id}`}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {u.profiles?.full_name ?? '—'}
                  </Link>
                  <span className="block text-2xs text-content-muted">
                    {u.profiles?.email}
                    {u.profiles?.job_title ? ` · ${u.profiles.job_title}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={u.roles?.code ?? null} tone="accent" />
                  {!u.active ? <StatusBadge status="INACTIVO" /> : null}
                  <ResetPasswordButton projectCode={project.code} userId={u.user_id} />
                  <ToggleAccessButton projectCode={project.code} userId={u.user_id} active={u.active} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
