import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { ErrorState, PageHeader } from '@/components/ui';
import { CatalogEditor } from '@/components/settings/catalog-editor';
import type { ColorOption, CourtModel, LogoPosition } from '@/types/database.types';

export const metadata: Metadata = { title: 'Catalogos' };

export default async function CatalogsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  if (!can(project, 'settings.view')) {
    return (
      <>
        <PageHeader title="Catalogos" />
        <ErrorState title="Sin acceso" description="Tu rol no permite ver la configuracion de este proyecto." />
      </>
    );
  }

  const supabase = await createClient();
  const [modelsRes, positionsRes, turfRes, postRes] = await Promise.all([
    supabase.from('court_models').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('logo_positions').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('turf_colors').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('light_post_colors').select('*').eq('project_id', project.id).order('sort_order'),
  ]);

  const models = (modelsRes.data ?? []) as CourtModel[];
  const positions = (positionsRes.data ?? []) as LogoPosition[];
  const turfColors = (turfRes.data ?? []) as ColorOption[];
  const postColors = (postRes.data ?? []) as ColorOption[];
  const editable = can(project, 'settings.manage');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/configuracion`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Configuracion
          </Link>
        }
        title="Catalogos de negocio"
        subtitle={project.name}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <CatalogEditor
          projectCode={project.code}
          kind="court_models"
          title={`Tipos de cancha (${models.length})`}
          description="Modelos que se pueden vender y la comision que se propone por cada uno."
          rows={models}
          editable={editable}
        />

        <CatalogEditor
          projectCode={project.code}
          kind="logo_positions"
          title={`Ubicaciones de logo (${positions.length})`}
          description="Lugares de la cancha donde puede ir el logo de Atila o el del club."
          rows={positions}
          editable={editable}
        />

        <CatalogEditor
          projectCode={project.code}
          kind="turf_colors"
          title={`Colores de cesped (${turfColors.length})`}
          description="Carta de color del cesped. El color elegido alimenta la vista 3D de muestra."
          rows={turfColors}
          editable={editable}
        />

        <CatalogEditor
          projectCode={project.code}
          kind="light_post_colors"
          title={`Colores de postes de luz (${postColors.length})`}
          description="Carta propia de los postes: puede no coincidir con la del cesped."
          rows={postColors}
          editable={editable}
        />
      </div>
    </>
  );
}
