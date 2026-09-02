-- =====================================================================
-- 05_analisis_a_pedido.sql — la carga deja de analizar; cada parte se pide.
--
-- Antes, subir un documento encadenaba las ocho etapas del pipeline de una
-- sola vez. Ahora la carga solo extrae el texto, lo trocea y lo clasifica; el
-- resumen, los sistemas, la línea de tiempo, la evaluación, los puntos
-- críticos y los vectores del chat se piden uno por uno desde la ficha.
--
-- Este archivo hace tres cosas:
--   1. Guarda el estado de cada parte por versión (document_analysis_parts).
--   2. Agrega al resumen los campos nuevos: exigencia de ISO 9001/27001 y
--      migración de datos (si se exige, plazo y volumen).
--   3. Suma 'cargado' como estado terminal de la carga.
--
-- Aplicar TAL CUAL en Neon y en Supabase: el interruptor DATABASE_URL puede
-- estar apuntando a cualquiera de los dos y el código es el mismo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estado de cada parte, por versión del documento.
--
-- Por versión y no por documento: reanalizar con otro motor crea una versión
-- nueva, y lo que ya se analizó de la anterior sigue siendo válido para ella.
-- ---------------------------------------------------------------------
create table if not exists public.document_analysis_parts (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  version_id    uuid not null references public.document_versions(id) on delete cascade,
  part          text not null check (part in ('resumen','sistemas','timeline','evaluacion','criticos','chat')),
  status        text not null check (status in ('procesando','listo','error')),
  error         text,
  engine        text,
  updated_at    timestamptz not null default now(),
  unique (version_id, part)
);

create index if not exists document_analysis_parts_document_idx
  on public.document_analysis_parts(document_id);

alter table public.document_analysis_parts enable row level security;

-- Misma frontera que el documento del que cuelga: si lo ves, ves el estado
-- de sus análisis. No se replica la lógica de documents_select — se delega
-- en ella, para que no puedan divergir.
drop policy if exists document_analysis_parts_select on public.document_analysis_parts;
create policy document_analysis_parts_select on public.document_analysis_parts
  for select using (
    exists (select 1 from public.documents d where d.id = document_id)
  );

drop policy if exists document_analysis_parts_write on public.document_analysis_parts;
create policy document_analysis_parts_write on public.document_analysis_parts
  for all using (
    exists (select 1 from public.documents d where d.id = document_id)
  ) with check (
    exists (select 1 from public.documents d where d.id = document_id)
  );

grant select, insert, update, delete on public.document_analysis_parts to app_user;
grant select, insert, update, delete on public.document_analysis_parts to service_role;
grant select, insert, update, delete on public.document_analysis_parts to authenticated;

-- ---------------------------------------------------------------------
-- 2. Campos nuevos del resumen.
--
-- jsonb y no columnas sueltas porque cada uno es un objeto con la misma
-- forma que devuelve la IA (exigida/detalle/página/cita), y se muestra
-- entero: partirlo en seis columnas no aportaría ninguna consulta que hoy
-- se haga.
-- ---------------------------------------------------------------------
alter table public.document_summaries
  add column if not exists iso_9001 jsonb,
  add column if not exists iso_27001 jsonb,
  add column if not exists data_migration jsonb;

comment on column public.document_summaries.iso_9001 is
  'Exigencia de ISO 9001: {exigida, detalle, pagina, cita}. exigida=null → el documento no la menciona.';
comment on column public.document_summaries.iso_27001 is
  'Exigencia de ISO 27001: {exigida, detalle, pagina, cita}.';
comment on column public.document_summaries.data_migration is
  'Migración de datos: {exigida, plazo, volumen, detalle} — si se exige, en cuánto tiempo y cuánta información.';

-- ---------------------------------------------------------------------
-- 3. 'cargado': el documento está listo para consultar, sin analizar aún.
--
-- Estado intermedio que antes no existía porque no había nada entre "subido"
-- y "procesado". Los documentos anteriores conservan 'procesado' y se siguen
-- viendo igual.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'documents_status_check' and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents drop constraint documents_status_check;
  end if;
end;
$$;

alter table public.documents
  add constraint documents_status_check
  check (status in ('subido','procesando','cargado','procesado','error'));
