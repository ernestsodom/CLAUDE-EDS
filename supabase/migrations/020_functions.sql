-- =====================================================================
-- 020_functions.sql
-- Logica de negocio critica en PostgreSQL (no en el frontend).
--
-- Las funciones expuestas a la aplicacion viven en `public` y validan
-- permisos explicitamente con app.has_permission(); las auxiliares
-- viven en `app`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Registrar evento en el timeline
-- ---------------------------------------------------------------------
create or replace function app.log_event(
  p_project_id  uuid,
  p_entity_type entity_type,
  p_entity_id   uuid,
  p_event_type  text,
  p_title       text,
  p_description text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_id uuid;
begin
  insert into public.project_events (
    project_id, entity_type, entity_id, event_type, title, description, user_id, metadata
  )
  values (p_project_id, p_entity_type, p_entity_id, p_event_type, p_title, p_description, auth.uid(), p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Crear / actualizar una alerta de forma idempotente (dedupe_key)
-- ---------------------------------------------------------------------
create or replace function app.upsert_alert(
  p_project_id  uuid,
  p_type        alert_type,
  p_priority    priority_level,
  p_title       text,
  p_message     text,
  p_entity_type entity_type,
  p_entity_id   uuid,
  p_dedupe_key  text,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_id uuid;
begin
  -- clock_timestamp() (no now()): la deteccion debe quedar marcada con la
  -- hora real de la pasada, no con el inicio de la transaccion. De lo
  -- contrario el paso de auto-resolucion cerraria las alertas que la
  -- misma ejecucion acaba de crear.
  insert into public.alerts (
    project_id, alert_type, priority, title, message,
    entity_type, entity_id, dedupe_key, metadata,
    first_detected_at, last_detected_at
  )
  values (
    p_project_id, p_type, p_priority, p_title, p_message,
    p_entity_type, p_entity_id, p_dedupe_key, p_metadata,
    clock_timestamp(), clock_timestamp()
  )
  on conflict (project_id, dedupe_key) do update
    set last_detected_at = clock_timestamp(),
        priority         = excluded.priority,
        title            = excluded.title,
        message          = excluded.message,
        metadata         = excluded.metadata,
        status           = case when alerts.status = 'RESUELTA'
                                then 'ABIERTA'::alert_status
                                else alerts.status end,
        resolved_at      = case when alerts.status = 'RESUELTA' then null
                                else alerts.resolved_at end,
        updated_at       = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Instanciar un checklist desde plantilla
-- ---------------------------------------------------------------------
create or replace function app.create_checklist_from_template(
  p_project_id  uuid,
  p_template_code text,
  p_entity_type entity_type,
  p_entity_id   uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_template public.checklist_templates%rowtype;
  v_checklist_id uuid;
begin
  select * into v_template
    from public.checklist_templates
   where code = p_template_code
     and (project_id = p_project_id or project_id is null)
     and active
   order by project_id nulls last
   limit 1;

  if v_template.id is null then
    return null;
  end if;

  insert into public.project_checklists (project_id, template_id, entity_type, entity_id, name, created_by)
  values (p_project_id, v_template.id, p_entity_type, p_entity_id, v_template.name, auth.uid())
  on conflict (entity_type, entity_id, name) do nothing
  returning id into v_checklist_id;

  if v_checklist_id is null then
    return null;   -- ya existia
  end if;

  insert into public.checklist_items (project_id, checklist_id, title, description, sort_order, is_required)
  select p_project_id, v_checklist_id, ti.title, ti.description, ti.sort_order, ti.is_required
    from public.checklist_template_items ti
   where ti.template_id = v_template.id;

  return v_checklist_id;
end;
$$;

-- =====================================================================
-- CONFIRMAR VENTA  (§55, §101)
-- Venta comprometida -> confirmada. En UNA transaccion crea:
--   canchas, proyecto de fabricacion, costos estimados, checklists,
--   requerimientos de material y eventos de timeline.
-- =====================================================================
create or replace function public.confirm_sale(
  p_sale_id uuid,
  p_create_manufacturing boolean default true,
  p_delivery_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_sale      public.sales%rowtype;
  v_project   public.projects%rowtype;
  v_mp_id     uuid;
  v_court_qty integer := 0;
  v_created_courts integer := 0;
  v_court_id  uuid;
  v_item      record;
  v_i         integer;
begin
  select * into v_sale from public.sales where id = p_sale_id and deleted_at is null;
  if v_sale.id is null then
    raise exception 'Venta no encontrada' using errcode = 'no_data_found';
  end if;

  if not app.has_permission(v_sale.project_id, 'sales.approve') then
    raise exception 'Permiso denegado: se requiere sales.approve' using errcode = '42501';
  end if;

  if v_sale.status in ('CONFIRMADA','EN_PRODUCCION','PARCIALMENTE_ENTREGADA','ENTREGADA','CERRADA') then
    raise exception 'La venta % ya esta confirmada', v_sale.sale_number using errcode = 'check_violation';
  end if;
  if v_sale.status = 'ANULADA' then
    raise exception 'No se puede confirmar una venta anulada' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.sale_items where sale_id = p_sale_id) then
    raise exception 'La venta no tiene lineas' using errcode = 'check_violation';
  end if;

  select * into v_project from public.projects where id = v_sale.project_id;

  -- 1. Confirmar cabecera
  update public.sales
     set status        = 'CONFIRMADA',
         confirmed_at  = coalesce(confirmed_at, now()),
         delivery_date = coalesce(p_delivery_date, delivery_date),
         updated_at    = now()
   where id = p_sale_id;

  -- 2. Cantidad de canchas vendidas
  select coalesce(sum(si.quantity), 0)::integer into v_court_qty
    from public.sale_items si
   where si.sale_id = p_sale_id
     and si.product_type in ('CANCHA_NUEVA','CANCHA_USADA');

  -- 3. Proyecto de fabricacion (solo canchas nuevas)
  if p_create_manufacturing and v_project.court_kind = 'NUEVA' and v_court_qty > 0 then
    insert into public.manufacturing_projects (
      project_id, sale_id, client_id, name, description, quantity_courts,
      start_date, estimated_completion_date, status, responsible_user_id, priority, created_by
    )
    values (
      v_sale.project_id, v_sale.id, v_sale.client_id,
      'Fabricacion ' || v_sale.sale_number,
      'Generado automaticamente al confirmar la venta ' || v_sale.sale_number,
      v_court_qty,
      -- La fecha de entrega puede ser anterior a hoy (venta cargada de
      -- forma retroactiva); el inicio nunca puede ser posterior al fin.
      least(current_date, coalesce(p_delivery_date, v_sale.delivery_date, current_date + 60)),
      coalesce(p_delivery_date, v_sale.delivery_date, current_date + 60),
      'PLANIFICACION', v_sale.salesperson_id, 'MEDIA', auth.uid()
    )
    returning id into v_mp_id;
  end if;

  -- 4. Crear las canchas que falten para cubrir lo vendido
  select count(*) into v_created_courts
    from public.courts where sale_id = p_sale_id and deleted_at is null;

  for v_item in
    select si.product_type, si.model, si.quantity
      from public.sale_items si
     where si.sale_id = p_sale_id
       and si.product_type in ('CANCHA_NUEVA','CANCHA_USADA')
  loop
    for v_i in 1..v_item.quantity::integer loop
      exit when v_created_courts >= v_court_qty;

      insert into public.courts (
        project_id, sale_id, manufacturing_project_id, client_id,
        court_number, model, court_type, status, currency,
        country, city, current_location, created_by
      )
      values (
        v_sale.project_id, v_sale.id, v_mp_id, v_sale.client_id,
        null,                                   -- lo genera el trigger
        v_item.model,
        case when v_item.product_type = 'CANCHA_NUEVA' then 'NUEVA' else 'USADA' end::court_kind,
        case when v_item.product_type = 'CANCHA_NUEVA' then 'PLANIFICADA' else 'RESERVADA' end::court_status,
        v_sale.currency,
        v_sale.delivery_country, v_sale.delivery_city, 'FABRICA', auth.uid()
      )
      returning id into v_court_id;

      v_created_courts := v_created_courts + 1;
    end loop;
  end loop;

  -- 5. Costos estimados a partir de las lineas (si aun no existen)
  if not exists (select 1 from public.sale_costs where sale_id = p_sale_id and deleted_at is null) then
    insert into public.sale_costs (
      project_id, sale_id, cost_category_id, description,
      estimated_amount, currency, status, cost_date, created_by
    )
    select
      v_sale.project_id, v_sale.id,
      (select id from public.cost_categories
        where code = case si.product_type
                       when 'CANCHA_NUEVA' then 'FABRICACION'
                       when 'CANCHA_USADA' then 'REPARACION'
                       when 'TRANSPORTE'   then 'TRANSPORTE'
                       when 'INSTALACION'  then 'INSTALACION'
                       else 'OTROS' end
          and project_id is null limit 1),
      'Costo estimado - ' || si.description,
      si.estimated_total_cost,
      v_sale.currency, 'ESTIMADO', current_date, auth.uid()
    from public.sale_items si
    where si.sale_id = p_sale_id
      and si.estimated_total_cost > 0;
  end if;

  -- 6. Checklists operacionales
  perform app.create_checklist_from_template(v_sale.project_id, 'VENTA_CONFIRMADA', 'SALE', v_sale.id);
  if v_mp_id is not null then
    perform app.create_checklist_from_template(v_sale.project_id, 'FABRICACION', 'MANUFACTURING_PROJECT', v_mp_id);
  end if;

  -- 7. Cerrar la oportunidad asociada
  if v_sale.opportunity_id is not null then
    update public.opportunities
       set status = 'GANADA', probability = 100, closed_at = coalesce(closed_at, now()), updated_at = now()
     where id = v_sale.opportunity_id and status <> 'GANADA';
  end if;

  -- 8. Timeline
  perform app.log_event(
    v_sale.project_id, 'SALE', v_sale.id, 'SALE_CONFIRMED',
    'Venta ' || v_sale.sale_number || ' confirmada',
    format('%s canchas, %s %s', v_court_qty, v_sale.total, v_sale.currency),
    jsonb_build_object('manufacturing_project_id', v_mp_id, 'courts', v_created_courts)
  );

  -- 9. Resolver la alerta VENTA_SIN_FABRICACION si existia
  update public.alerts
     set status = 'RESUELTA', resolved_at = now(), updated_at = now()
   where project_id = v_sale.project_id
     and dedupe_key = 'VENTA_SIN_FABRICACION:' || v_sale.id::text
     and status <> 'RESUELTA';

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'manufacturing_project_id', v_mp_id,
    'courts_created', v_created_courts,
    'status', 'CONFIRMADA'
  );
end;
$$;

grant execute on function public.confirm_sale(uuid, boolean, date) to authenticated;

comment on function public.confirm_sale is
  'Confirma una venta y genera canchas, fabricacion, costos estimados y checklists en una sola transaccion.';

-- =====================================================================
-- CAMBIO DE ESTADO DE CANCHA
-- =====================================================================
create or replace function public.change_court_status(
  p_court_id uuid,
  p_new_status court_status,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_court public.courts%rowtype;
begin
  select * into v_court from public.courts where id = p_court_id and deleted_at is null;
  if v_court.id is null then
    raise exception 'Cancha no encontrada' using errcode = 'no_data_found';
  end if;

  if not app.has_permission(v_court.project_id, 'courts.update') then
    raise exception 'Permiso denegado: se requiere courts.update' using errcode = '42501';
  end if;

  if v_court.status = p_new_status then
    return jsonb_build_object('court_id', p_court_id, 'status', p_new_status, 'changed', false);
  end if;

  update public.courts
     set status       = p_new_status,
         delivered_at = case when p_new_status = 'ENTREGADA' then coalesce(delivered_at, now()) else delivered_at end,
         updated_at   = now()
   where id = p_court_id;

  -- El historial y el evento de timeline los escribe el trigger
  -- courts_status_history (021_triggers.sql). Aqui solo anotamos el comentario.
  if p_comment is not null then
    update public.court_status_history h
       set comment = p_comment
     where h.id = (
       select h2.id from public.court_status_history h2
        where h2.court_id = p_court_id
        order by h2.changed_at desc
        limit 1
     );
  end if;

  perform app.sync_sale_delivery_status(v_court.sale_id);

  return jsonb_build_object(
    'court_id', p_court_id,
    'previous_status', v_court.status,
    'status', p_new_status,
    'changed', true
  );
end;
$$;

grant execute on function public.change_court_status(uuid, court_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- Sincronizar el estado de entrega de la venta segun sus canchas (§102)
-- ---------------------------------------------------------------------
create or replace function app.sync_sale_delivery_status(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_total integer;
  v_delivered integer;
  v_status sale_status;
begin
  if p_sale_id is null then return; end if;

  select count(*), count(*) filter (where status = 'ENTREGADA')
    into v_total, v_delivered
    from public.courts where sale_id = p_sale_id and deleted_at is null;

  if v_total = 0 then return; end if;

  select status into v_status from public.sales where id = p_sale_id;
  if v_status in ('BORRADOR','COTIZACION','ANULADA','CERRADA') then return; end if;

  update public.sales
     set status = case
           when v_delivered = v_total then 'ENTREGADA'::sale_status
           when v_delivered > 0       then 'PARCIALMENTE_ENTREGADA'::sale_status
           else 'EN_PRODUCCION'::sale_status
         end,
         updated_at = now()
   where id = p_sale_id
     and status is distinct from (case
           when v_delivered = v_total then 'ENTREGADA'::sale_status
           when v_delivered > 0       then 'PARCIALMENTE_ENTREGADA'::sale_status
           else 'EN_PRODUCCION'::sale_status
         end);
end;
$$;

-- =====================================================================
-- SNAPSHOT DE MARGEN (§22)
-- =====================================================================
create or replace function public.snapshot_sale_margin(
  p_sale_id uuid,
  p_reason text default 'MANUAL'
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v record;
  v_id uuid;
begin
  select * into v from public.v_sale_financials where sale_id = p_sale_id;
  if v.sale_id is null then
    raise exception 'Venta no encontrada o sin acceso' using errcode = 'no_data_found';
  end if;

  insert into public.sale_margin_snapshots (
    project_id, sale_id, snapshot_date, reason, currency, total_sale,
    estimated_cost, actual_cost, estimated_margin, actual_margin,
    estimated_margin_percentage, actual_margin_percentage, created_by
  )
  values (
    v.project_id, v.sale_id, current_date, p_reason, v.currency, v.total_sale,
    v.estimated_cost, v.actual_cost, v.estimated_margin, v.actual_margin,
    v.estimated_margin_percentage, v.actual_margin_percentage, auth.uid()
  )
  on conflict (sale_id, snapshot_date, reason) do update
    set total_sale = excluded.total_sale,
        estimated_cost = excluded.estimated_cost,
        actual_cost = excluded.actual_cost,
        estimated_margin = excluded.estimated_margin,
        actual_margin = excluded.actual_margin,
        estimated_margin_percentage = excluded.estimated_margin_percentage,
        actual_margin_percentage = excluded.actual_margin_percentage
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.snapshot_sale_margin(uuid, text) to authenticated;

-- =====================================================================
-- MOTOR DE ALERTAS (§61, §104-§109)
-- Se ejecuta desde pg_cron (o desde un endpoint server-side) con
-- privilegios elevados: recorre TODOS los proyectos.
-- =====================================================================
create or replace function app.refresh_overdue_follow_ups()
returns integer
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_count integer;
begin
  update public.follow_ups
     set status = 'VENCIDO', updated_at = now()
   where status = 'PENDIENTE' and due_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app.generate_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_generated integer := 0;
  v_run_start timestamptz := clock_timestamp();
  r record;
begin
  perform app.refresh_overdue_follow_ups();

  -- 1. FABRICACION_ATRASADA (§105)
  for r in
    select mp.id, mp.project_id, mp.name, mp.estimated_completion_date,
           (current_date - mp.estimated_completion_date) as days_late
      from public.manufacturing_projects mp
     where mp.deleted_at is null
       and mp.status not in ('TERMINADO','CANCELADO')
       and mp.estimated_completion_date < current_date
  loop
    perform app.upsert_alert(
      r.project_id, 'FABRICACION_ATRASADA',
      case when r.days_late > 14 then 'CRITICA' else 'ALTA' end::priority_level,
      'Fabricacion atrasada: ' || r.name,
      format('Fecha estimada %s, %s dias de atraso.', r.estimated_completion_date, r.days_late),
      'MANUFACTURING_PROJECT', r.id,
      'FABRICACION_ATRASADA:' || r.id::text,
      jsonb_build_object('days_late', r.days_late)
    );
    v_generated := v_generated + 1;
  end loop;

  -- 2. MATERIAL_FALTANTE (§109)
  for r in
    select mr.id, mr.project_id, mr.manufacturing_project_id, m.name as material_name,
           mr.quantity_missing, mr.needed_by_date
      from public.material_requirements mr
      join public.materials m on m.id = mr.material_id
     where mr.quantity_missing > 0
       and (mr.needed_by_date is null or mr.needed_by_date <= current_date + 21)
  loop
    perform app.upsert_alert(
      r.project_id, 'MATERIAL_FALTANTE',
      case when r.needed_by_date is not null and r.needed_by_date <= current_date + 7
           then 'CRITICA' else 'ALTA' end::priority_level,
      'Material faltante: ' || r.material_name,
      format('Faltan %s unidades. Necesario para %s.', r.quantity_missing, coalesce(r.needed_by_date::text, 's/f')),
      'MATERIAL_REQUIREMENT', r.id,
      'MATERIAL_FALTANTE:' || r.id::text,
      jsonb_build_object('missing', r.quantity_missing, 'needed_by', r.needed_by_date)
    );
    v_generated := v_generated + 1;
  end loop;

  -- 3. SEGUIMIENTO_VENCIDO (§107)
  for r in
    select fu.id, fu.project_id, fu.title, fu.due_date, (current_date - fu.due_date) as days_late
      from public.follow_ups fu
     where fu.status = 'VENCIDO'
  loop
    perform app.upsert_alert(
      r.project_id, 'SEGUIMIENTO_VENCIDO',
      case when r.days_late > 7 then 'ALTA' else 'MEDIA' end::priority_level,
      'Seguimiento vencido: ' || r.title,
      format('Vencio el %s (%s dias).', r.due_date, r.days_late),
      'FOLLOW_UP', r.id, 'SEGUIMIENTO_VENCIDO:' || r.id::text,
      jsonb_build_object('days_late', r.days_late)
    );
    v_generated := v_generated + 1;
  end loop;

  -- 3b. Oportunidades con next_action vencida
  for r in
    select o.id, o.project_id, o.name, o.next_action, o.next_action_date
      from public.opportunities o
     where o.deleted_at is null
       and o.status not in ('GANADA','PERDIDA','ARCHIVADA')
       and o.next_action_date < current_date
  loop
    perform app.upsert_alert(
      r.project_id, 'SEGUIMIENTO_VENCIDO', 'MEDIA',
      'Accion comercial vencida: ' || r.name,
      coalesce(r.next_action, 'Sin accion definida') || ' (vencia ' || r.next_action_date || ')',
      'OPPORTUNITY', r.id, 'OPORTUNIDAD_ACCION_VENCIDA:' || r.id::text,
      '{}'::jsonb
    );
    v_generated := v_generated + 1;
  end loop;

  -- 4. FACTURA_VENCIDA (§108)
  for r in
    select i.id, i.project_id, i.invoice_number, i.balance, i.currency, i.due_date,
           (current_date - i.due_date) as days_late
      from public.invoices i
     where i.deleted_at is null and i.kind = 'VENTA'
       and i.status not in ('BORRADOR','ANULADA','PAGADA')
       and i.due_date < current_date and i.balance > 0
  loop
    perform app.upsert_alert(
      r.project_id, 'FACTURA_VENCIDA',
      case when r.days_late > 30 then 'CRITICA' else 'ALTA' end::priority_level,
      'Factura vencida ' || r.invoice_number,
      format('Saldo %s %s, %s dias de mora.', r.balance, r.currency, r.days_late),
      'INVOICE', r.id, 'FACTURA_VENCIDA:' || r.id::text,
      jsonb_build_object('balance', r.balance, 'days_late', r.days_late)
    );
    v_generated := v_generated + 1;
  end loop;

  -- 5. CONTRATO_POR_VENCER (30 dias)
  for r in
    select c.id, c.project_id, c.contract_number, c.end_date
      from public.contracts c
     where c.deleted_at is null and c.status in ('FIRMADO','VIGENTE')
       and c.end_date between current_date and current_date + 30
  loop
    perform app.upsert_alert(
      r.project_id, 'CONTRATO_POR_VENCER', 'MEDIA',
      'Contrato por vencer ' || r.contract_number,
      'Vence el ' || r.end_date,
      'CONTRACT', r.id, 'CONTRATO_POR_VENCER:' || r.id::text, '{}'::jsonb
    );
    v_generated := v_generated + 1;
  end loop;

  -- 6. COSTO_EXCEDIDO y MARGEN_BAJO (§53, §104)
  for r in
    select f.sale_id, f.project_id, f.sale_number, f.actual_margin_percentage,
           f.cost_deviation_pct, f.is_low_margin, f.is_cost_overrun, f.currency, f.actual_margin
      from public.v_sale_financials f
     where f.status not in ('BORRADOR','ANULADA')
       and (f.is_low_margin or f.is_cost_overrun)
  loop
    if r.is_cost_overrun then
      perform app.upsert_alert(
        r.project_id, 'COSTO_EXCEDIDO', 'ALTA',
        'Costo sobre presupuesto: ' || r.sale_number,
        format('Desviacion de %s%% sobre el costo estimado.', round(r.cost_deviation_pct, 1)),
        'SALE', r.sale_id, 'COSTO_EXCEDIDO:' || r.sale_id::text,
        jsonb_build_object('deviation_pct', r.cost_deviation_pct)
      );
      v_generated := v_generated + 1;
    end if;
    if r.is_low_margin then
      perform app.upsert_alert(
        r.project_id, 'MARGEN_BAJO', 'CRITICA',
        'Margen bajo: ' || r.sale_number,
        format('Margen actual %s%% (%s %s).', round(r.actual_margin_percentage, 1), r.actual_margin, r.currency),
        'SALE', r.sale_id, 'MARGEN_BAJO:' || r.sale_id::text,
        jsonb_build_object('margin_pct', r.actual_margin_percentage)
      );
      v_generated := v_generated + 1;
    end if;
  end loop;

  -- 7. VENTA_SIN_FABRICACION
  for r in
    select s.id, s.project_id, s.sale_number
      from public.sales s
      join public.projects p on p.id = s.project_id
     where s.deleted_at is null
       and s.status in ('CONFIRMADA','EN_PRODUCCION')
       and p.court_kind = 'NUEVA'
       and not exists (select 1 from public.manufacturing_projects mp
                        where mp.sale_id = s.id and mp.deleted_at is null)
  loop
    perform app.upsert_alert(
      r.project_id, 'VENTA_SIN_FABRICACION', 'ALTA',
      'Venta confirmada sin fabricacion: ' || r.sale_number,
      'La venta esta confirmada pero no tiene proyecto de fabricacion asociado.',
      'SALE', r.id, 'VENTA_SIN_FABRICACION:' || r.id::text, '{}'::jsonb
    );
    v_generated := v_generated + 1;
  end loop;

  -- 8. ENTREGA_ATRASADA (§106)
  for r in
    select s.id, s.project_id, s.sale_number, s.delivery_date,
           (current_date - s.delivery_date) as days_late
      from public.sales s
     where s.deleted_at is null
       and s.delivery_date < current_date
       and s.status not in ('ENTREGADA','CERRADA','ANULADA')
  loop
    perform app.upsert_alert(
      r.project_id, 'ENTREGA_ATRASADA',
      case when r.days_late > 15 then 'CRITICA' else 'ALTA' end::priority_level,
      'Entrega atrasada: ' || r.sale_number,
      format('Fecha comprometida %s (%s dias de atraso).', r.delivery_date, r.days_late),
      'SALE', r.id, 'ENTREGA_ATRASADA:' || r.id::text,
      jsonb_build_object('days_late', r.days_late)
    );
    v_generated := v_generated + 1;
  end loop;

  -- 9. INSTALACION_PROXIMA / DESPACHO_PROXIMO (7 dias)
  for r in
    select i.id, i.project_id, i.installation_number, i.planned_start_date
      from public.installations i
     where i.deleted_at is null and i.status in ('PLANIFICADA','CONFIRMADA')
       and i.planned_start_date between current_date and current_date + 7
  loop
    perform app.upsert_alert(
      r.project_id, 'INSTALACION_PROXIMA', 'MEDIA',
      'Instalacion proxima ' || r.installation_number,
      'Inicio planificado: ' || r.planned_start_date,
      'INSTALLATION', r.id, 'INSTALACION_PROXIMA:' || r.id::text, '{}'::jsonb
    );
    v_generated := v_generated + 1;
  end loop;

  for r in
    select sh.id, sh.project_id, sh.shipment_number, sh.departure_date
      from public.shipments sh
     where sh.deleted_at is null and sh.status in ('PLANIFICADO','RESERVADO','CARGADO')
       and sh.departure_date between current_date and current_date + 7
  loop
    perform app.upsert_alert(
      r.project_id, 'DESPACHO_PROXIMO', 'MEDIA',
      'Despacho proximo ' || r.shipment_number,
      'Salida programada: ' || r.departure_date,
      'SHIPMENT', r.id, 'DESPACHO_PROXIMO:' || r.id::text, '{}'::jsonb
    );
    v_generated := v_generated + 1;
  end loop;

  -- 10. Auto-resolucion: toda alerta gestionada por el motor que NO fue
  -- vuelta a detectar en esta ejecucion significa que el problema se
  -- corrigio. Se acota a los tipos automaticos para no cerrar alertas
  -- creadas manualmente.
  update public.alerts a
     set status = 'RESUELTA', resolved_at = now(), updated_at = now()
   where a.status in ('ABIERTA','RECONOCIDA','EN_GESTION')
     and a.last_detected_at < v_run_start
     and a.alert_type in (
       'FABRICACION_ATRASADA','MATERIAL_FALTANTE','SEGUIMIENTO_VENCIDO',
       'FACTURA_VENCIDA','CONTRATO_POR_VENCER','COSTO_EXCEDIDO',
       'VENTA_SIN_FABRICACION','MARGEN_BAJO','ENTREGA_ATRASADA',
       'INSTALACION_PROXIMA','DESPACHO_PROXIMO'
     );

  return jsonb_build_object('generated', v_generated, 'run_at', now());
end;
$$;

comment on function app.generate_alerts is
  'Motor de alertas. Idempotente por dedupe_key. Ejecutar cada hora via pg_cron o endpoint server-side.';

-- ---------------------------------------------------------------------
-- Convertir alerta en tarea (§116)
-- ---------------------------------------------------------------------
create or replace function public.create_task_from_alert(
  p_alert_id uuid,
  p_assigned_to uuid default null,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_alert public.alerts%rowtype;
  v_task_id uuid;
begin
  select * into v_alert from public.alerts where id = p_alert_id;
  if v_alert.id is null then
    raise exception 'Alerta no encontrada' using errcode = 'no_data_found';
  end if;
  if not app.has_permission(v_alert.project_id, 'tasks.create') then
    raise exception 'Permiso denegado: se requiere tasks.create' using errcode = '42501';
  end if;

  insert into public.tasks (
    project_id, title, description, assigned_to,
    related_entity_type, related_entity_id, alert_id,
    due_date, priority, created_by
  )
  values (
    v_alert.project_id, v_alert.title, v_alert.message,
    coalesce(p_assigned_to, auth.uid()),
    v_alert.entity_type, v_alert.entity_id, v_alert.id,
    coalesce(p_due_date, current_date + 3), v_alert.priority, auth.uid()
  )
  returning id into v_task_id;

  update public.alerts
     set status = 'EN_GESTION', acknowledged_by = auth.uid(),
         acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now()
   where id = p_alert_id;

  return v_task_id;
end;
$$;

grant execute on function public.create_task_from_alert(uuid, uuid, date) to authenticated;
