import { NextRequest, NextResponse } from 'next/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { buildCsv, buildXlsx, exportFileName, type ExportRow } from '@/lib/services/export';
import { EXPORTS, type ExportKey } from '@/lib/services/export-registry';

export const dynamic = 'force-dynamic';

/**
 * Exportación de reportes (FASE 15, §65).
 *
 * `?entity=ventas&project=EUROPA&format=xlsx`
 *
 * Tres cosas garantizan que esto no es un atajo alrededor de la
 * seguridad, sino la misma pantalla en otro formato:
 *
 *  - `entity` solo puede ser una clave de la whitelist `EXPORTS`, nunca
 *    un nombre de tabla que llegue del cliente.
 *  - El permiso exigido es `<module>.export`, comprobado con `can()`
 *    sobre el contexto de sesión real.
 *  - La consulta se hace con `createClient()` — el cliente del usuario,
 *    no la service role — así que RLS sigue siendo quien decide qué
 *    filas existen, exactamente igual que en la tabla que se ve en
 *    pantalla.
 *
 * El límite de 5000 filas es deliberado: un export es para abrir en
 * Excel, no para volcar la base entera por HTTP.
 */
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectCode = searchParams.get('project');
  const entityKey = searchParams.get('entity');
  const format = (searchParams.get('format') ?? 'csv').toLowerCase();

  if (!projectCode || !entityKey) {
    return NextResponse.json({ error: 'Faltan los parametros project y entity.' }, { status: 400 });
  }
  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json({ error: 'Formato no soportado: usa csv o xlsx.' }, { status: 400 });
  }

  const definition = EXPORTS[entityKey as ExportKey];
  if (!definition) {
    return NextResponse.json({ error: 'Ese reporte no existe.' }, { status: 404 });
  }

  // `requireProject` redirige a /login o /sin-acceso si hace falta — el
  // mismo comportamiento que cualquier pagina bajo /[project], y correcto
  // aqui porque el enlace de exportar es una navegacion de navegador
  // (`<a href download>`), no una llamada fetch que espere siempre JSON.
  const { project } = await requireProject(projectCode);

  if (!can(project, `${definition.module}.export`)) {
    return NextResponse.json(
      { error: 'No tienes permiso para exportar este reporte en este proyecto.' },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from(definition.from)
    .select(definition.columns.map((c) => c.key).join(','))
    .eq('project_id', project.id)
    .order(definition.orderBy.column, { ascending: definition.orderBy.ascending ?? false })
    .limit(MAX_ROWS);

  if (definition.softDelete) query = query.is('deleted_at', null);

  const { data, error } = await query;

  if (error) {
    console.error(`[export:${entityKey}]`, error.message);
    return NextResponse.json({ error: 'No se pudo generar el reporte.' }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ExportRow[];
  const fileName = exportFileName(`${entityKey}-${project.code}`, format);

  if (format === 'xlsx') {
    const buffer = buildXlsx(definition.columns, rows, entityKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const csv = buildCsv(definition.columns, rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
