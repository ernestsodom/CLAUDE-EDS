-- =====================================================================
-- 027_ops_hardening.sql
-- FASE 15 — Hardening: lo que hace falta para operar en producción,
-- no para demostrar una pantalla.
--
-- El motor de alertas (`app.generate_alerts`) existe desde la FASE 1 pero
-- no tiene ninguna forma de ejecutarse en producción:
--   - vive en el esquema `app`, que PostgREST no expone
--   - se le revocó EXECUTE a `public` y a `authenticated` (022_rls.sql)
--   - nadie le concedió EXECUTE a `service_role`
-- Sin este wrapper, el Control Center nunca se habría actualizado solo.
-- =====================================================================

create or replace function public.run_generate_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  return app.generate_alerts();
end;
$$;

comment on function public.run_generate_alerts is
  'Wrapper expuesto por PostgREST para disparar el motor de alertas desde un cron externo. Solo service_role puede ejecutarlo.';

revoke execute on function public.run_generate_alerts() from public, anon, authenticated;
grant execute on function public.run_generate_alerts() to service_role;

-- ---------------------------------------------------------------------
-- Salud de la base para /api/health.
--
-- Una consulta de una fila con `count(*)` sobre `projects` basta para
-- distinguir "la base responde" de "la base no responde"; no hace falta
-- una función dedicada. Lo que sí hace falta es que el rol usado por el
-- healthcheck (service_role) pueda ejecutar la consulta sin tropezar con
-- RLS aunque no haya ningún usuario autenticado detrás.
-- ---------------------------------------------------------------------
grant select on public.projects to service_role;
