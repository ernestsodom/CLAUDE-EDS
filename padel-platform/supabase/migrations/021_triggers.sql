-- =====================================================================
-- 021_triggers.sql
-- Historial de estados, timeline automatico y auditoria.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Historial de estados de cancha + evento de timeline (§27)
-- ---------------------------------------------------------------------
create or replace function app.tg_court_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.court_status_history (project_id, court_id, previous_status, new_status, changed_by)
    values (new.project_id, new.id, null, new.status, auth.uid());

    perform app.log_event(
      new.project_id, 'COURT', new.id, 'COURT_CREATED',
      'Cancha ' || new.court_number || ' creada',
      'Estado inicial: ' || new.status,
      jsonb_build_object('status', new.status, 'sale_id', new.sale_id)
    );

  elsif new.status is distinct from old.status then
    insert into public.court_status_history (project_id, court_id, previous_status, new_status, changed_by)
    values (new.project_id, new.id, old.status, new.status, auth.uid());

    perform app.log_event(
      new.project_id, 'COURT', new.id, 'COURT_STATUS_CHANGED',
      'Cancha ' || new.court_number || ': ' || old.status || ' -> ' || new.status,
      null,
      jsonb_build_object('from', old.status, 'to', new.status, 'sale_id', new.sale_id)
    );

    -- Propagar a la venta el estado de entrega agregado
    if new.sale_id is not null then
      perform app.sync_sale_delivery_status(new.sale_id);
    end if;
  end if;

  return new;
end;
$$;

create trigger courts_status_history
  after insert or update of status on public.courts
  for each row execute function app.tg_court_status_history();

-- ---------------------------------------------------------------------
-- Eventos de timeline para las demas entidades clave
-- ---------------------------------------------------------------------
create or replace function app.tg_sale_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_event(new.project_id, 'SALE', new.id, 'SALE_CREATED',
      'Venta ' || new.sale_number || ' creada', null,
      jsonb_build_object('status', new.status, 'total', new.total, 'currency', new.currency));
  else
    if new.status is distinct from old.status then
      perform app.log_event(new.project_id, 'SALE', new.id, 'SALE_STATUS_CHANGED',
        'Venta ' || new.sale_number || ': ' || old.status || ' -> ' || new.status, null,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.total is distinct from old.total then
      perform app.log_event(new.project_id, 'SALE', new.id, 'SALE_AMOUNT_CHANGED',
        'Venta ' || new.sale_number || ': importe modificado',
        format('%s %s -> %s %s', old.total, old.currency, new.total, new.currency),
        jsonb_build_object('from', old.total, 'to', new.total));
    end if;
  end if;
  return new;
end;
$$;

create trigger sales_timeline
  after insert or update on public.sales
  for each row execute function app.tg_sale_timeline();

create or replace function app.tg_payment_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  perform app.log_event(
    new.project_id, 'PAYMENT', new.id,
    case when new.direction = 'ENTRADA' then 'PAYMENT_RECEIVED' else 'PAYMENT_SENT' end,
    case when new.direction = 'ENTRADA' then 'Cobro registrado' else 'Pago registrado' end,
    format('%s %s (%s)', new.amount, new.currency, new.method),
    jsonb_build_object('invoice_id', new.invoice_id, 'sale_id', new.sale_id, 'amount', new.amount)
  );
  return new;
end;
$$;

create trigger payments_timeline
  after insert on public.payments
  for each row execute function app.tg_payment_timeline();

create or replace function app.tg_installation_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform app.log_event(new.project_id, 'INSTALLATION', new.id, 'INSTALLATION_STATUS_CHANGED',
      'Instalacion ' || new.installation_number || ': ' || old.status || ' -> ' || new.status,
      null, jsonb_build_object('from', old.status, 'to', new.status, 'sale_id', new.sale_id));

    -- Instalacion recepcionada -> marcar canchas como ENTREGADA
    if new.status = 'RECEPCIONADA' then
      update public.courts c
         set status = 'ENTREGADA', delivered_at = coalesce(c.delivered_at, now()), updated_at = now()
       where c.id in (select ic.court_id from public.installation_courts ic
                       where ic.installation_id = new.id)
         and c.status <> 'ENTREGADA';
    end if;
  end if;
  return new;
end;
$$;

create trigger installations_timeline
  after insert or update on public.installations
  for each row execute function app.tg_installation_timeline();

create or replace function app.tg_shipment_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform app.log_event(new.project_id, 'SHIPMENT', new.id, 'SHIPMENT_STATUS_CHANGED',
      'Embarque ' || new.shipment_number || ': ' || old.status || ' -> ' || new.status,
      null, jsonb_build_object('from', old.status, 'to', new.status));

    -- Embarque en transito -> canchas EN_TRANSITO
    if new.status = 'EN_TRANSITO' then
      update public.courts c
         set status = 'EN_TRANSITO', updated_at = now()
       where c.id in (select si.court_id from public.shipment_items si
                       where si.shipment_id = new.id and si.court_id is not null)
         and c.status not in ('ENTREGADA','EN_INSTALACION','INSTALACION_TERMINADA');
    end if;
  end if;
  return new;
end;
$$;

create trigger shipments_timeline
  after insert or update on public.shipments
  for each row execute function app.tg_shipment_timeline();

create or replace function app.tg_document_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  perform app.log_event(new.project_id, 'DOCUMENT', new.document_id, 'DOCUMENT_LINKED',
    'Documento asociado', null,
    jsonb_build_object('entity_type', new.entity_type, 'entity_id', new.entity_id));
  return new;
end;
$$;

create trigger document_links_timeline
  after insert on public.document_links
  for each row execute function app.tg_document_timeline();

-- ---------------------------------------------------------------------
-- AUDITORIA: se aplica a las entidades de negocio criticas
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('clients',                'CLIENT'),
      ('contacts',               'CONTACT'),
      ('opportunities',          'OPPORTUNITY'),
      ('meetings',               'MEETING'),
      ('follow_ups',             'FOLLOW_UP'),
      ('sales',                  'SALE'),
      ('sale_items',             'SALE_ITEM'),
      ('sale_costs',             'SALE_COST'),
      ('manufacturing_projects', 'MANUFACTURING_PROJECT'),
      ('courts',                 'COURT'),
      ('suppliers',              'SUPPLIER'),
      ('purchase_orders',        'PURCHASE_ORDER'),
      ('invoices',               'INVOICE'),
      ('payments',               'PAYMENT'),
      ('expenses',               'EXPENSE'),
      ('contracts',              'CONTRACT'),
      ('shipments',              'SHIPMENT'),
      ('installations',          'INSTALLATION'),
      ('documents',              'DOCUMENT'),
      ('quality_checks',         'QUALITY_CHECK'),
      ('user_project_access',    'USER')
    ) as t(table_name, entity)
  loop
    execute format(
      'drop trigger if exists audit_%1$s on public.%1$I', r.table_name
    );
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function app.tg_audit(%2$L)',
      r.table_name, r.entity
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Coherencia multi-tenant en tablas hijas: el project_id debe coincidir
-- con el del padre. Evita cruzar datos entre unidades de negocio.
-- ---------------------------------------------------------------------
create or replace function app.tg_enforce_parent_project()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_parent_table text := tg_argv[0];
  v_fk_column    text := tg_argv[1];
  v_fk_value     uuid;
  v_parent_proj  uuid;
begin
  v_fk_value := (to_jsonb(new) ->> v_fk_column)::uuid;
  if v_fk_value is null then
    return new;
  end if;

  execute format('select project_id from public.%I where id = $1', v_parent_table)
    into v_parent_proj using v_fk_value;

  if v_parent_proj is not null and v_parent_proj is distinct from new.project_id then
    raise exception
      'Violacion de aislamiento: %.% apunta a un registro de otro proyecto',
      tg_table_name, v_fk_column
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select * from (values
      ('opportunities',          'clients',                'client_id'),
      ('sales',                  'clients',                'client_id'),
      ('sales',                  'opportunities',          'opportunity_id'),
      ('sale_items',             'sales',                  'sale_id'),
      ('sale_costs',             'sales',                  'sale_id'),
      ('manufacturing_projects', 'sales',                  'sale_id'),
      ('courts',                 'sales',                  'sale_id'),
      ('courts',                 'manufacturing_projects', 'manufacturing_project_id'),
      ('material_requirements',  'manufacturing_projects', 'manufacturing_project_id'),
      ('purchase_orders',        'suppliers',              'supplier_id'),
      ('purchase_order_items',   'purchase_orders',        'purchase_order_id'),
      ('invoices',               'clients',                'client_id'),
      ('invoices',               'suppliers',              'supplier_id'),
      ('invoices',               'sales',                  'sale_id'),
      ('invoice_items',          'invoices',               'invoice_id'),
      ('payments',               'invoices',               'invoice_id'),
      ('contracts',              'sales',                  'sale_id'),
      ('shipments',              'sales',                  'sale_id'),
      ('shipment_items',         'shipments',              'shipment_id'),
      ('installations',          'sales',                  'sale_id'),
      ('installation_courts',    'installations',          'installation_id'),
      ('installation_courts',    'courts',                 'court_id'),
      ('document_links',         'documents',              'document_id')
    ) as t(child, parent, fk)
  loop
    execute format(
      'drop trigger if exists tenant_%1$s_%3$s on public.%1$I', r.child, r.parent, r.fk
    );
    execute format(
      'create trigger tenant_%1$s_%3$s before insert or update of %3$I, project_id on public.%1$I
         for each row execute function app.tg_enforce_parent_project(%2$L, %3$L)',
      r.child, r.parent, r.fk
    );
  end loop;
end;
$$;
