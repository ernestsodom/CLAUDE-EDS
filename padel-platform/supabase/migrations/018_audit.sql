-- =====================================================================
-- 018_audit.sql
-- Auditoria de negocio: quien cambio que, cuando y desde que valor.
-- =====================================================================

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  entity_type   entity_type not null,
  entity_id     uuid,
  table_name    text not null,
  action        audit_action not null,
  old_data      jsonb,
  new_data      jsonb,
  changed_fields text[],
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_project_idx on public.audit_logs (project_id, created_at desc);
create index audit_logs_user_idx    on public.audit_logs (user_id, created_at desc);
create index audit_logs_action_idx  on public.audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------
-- Trigger de auditoria generico.
-- Uso:
--   create trigger audit_sales after insert or update or delete on public.sales
--     for each row execute function app.tg_audit('SALE');
-- ---------------------------------------------------------------------
create or replace function app.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_entity_type entity_type := tg_argv[0]::entity_type;
  v_action      audit_action;
  v_old         jsonb;
  v_new         jsonb;
  v_project     uuid;
  v_entity_id   uuid;
  v_changed     text[];
begin
  if tg_op = 'INSERT' then
    v_action := 'CREATE';
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(key) into v_changed
      from jsonb_each(v_new) n
     where n.key not in ('updated_at')
       and n.value is distinct from (v_old -> n.key);

    if v_changed is null then
      return new;                                   -- nada relevante cambio
    end if;
    v_action := case when 'status' = any(v_changed) then 'STATUS_CHANGE' else 'UPDATE' end;
  else
    v_action := 'DELETE';
    v_old := to_jsonb(old);
  end if;

  v_project   := coalesce((v_new ->> 'project_id')::uuid, (v_old ->> 'project_id')::uuid);
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);

  insert into public.audit_logs (
    user_id, project_id, entity_type, entity_id, table_name,
    action, old_data, new_data, changed_fields
  )
  values (
    auth.uid(), v_project, v_entity_type, v_entity_id, tg_table_name,
    v_action, v_old, v_new, v_changed
  );

  return coalesce(new, old);
end;
$$;

comment on function app.tg_audit() is
  'Trigger generico de auditoria. Primer argumento = entity_type. Registra solo campos realmente modificados.';
