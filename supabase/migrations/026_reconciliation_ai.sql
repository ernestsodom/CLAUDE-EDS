-- =====================================================================
-- 026_reconciliation_ai.sql
--
-- Soporte de base de datos para las tres ultimas fases funcionales:
--
--   FASE 9b  Conciliacion bancaria: lotes de importacion idempotentes y
--            cuadre de movimientos contra pagos y gastos.
--   FASE 10  Documentacion: numeracion de versiones y aprobaciones sin
--            que el cliente pueda inventarse el numero de version.
--   FASE 14  IA: modulo `ai`, permiso de aprobacion documental y las dos
--            funciones que hacen cumplir la revision humana (§42).
--
-- Principio que se mantiene: las reglas que no pueden romperse viven en
-- PostgreSQL. El frontend puede equivocarse; la base no lo permite.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Modulo IA y permisos nuevos
-- ---------------------------------------------------------------------
insert into public.modules (code, name, category, icon, sort_order) values
  ('ai', 'Asistente IA', 'GENERAL', 'sparkles', 115)
on conflict (code) do nothing;

insert into public.permissions (code, module_code, action, description) values
  ('ai.view',            'ai',        'view',    'Usar el asistente y consultar extracciones de IA'),
  ('ai.create',          'ai',        'create',  'Lanzar extracciones de documentos con IA'),
  ('documents.approve',  'documents', 'approve', 'Revisar y aprobar extracciones y documentos')
on conflict (code) do nothing;

-- Los permisos creados despues de 004 no entran por el cross join
-- original: hay que asignarlos explicitamente.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where p.code in ('ai.view','ai.create','documents.approve')
   and (
     r.code in ('ADMIN','GERENCIA')
     or (r.code = 'FINANZAS'    and p.code in ('ai.view','ai.create','documents.approve'))
     or (r.code = 'COMERCIAL'   and p.code in ('ai.view','ai.create'))
     or (r.code = 'OPERACIONES' and p.code in ('ai.view','ai.create'))
     or (r.code = 'LECTURA'     and p.code = 'ai.view')
   )
on conflict do nothing;

-- Habilitado en los tres proyectos existentes.
insert into public.project_modules (project_id, module_code, enabled)
select p.id, 'ai', true from public.projects p
on conflict (project_id, module_code) do nothing;

-- ---------------------------------------------------------------------
-- 2) FASE 9b — Lotes de importacion de extractos bancarios
--
-- El lote existe para poder responder tres preguntas que siempre acaban
-- surgiendo: que fichero entro, quien lo subio y que hizo (cuantos
-- movimientos nuevos, cuantos ya estaban). La idempotencia real la da
-- `bank_transactions.import_hash`, que ya tiene indice unico por cuenta.
-- ---------------------------------------------------------------------
create table public.bank_import_batches (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  bank_account_id   uuid not null references public.bank_accounts(id) on delete cascade,
  file_name         text not null,
  file_format       text not null,               -- CSV | XLSX
  row_count         integer not null default 0,  -- filas leidas del fichero
  inserted_count    integer not null default 0,  -- movimientos nuevos
  duplicate_count   integer not null default 0,  -- ya presentes (mismo hash)
  error_count       integer not null default 0,
  period_from       date,
  period_to         date,
  notes             text,
  imported_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint bank_import_batches_format_ck check (file_format in ('CSV','XLSX')),
  constraint bank_import_batches_counts_ck  check (
    row_count >= 0 and inserted_count >= 0 and duplicate_count >= 0 and error_count >= 0
  )
);

create index bank_import_batches_project_idx on public.bank_import_batches (project_id, created_at desc);
create index bank_import_batches_account_idx on public.bank_import_batches (bank_account_id, created_at desc);

alter table public.bank_transactions
  add constraint bank_transactions_batch_fk
  foreign key (import_batch_id) references public.bank_import_batches(id) on delete set null;

-- ---------------------------------------------------------------------
-- CORRECCION del indice de idempotencia.
--
-- El indice original era PARCIAL (`where import_hash is not null`), y un
-- indice parcial no sirve como destino de `ON CONFLICT` salvo repitiendo
-- su clausula WHERE, cosa que la API REST no puede expresar. Resultado:
-- el upsert de la importacion fallaba con
--
--   42P10 there is no unique or exclusion constraint matching the
--         ON CONFLICT specification
--
-- El filtro tampoco aportaba nada: en un indice unico los NULL son
-- distintos entre si, asi que un indice total permite igualmente tantos
-- movimientos sin `import_hash` (los introducidos a mano) como haga falta.
-- ---------------------------------------------------------------------
drop index if exists public.bank_transactions_import_hash_uk;

create unique index bank_transactions_import_hash_uk
  on public.bank_transactions (bank_account_id, import_hash);

alter table public.bank_import_batches enable row level security;

create policy bank_import_batches_select on public.bank_import_batches
  for select to authenticated
  using (project_id in (select app.projects_with_permission('banks.view')));

create policy bank_import_batches_insert on public.bank_import_batches
  for insert to authenticated
  with check (project_id in (select app.projects_with_permission('banks.create')));

create policy bank_import_batches_update on public.bank_import_batches
  for update to authenticated
  using (project_id in (select app.projects_with_permission('banks.update')))
  with check (project_id in (select app.projects_with_permission('banks.update')));

create policy bank_import_batches_delete on public.bank_import_batches
  for delete to authenticated
  using (project_id in (select app.projects_with_permission('banks.delete')));

grant select, insert, update, delete on public.bank_import_batches to authenticated;

-- El lote no lleva `updated_at`: una vez cerrado es un hecho historico,
-- no un registro editable.

-- ---------------------------------------------------------------------
-- 3) FASE 9b — Candidatos de conciliacion
--
-- Devuelve los pagos y gastos que podrian corresponder a un movimiento
-- bancario. No decide: propone. La conciliacion la confirma una persona.
--
-- SECURITY INVOKER (por defecto): se ejecuta con los permisos de quien
-- llama, asi que RLS filtra tanto el movimiento como los candidatos.
-- ---------------------------------------------------------------------
create or replace function public.bank_match_candidates(
  p_transaction_id uuid,
  p_date_window    integer default 7,
  p_amount_tolerance numeric default 0.01
)
returns table (
  kind         text,           -- PAYMENT | EXPENSE
  id           uuid,
  entity_date  date,
  amount       numeric(14,2),
  currency     currency_code,
  reference    text,
  description  text,
  score        integer         -- 0..100, mayor es mejor candidato
)
language sql
stable
set search_path = public, pg_temp
as $$
  with tx as (
    select * from public.bank_transactions where id = p_transaction_id
  )
  select 'PAYMENT'::text,
         p.id,
         p.payment_date,
         p.amount,
         p.currency,
         p.reference,
         coalesce(p.notes, ''),
         (
           100
           - least(60, (abs(p.amount - abs(t.amount)) * 100)::integer)
           - least(30, abs(p.payment_date - t.transaction_date) * 3)
           + case when p.reference is not null and t.reference is not null
                       and upper(btrim(p.reference)) = upper(btrim(t.reference))
                  then 20 else 0 end
         )::integer
    from tx t
    join public.payments p
      on p.project_id = t.project_id
     and p.deleted_at is null
     and p.currency = t.currency
     and abs(p.amount - abs(t.amount)) <= p_amount_tolerance
     and p.payment_date between t.transaction_date - p_date_window
                            and t.transaction_date + p_date_window
     and ((t.amount > 0 and p.direction = 'ENTRADA')
       or (t.amount < 0 and p.direction = 'SALIDA'))
     and not exists (
       select 1 from public.bank_transactions b
        where b.payment_id = p.id and b.id <> t.id
     )

  union all

  select 'EXPENSE'::text,
         e.id,
         e.expense_date,
         e.amount,
         e.currency,
         null::text,
         e.description,
         (
           100
           - least(60, (abs(e.amount - abs(t.amount)) * 100)::integer)
           - least(30, abs(e.expense_date - t.transaction_date) * 3)
         )::integer
    from tx t
    join public.expenses e
      on e.project_id = t.project_id
     and e.deleted_at is null
     and e.currency = t.currency
     and t.amount < 0
     and abs(e.amount - abs(t.amount)) <= p_amount_tolerance
     and e.expense_date between t.transaction_date - p_date_window
                            and t.transaction_date + p_date_window
     and not exists (
       select 1 from public.bank_transactions b
        where b.expense_id = e.id and b.id <> t.id
     )

  order by 8 desc, 3
  limit 25;
$$;

comment on function public.bank_match_candidates is
  'Propone pagos y gastos compatibles con un movimiento bancario. Solo propone: conciliar es una decision humana.';

-- ---------------------------------------------------------------------
-- 4) FASE 9b — Conciliar y desconciliar
--
-- Se hace en la base y no en la aplicacion porque hay invariantes que no
-- pueden depender de que el frontend las recuerde: mismo proyecto, misma
-- direccion de dinero, importe coincidente y un pago conciliado como
-- mucho una vez.
-- ---------------------------------------------------------------------
create or replace function public.reconcile_bank_transaction(
  p_transaction_id uuid,
  p_payment_id     uuid default null,
  p_expense_id     uuid default null,
  p_tolerance      numeric default 0.01
)
returns public.bank_transactions
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tx      public.bank_transactions;
  v_amount  numeric(14,2);
  v_project uuid;
begin
  if (p_payment_id is null) = (p_expense_id is null) then
    raise exception 'Indica exactamente un pago o un gasto para conciliar'
      using errcode = '22023';
  end if;

  select * into v_tx from public.bank_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Movimiento bancario no encontrado o sin acceso' using errcode = 'P0002';
  end if;
  if v_tx.reconciled then
    raise exception 'El movimiento ya esta conciliado' using errcode = '22023';
  end if;

  if p_payment_id is not null then
    select p.amount, p.project_id into v_amount, v_project
      from public.payments p
     where p.id = p_payment_id and p.deleted_at is null
       and ((v_tx.amount > 0 and p.direction = 'ENTRADA')
         or (v_tx.amount < 0 and p.direction = 'SALIDA'));
    if not found then
      raise exception 'El pago no existe, no tienes acceso o su direccion no coincide con el movimiento'
        using errcode = 'P0002';
    end if;
    if exists (select 1 from public.bank_transactions b
                where b.payment_id = p_payment_id and b.id <> p_transaction_id) then
      raise exception 'Ese pago ya esta conciliado con otro movimiento' using errcode = '23505';
    end if;
  else
    select e.amount, e.project_id into v_amount, v_project
      from public.expenses e
     where e.id = p_expense_id and e.deleted_at is null;
    if not found then
      raise exception 'El gasto no existe o no tienes acceso' using errcode = 'P0002';
    end if;
    if v_tx.amount > 0 then
      raise exception 'Un gasto no puede conciliarse contra un ingreso' using errcode = '22023';
    end if;
    if exists (select 1 from public.bank_transactions b
                where b.expense_id = p_expense_id and b.id <> p_transaction_id) then
      raise exception 'Ese gasto ya esta conciliado con otro movimiento' using errcode = '23505';
    end if;
  end if;

  if v_project <> v_tx.project_id then
    raise exception 'Aislamiento de proyecto: el registro pertenece a otra unidad de negocio'
      using errcode = '42501';
  end if;

  if abs(v_amount - abs(v_tx.amount)) > p_tolerance then
    raise exception 'El importe no coincide (movimiento %, registro %)',
      abs(v_tx.amount), v_amount using errcode = '22023';
  end if;

  update public.bank_transactions
     set payment_id    = p_payment_id,
         expense_id    = p_expense_id,
         reconciled    = true,
         reconciled_at = now(),
         reconciled_by = auth.uid()
   where id = p_transaction_id
  returning * into v_tx;

  if not found then
    raise exception 'No tienes permiso para conciliar en este proyecto' using errcode = '42501';
  end if;

  return v_tx;
end;
$$;

create or replace function public.unreconcile_bank_transaction(p_transaction_id uuid)
returns public.bank_transactions
language plpgsql
set search_path = public, pg_temp
as $$
declare v_tx public.bank_transactions;
begin
  update public.bank_transactions
     set payment_id = null, expense_id = null, transfer_account_id = null,
         reconciled = false, reconciled_at = null, reconciled_by = null
   where id = p_transaction_id
  returning * into v_tx;

  if not found then
    raise exception 'Movimiento no encontrado o sin permiso para modificarlo' using errcode = 'P0002';
  end if;
  return v_tx;
end;
$$;

grant execute on function public.bank_match_candidates(uuid, integer, numeric)          to authenticated;
grant execute on function public.reconcile_bank_transaction(uuid, uuid, uuid, numeric)  to authenticated;
grant execute on function public.unreconcile_bank_transaction(uuid)                     to authenticated;

-- ---------------------------------------------------------------------
-- 5) FASE 9b — Estado de conciliacion por cuenta
-- ---------------------------------------------------------------------
create or replace view public.v_bank_reconciliation as
select
  ba.project_id,
  ba.id                                   as bank_account_id,
  ba.name                                 as account_name,
  ba.currency,
  count(bt.id)                            as total_transactions,
  count(bt.id) filter (where bt.reconciled)      as reconciled_transactions,
  count(bt.id) filter (where not bt.reconciled)  as pending_transactions,
  coalesce(sum(bt.amount) filter (where not bt.reconciled), 0)::numeric(14,2)
                                          as pending_amount,
  public.pct(
    count(bt.id) filter (where bt.reconciled)::numeric,
    nullif(count(bt.id), 0)::numeric
  )                                       as reconciled_pct,
  max(bt.transaction_date)                as last_movement_date
from public.bank_accounts ba
left join public.bank_transactions bt on bt.bank_account_id = ba.id
where ba.deleted_at is null
group by ba.project_id, ba.id, ba.name, ba.currency;

alter view public.v_bank_reconciliation set (security_invoker = on);
grant select on public.v_bank_reconciliation to authenticated;

-- ---------------------------------------------------------------------
-- 6) FASE 10 — Version siguiente de un documento
--
-- El numero de version no lo elige el cliente: lo asigna la base dentro
-- de la misma transaccion que registra el fichero, de modo que dos
-- subidas simultaneas no pueden compartir version.
-- ---------------------------------------------------------------------
create or replace function public.add_document_version(
  p_document_id  uuid,
  p_bucket       text,
  p_storage_path text,
  p_mime_type    text default null,
  p_file_size    bigint default null,
  p_file_hash    text default null,
  p_comment      text default null
)
returns public.document_versions
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_doc     public.documents;
  v_version integer;
  v_row     public.document_versions;
begin
  select * into v_doc from public.documents
   where id = p_document_id and deleted_at is null
   for update;
  if not found then
    raise exception 'Documento no encontrado o sin acceso' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.document_versions where document_id = p_document_id;

  -- La version 1 es el fichero con el que nacio el documento: si no esta
  -- registrada, se registra ahora para no perder el historico.
  if v_version = 1 then
    insert into public.document_versions
      (project_id, document_id, version, bucket, storage_path, mime_type,
       file_size, file_hash, status, comment, uploaded_by)
    values
      (v_doc.project_id, v_doc.id, 1, v_doc.bucket, v_doc.storage_path, v_doc.mime_type,
       v_doc.file_size, v_doc.file_hash, v_doc.status, 'Version inicial', v_doc.uploaded_by);
    v_version := 2;
  end if;

  insert into public.document_versions
    (project_id, document_id, version, bucket, storage_path, mime_type,
     file_size, file_hash, status, comment, uploaded_by)
  values
    (v_doc.project_id, v_doc.id, v_version, p_bucket, p_storage_path, p_mime_type,
     p_file_size, p_file_hash, 'VIGENTE', p_comment, auth.uid())
  returning * into v_row;

  update public.documents
     set bucket = p_bucket,
         storage_path = p_storage_path,
         mime_type = coalesce(p_mime_type, mime_type),
         file_size = coalesce(p_file_size, file_size),
         file_hash = p_file_hash,
         current_version = v_version
   where id = p_document_id;

  return v_row;
end;
$$;

grant execute on function public.add_document_version(uuid, text, text, text, bigint, text, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 7) FASE 10 — Decision sobre una aprobacion
-- ---------------------------------------------------------------------
create or replace function public.decide_approval(
  p_approval_id uuid,
  p_approve     boolean,
  p_comment     text default null
)
returns public.approvals
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row public.approvals;
begin
  select * into v_row from public.approvals where id = p_approval_id for update;
  if not found then
    raise exception 'Solicitud de aprobacion no encontrada o sin acceso' using errcode = 'P0002';
  end if;
  if v_row.status <> 'PENDIENTE' then
    raise exception 'Esta solicitud ya fue resuelta' using errcode = '22023';
  end if;
  if not app.has_permission(v_row.project_id, 'documents.approve') then
    raise exception 'No tienes permiso para aprobar en este proyecto' using errcode = '42501';
  end if;

  update public.approvals
     set status           = case when p_approve then 'APROBADO' else 'RECHAZADO' end::approval_status,
         approver_user_id = auth.uid(),
         decided_at       = now(),
         comment          = coalesce(p_comment, comment)
   where id = p_approval_id
  returning * into v_row;

  -- Un documento aprobado pasa a vigente; uno rechazado, a correccion.
  if v_row.entity_type = 'DOCUMENT' then
    update public.documents
       set status = case when p_approve then 'APROBADO' else 'RECHAZADO' end::document_status
     where id = v_row.entity_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.decide_approval(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8) FASE 14 — Revision humana de las extracciones de IA (§42)
--
-- Ninguna extraccion se aplica al negocio sin que una persona con
-- permiso la apruebe. El constraint `ai_extractions_applied_ck` ya impide
-- marcar como aplicada una extraccion no aprobada; estas funciones
-- impiden ademas que la aprobacion la haga cualquiera, y que la haga la
-- propia integracion de IA.
-- ---------------------------------------------------------------------
create or replace function public.review_ai_extraction(
  p_extraction_id uuid,
  p_approve       boolean,
  p_comment       text default null
)
returns public.ai_document_extractions
-- SECURITY DEFINER porque `authenticated` no tiene UPDATE sobre las
-- columnas de revision: esa es precisamente la garantia. El control de
-- acceso se hace explicito aqui con app.has_permission, que ya implica
-- pertenencia al proyecto.
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_row public.ai_document_extractions;
begin
  select * into v_row from public.ai_document_extractions
   where id = p_extraction_id for update;
  if not found then
    raise exception 'Extraccion no encontrada o sin acceso' using errcode = 'P0002';
  end if;
  if v_row.status in ('APROBADO','RECHAZADO') then
    raise exception 'Esta extraccion ya fue revisada' using errcode = '22023';
  end if;
  if v_row.status not in ('EXTRAIDO','EN_REVISION') then
    raise exception 'Solo puede revisarse una extraccion terminada correctamente'
      using errcode = '22023';
  end if;
  if not app.has_permission(v_row.project_id, 'documents.approve') then
    raise exception 'No tienes permiso para revisar extracciones en este proyecto'
      using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'La revision requiere un usuario identificado' using errcode = '42501';
  end if;

  update public.ai_document_extractions
     set status      = case when p_approve then 'APROBADO' else 'RECHAZADO' end::ai_extraction_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         error_message = coalesce(p_comment, error_message)
   where id = p_extraction_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Marca la extraccion como aplicada a una entidad concreta. Los datos que
-- se escriben en el negocio son los que la persona confirmo en pantalla,
-- no el JSON crudo del modelo: aqui solo se deja la trazabilidad.
create or replace function public.mark_ai_extraction_applied(
  p_extraction_id uuid,
  p_entity_type   entity_type,
  p_entity_id     uuid
)
returns public.ai_document_extractions
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_row public.ai_document_extractions;
begin
  select * into v_row from public.ai_document_extractions
   where id = p_extraction_id for update;
  if not found then
    raise exception 'Extraccion no encontrada o sin acceso' using errcode = 'P0002';
  end if;
  if not app.has_permission(v_row.project_id, 'documents.update') then
    raise exception 'No tienes permiso para aplicar extracciones en este proyecto'
      using errcode = '42501';
  end if;
  if v_row.status <> 'APROBADO' then
    raise exception 'La extraccion debe estar aprobada por una persona antes de aplicarse'
      using errcode = '22023';
  end if;
  if v_row.applied_at is not null then
    raise exception 'Esta extraccion ya se habia aplicado' using errcode = '23505';
  end if;

  update public.ai_document_extractions
     set applied_at = now(),
         applied_entity_type = p_entity_type,
         applied_entity_id   = p_entity_id
   where id = p_extraction_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_ai_extraction(uuid, boolean, text)                    to authenticated;
grant execute on function public.mark_ai_extraction_applied(uuid, entity_type, uuid)          to authenticated;

-- La integracion de IA escribe la extraccion, nunca la revisa: no puede
-- tocar las columnas de revision ni las de aplicacion por UPDATE directo.
revoke update on public.ai_document_extractions from authenticated;
grant update (structured_data, status, error_message, confidence,
              raw_response, tokens_input, tokens_output)
  on public.ai_document_extractions to authenticated;

comment on table public.ai_document_extractions is
  'Extracciones de IA. reviewed_by/reviewed_at/applied_at solo se escriben via review_ai_extraction y mark_ai_extraction_applied: un UPDATE directo no tiene permiso sobre esas columnas.';

-- ---------------------------------------------------------------------
-- 9) FASE 14 — Cola de revision
-- ---------------------------------------------------------------------
create or replace view public.v_ai_extraction_queue as
select
  e.id,
  e.project_id,
  e.document_id,
  d.name              as document_name,
  d.bucket,
  d.storage_path,
  dt.code             as document_type_code,
  dt.name             as document_type_name,
  e.extraction_type,
  e.provider,
  e.model,
  e.status,
  e.confidence,
  e.structured_data,
  e.error_message,
  e.reviewed_by,
  e.reviewed_at,
  e.applied_at,
  e.applied_entity_type,
  e.applied_entity_id,
  e.created_at,
  (e.status in ('EXTRAIDO','EN_REVISION'))                as needs_review,
  (e.status = 'APROBADO' and e.applied_at is null)        as ready_to_apply
from public.ai_document_extractions e
join public.documents d       on d.id = e.document_id
join public.document_types dt on dt.id = d.document_type_id;

alter view public.v_ai_extraction_queue set (security_invoker = on);
grant select on public.v_ai_extraction_queue to authenticated;

-- ---------------------------------------------------------------------
-- 10) Documentos con su contexto (para la pantalla documental)
-- ---------------------------------------------------------------------
create or replace view public.v_documents as
select
  d.id,
  d.project_id,
  d.name,
  d.description,
  d.bucket,
  d.storage_path,
  d.mime_type,
  d.file_size,
  d.current_version,
  d.status,
  d.is_confidential,
  d.valid_from,
  d.valid_until,
  d.uploaded_by,
  d.created_at,
  dt.code            as type_code,
  dt.name            as type_name,
  dt.category        as type_category,
  dt.requires_approval,
  dt.is_versioned,
  dt.ai_extraction_type,
  (select count(*) from public.document_links l where l.document_id = d.id)     as link_count,
  (select count(*) from public.document_versions v where v.document_id = d.id)  as version_count,
  exists (
    select 1 from public.approvals a
     where a.entity_type = 'DOCUMENT' and a.entity_id = d.id and a.status = 'PENDIENTE'
  )                                                                             as approval_pending,
  exists (
    select 1 from public.ai_document_extractions e
     where e.document_id = d.id and e.status in ('EXTRAIDO','EN_REVISION')
  )                                                                             as extraction_pending,
  (d.valid_until is not null and d.valid_until < current_date)                  as is_expired
from public.documents d
join public.document_types dt on dt.id = d.document_type_id
where d.deleted_at is null;

alter view public.v_documents set (security_invoker = on);
grant select on public.v_documents to authenticated;
