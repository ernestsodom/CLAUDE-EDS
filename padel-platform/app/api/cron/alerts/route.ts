import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Dispara el motor de alertas (FASE 15).
 *
 * `app.generate_alerts()` existe desde la FASE 1 pero vivia en el
 * esquema `app` sin ninguna via de ejecucion en produccion: no hay
 * pg_cron en Supabase gestionado con el plan por defecto, y la funcion
 * esta deliberadamente fuera del alcance de `authenticated`. Este
 * endpoint es esa via: lo llama Vercel Cron (ver `vercel.json`) con la
 * service role, a traves del wrapper `public.run_generate_alerts()` que
 * SI tiene EXECUTE concedido a `service_role` (027_ops_hardening.sql).
 *
 * Protegido por un secreto compartido, no por ser "dificil de adivinar
 * la URL": sin el header correcto, 401 y no se ejecuta nada.
 *
 * Se acepta `CRON_SECRET` ademas de `ALERTS_CRON_SECRET` porque Vercel
 * Cron inyecta automaticamente `Authorization: Bearer $CRON_SECRET`
 * cuando esa variable exacta existe en el proyecto — sin tener que
 * configurar cabeceras a mano. Si se despliega fuera de Vercel (o se
 * prefiere no acoplarse a ese nombre reservado), basta con definir
 * `ALERTS_CRON_SECRET` y llamar al endpoint desde cualquier scheduler
 * externo, como hace `.github/workflows/alerts-cron.yml`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? process.env.ALERTS_CRON_SECRET;
  if (!secret) {
    console.error('[cron:alerts] Ni CRON_SECRET ni ALERTS_CRON_SECRET estan configurados.');
    return NextResponse.json({ error: 'No configurado.' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('run_generate_alerts');

  if (error) {
    console.error('[cron:alerts]', error.message);
    return NextResponse.json({ error: 'El motor de alertas fallo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data, ranAt: new Date().toISOString() });
}

// Vercel Cron invoca por GET; se acepta como alias de POST.
export const GET = POST;
