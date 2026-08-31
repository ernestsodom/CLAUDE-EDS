import type { Metadata } from 'next';
import Link from 'next/link';
import { UserCog, ListTree } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatPercent, humanize } from '@/lib/format';
import { Card, ErrorState, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { ModuleToggles } from '@/components/settings/module-toggles';

export const metadata: Metadata = { title: 'Configuracion' };

export default async function SettingsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project, session } = await requireProject(projectCode);

  if (!can(project, 'settings.view')) {
    return (
      <>
        <PageHeader title="Configuracion" />
        <ErrorState title="Sin acceso" description="Tu rol no permite ver la configuracion de este proyecto." />
      </>
    );
  }

  const supabase = await createClient();
  const [projectRes, modulesRes, catalogRes, accessRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', project.id).maybeSingle(),
    supabase.from('project_modules').select('module_code, enabled').eq('project_id', project.id),
    // El catalogo completo, no solo lo ya configurado: un modulo que
    // nunca se activo no tiene fila en project_modules y aun asi debe
    // poder encenderse.
    supabase.from('modules').select('code, name, category, sort_order').order('sort_order'),
    can(project, 'settings.manage')
      ? supabase.from('user_project_access')
          // `user_project_access` tiene DOS claves foraneas hacia `profiles`
          // (user_id y granted_by): hay que desambiguar el embed indicando la
          // FK, o PostgREST responde 300 en tiempo de ejecucion.
          .select('id, active, profiles!user_project_access_user_id_fkey(full_name, email), roles(code, name)')
          .eq('project_id', project.id)
      : Promise.resolve({ data: [] }),
  ]);

  const proj = projectRes.data as {
    name: string; code: string; default_currency: string; timezone: string;
    court_kind: string; country_scope: string[];
    cost_deviation_threshold_pct: number; min_margin_threshold_pct: number;
  } | null;

  const enabledByCode = new Map(
    ((modulesRes.data ?? []) as { module_code: string; enabled: boolean }[]).map((m) => [
      m.module_code,
      m.enabled,
    ]),
  );

  const modules = ((catalogRes.data ?? []) as { code: string; name: string; category: string }[]).map(
    (m) => ({
      module_code: m.code,
      name: m.name,
      category: m.category,
      enabled: enabledByCode.get(m.code) ?? false,
    }),
  );

  const access = (accessRes.data ?? []) as unknown as {
    id: string; active: boolean;
    profiles: { full_name: string | null; email: string } | null;
    roles: { code: string; name: string } | null;
  }[];

  return (
    <>
      <PageHeader title="Configuracion" subtitle={project.name} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Unidad de negocio</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Nombre">{proj?.name}</Field>
            <Field label="Codigo">{proj?.code}</Field>
            <Field label="Moneda por defecto">{proj?.default_currency}</Field>
            <Field label="Zona horaria">{proj?.timezone}</Field>
            <Field label="Tipo de cancha">{humanize(proj?.court_kind)}</Field>
            <Field label="Paises">{proj?.country_scope?.join(', ') || '—'}</Field>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Umbrales de alerta</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Desviacion de costo">
              {formatPercent(proj?.cost_deviation_threshold_pct ?? null)}
            </Field>
            <Field label="Margen minimo">
              {formatPercent(proj?.min_margin_threshold_pct ?? null)}
            </Field>
          </dl>
          <p className="mt-3 text-2xs leading-relaxed text-content-muted">
            El motor de alertas usa estos umbrales por proyecto: si el costo real supera al
            estimado por encima del primero, se genera COSTO_EXCEDIDO; si el margen cae por debajo
            del segundo, MARGEN_BAJO.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Modulos habilitados ({modules.filter((m) => m.enabled).length})</SectionTitle>
          <ModuleToggles
            projectCode={project.code}
            modules={modules}
            editable={can(project, 'settings.manage')}
          />
          <p className="mt-3 text-2xs text-content-muted">
            Activar o desactivar un modulo es un cambio de datos, no de codigo: el menu se
            reconstruye en el siguiente render. Apagar un modulo no borra su informacion, solo
            deja de mostrarla.
          </p>
        </Card>

        {project.modules.includes('deals') ? (
          <Card>
            <SectionTitle>Catalogos de negocio</SectionTitle>
            <p className="text-sm text-content-secondary">
              Los tipos de cancha y las ubicaciones de logo son datos editables: se cambian aqui,
              sin tocar el codigo ni desplegar.
            </p>
            <Link
              href={`/${project.code}/configuracion/catalogos`}
              className="btn-secondary mt-4 inline-flex"
            >
              <ListTree size={15} />
              Gestionar catalogos
            </Link>
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Tu acceso</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Usuario">{session.user?.full_name ?? session.user?.email}</Field>
            <Field label="Rol en este proyecto">{project.role ?? '—'}</Field>
            <Field label="Permisos efectivos">{project.permissions.length}</Field>
            <Field label="Super admin">{session.user?.is_super_admin ? 'Si' : 'No'}</Field>
          </dl>
        </Card>

        {access.length > 0 ? (
          <Card padded={false} className="lg:col-span-2">
            <div className="flex items-center justify-between px-4 pt-4">
              <SectionTitle>Usuarios con acceso ({access.length})</SectionTitle>
              {can(project, 'settings.manage') ? (
                <Link
                  href={`/${project.code}/configuracion/usuarios`}
                  className="inline-flex items-center gap-1.5 text-2xs font-medium text-accent hover:underline"
                >
                  <UserCog size={13} />
                  Gestionar usuarios
                </Link>
              ) : null}
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {access.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <span className="text-sm">{a.profiles?.full_name ?? '—'}</span>
                    <span className="block text-2xs text-content-muted">{a.profiles?.email}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={a.roles?.code ?? null} tone="accent" />
                    {!a.active ? <StatusBadge status="INACTIVO" /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
