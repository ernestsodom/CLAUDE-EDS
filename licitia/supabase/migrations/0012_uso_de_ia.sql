-- ============================================================================
-- LicitIA — Registro de consumo real de IA por proveedor (Gemini, Groq,
-- Claude Haiku 4.5): cada llamado a un modelo queda anotado con los tokens
-- que el propio proveedor reportó (nunca estimados), para poder ver cuánto
-- se ha consumido y, en el caso de Claude —el único de pago—, su costo.
--
-- Gemini y Groq no exponen un saldo/crédito por API con una API key normal
-- (solo límites de tasa por minuto/día en sus paneles); este registro mide
-- lo que la propia app consumió, que es lo verificable desde aquí.
-- ============================================================================

create table if not exists ai_usage_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  provider         text not null,   -- gemini | groq | claude
  model            text not null,
  -- Etapa/función que generó el consumo: clasificacion, resumen, sistemas,
  -- requerimientos, timeline, chat, comparacion_cumplimiento,
  -- comparacion_diff, reclamo_analisis, reclamo_respuesta.
  feature          text not null,
  input_tokens     int not null default 0,
  output_tokens    int not null default 0,
  document_id      uuid references documents(id) on delete set null,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_ai_usage_org_created on ai_usage_log(organization_id, created_at desc);
create index if not exists idx_ai_usage_org_provider on ai_usage_log(organization_id, provider, created_at desc);

alter table ai_usage_log enable row level security;

drop policy if exists ai_usage_select on ai_usage_log;
create policy ai_usage_select on ai_usage_log for select
  using (organization_id = current_org_id());

-- Sin política de insert: el registro lo escribe siempre el pipeline del
-- servidor con el cliente de service_role (igual que audit_logs), nunca
-- directamente el navegador.
