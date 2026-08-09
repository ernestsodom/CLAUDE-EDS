import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { session, project } = await requireProject(projectCode);

  // Contadores del menu. `head: true` + `count: exact` trae solo el numero,
  // nunca las filas.
  const supabase = await createClient();
  const [alerts, tasks] = await Promise.all([
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .in('status', ['ABIERTA', 'RECONOCIDA', 'EN_GESTION']),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .in('status', ['PENDIENTE', 'EN_CURSO', 'BLOQUEADA']),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        project={project}
        projects={session.projects}
        alertCount={alerts.count ?? 0}
        taskCount={tasks.count ?? 0}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={session.user!} />
        <main className="flex-1 px-4 py-6 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
