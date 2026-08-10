import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Healthcheck (FASE 15).
 *
 * Vercel, un monitor de uptime o un balanceador necesitan una forma
 * barata de saber si "la aplicacion responde" es distinto de "la base de
 * datos responde". Una consulta de una fila con `count: 'exact', head:
 * true` sobre `projects` basta: no trae datos, solo confirma la
 * conexion. Usa la service role porque el healthcheck no tiene sesion de
 * usuario detras, y `027_ops_hardening.sql` le concede SELECT explicito
 * sobre `projects` para esto.
 *
 * No expone nada sensible: ni conteos de negocio, ni nombres, ni
 * mensajes de error crudos de PostgreSQL.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('projects').select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        { status: 'error', database: 'unreachable', latency_ms: Date.now() - startedAt },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      database: 'reachable',
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'unconfigured', latency_ms: Date.now() - startedAt },
      { status: 503 },
    );
  }
}
