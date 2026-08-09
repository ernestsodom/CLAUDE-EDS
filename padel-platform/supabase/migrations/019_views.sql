-- =====================================================================
-- 019_views.sql
-- Capa analitica. Todos los KPI del frontend salen de aqui, NUNCA de
-- N consultas sueltas desde React.
--
-- Todas las vistas usan `security_invoker = on`: se ejecutan con los
-- permisos del usuario, por lo que RLS de las tablas base sigue
-- aplicando y no hay fuga entre proyectos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_sale_financials  --  LA vista central del negocio
-- Venta -> costos -> facturado -> cobrado -> margen estimado y real
-- ---------------------------------------------------------------------
create or replace view public.v_sale_financials
with (security_invoker = on) as
with cost_agg as (
  select sc.sale_id,
         sum(sc.estimated_amount) as estimated_cost,
         sum(sc.actual_amount)    as actual_cost
    from public.sale_costs sc
   where sc.deleted_at is null and sc.status <> 'ANULADO'
   group by sc.sale_id
),
item_cost_agg as (
  -- Presupuesto inicial que viene de las lineas de venta. Se usa como
  -- costo estimado mientras la venta no tenga lineas en sale_costs
  -- (cotizaciones y ventas comprometidas aun sin costear en detalle).
  select si.sale_id, sum(si.estimated_total_cost) as item_estimated_cost
    from public.sale_items si
   group by si.sale_id
),
invoice_agg as (
  select i.sale_id,
         sum(i.total)       filter (where i.status <> 'ANULADA') as invoiced_amount,
         sum(i.paid_amount) filter (where i.status <> 'ANULADA') as collected_amount
    from public.invoices i
   where i.deleted_at is null and i.kind = 'VENTA' and i.sale_id is not null
   group by i.sale_id
),
court_agg as (
  select c.sale_id,
         count(*)                                                          as courts_total,
         count(*) filter (where c.status = 'ENTREGADA')                    as courts_delivered,
         count(*) filter (where c.status in ('EN_TRANSITO','EN_TRANSPORTE')) as courts_in_transit,
         count(*) filter (where c.status in ('EN_CONSTRUCCION','MATERIALES_PENDIENTES',
                                             'GALVANIZADO','EMBALAJE','PLANIFICADA'))  as courts_in_production,
         count(*) filter (where c.status in ('EN_INSTALACION','INSTALACION_TERMINADA')) as courts_installing
    from public.courts c
   where c.deleted_at is null and c.sale_id is not null
   group by c.sale_id
)
select
  s.id                            as sale_id,
  s.project_id,
  p.code                          as project_code,
  s.sale_number,
  s.sale_date,
  s.status,
  s.currency,
  s.client_id,
  cl.company_name                 as client_name,
  cl.country                      as client_country,
  s.salesperson_id,
  s.delivery_date,

  s.total                         as total_sale,
  -- Costo estimado: detalle de sale_costs si existe; si no, el
  -- presupuesto que traen las lineas de venta.
  coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0) as estimated_cost,
  coalesce(ca.actual_cost, 0)     as actual_cost,

  public.money_round(s.total - coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0)) as estimated_margin,
  public.money_round(s.total - coalesce(ca.actual_cost, 0))    as actual_margin,
  public.pct(s.total - coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0), s.total) as estimated_margin_percentage,
  public.pct(s.total - coalesce(ca.actual_cost, 0),    s.total) as actual_margin_percentage,
  public.money_round(coalesce(ca.actual_cost, 0) - coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0)) as cost_deviation,
  public.pct(coalesce(ca.actual_cost,0) - coalesce(nullif(ca.estimated_cost,0), ic.item_estimated_cost, 0),
               nullif(coalesce(nullif(ca.estimated_cost,0), ic.item_estimated_cost, 0), 0))                              as cost_deviation_pct,

  -- Margen PROYECTADO: usa el costo real donde ya existe y el estimado
  -- donde todavia no se ha imputado nada. Es el numero que debe mirar
  -- gerencia; `actual_margin` a secas daria 100% en una venta recien
  -- confirmada, que es matematicamente cierto pero enganoso.
  (coalesce(ca.actual_cost, 0) > 0)                   as has_actual_cost,
  case when coalesce(ca.actual_cost, 0) > 0
       then coalesce(ca.actual_cost, 0)
       else coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0) end        as projected_cost,
  public.money_round(s.total - case when coalesce(ca.actual_cost, 0) > 0
                                    then coalesce(ca.actual_cost, 0)
                                    else coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0) end) as projected_margin,
  public.pct(s.total - case when coalesce(ca.actual_cost, 0) > 0
                            then coalesce(ca.actual_cost, 0)
                            else coalesce(nullif(ca.estimated_cost, 0), ic.item_estimated_cost, 0) end, s.total) as projected_margin_percentage,
  -- Grado de avance del costeo: cuanto del presupuesto ya tiene costo real
  public.pct(coalesce(ca.actual_cost, 0), nullif(coalesce(nullif(ca.estimated_cost,0), ic.item_estimated_cost, 0), 0)) as cost_recognition_pct,

  coalesce(ia.invoiced_amount, 0)                     as invoiced_amount,
  coalesce(ia.collected_amount, 0)                    as collected_amount,
  public.money_round(s.total - coalesce(ia.invoiced_amount, 0)) as pending_to_invoice,
  public.money_round(coalesce(ia.invoiced_amount, 0) - coalesce(ia.collected_amount, 0)) as receivable_amount,
  public.pct(coalesce(ia.collected_amount, 0), s.total) as collection_percentage,

  coalesce(co.courts_total, 0)         as courts_total,
  coalesce(co.courts_delivered, 0)     as courts_delivered,
  coalesce(co.courts_in_transit, 0)    as courts_in_transit,
  coalesce(co.courts_in_production, 0) as courts_in_production,
  coalesce(co.courts_installing, 0)    as courts_installing,
  greatest(coalesce(co.courts_total, 0) - coalesce(co.courts_delivered, 0), 0) as courts_pending_delivery,

  -- Estado de entrega derivado (caso de negocio 102)
  case
    when coalesce(co.courts_total, 0) = 0 then 'SIN_CANCHAS'
    when co.courts_delivered = co.courts_total then 'ENTREGADA'
    when co.courts_delivered > 0 then 'PARCIALMENTE_ENTREGADA'
    else 'PENDIENTE'
  end as delivery_state,

  -- Alerta de margen bajo segun umbral configurable del proyecto
  (public.pct(s.total - coalesce(ca.actual_cost, 0), s.total) < p.min_margin_threshold_pct
    and coalesce(ca.actual_cost, 0) > 0) as is_low_margin,
  -- Desviacion de costo sobre umbral
  (public.pct(coalesce(ca.actual_cost,0) - coalesce(nullif(ca.estimated_cost,0), ic.item_estimated_cost, 0),
              nullif(coalesce(nullif(ca.estimated_cost,0), ic.item_estimated_cost, 0), 0))
    > p.cost_deviation_threshold_pct) as is_cost_overrun
from public.sales s
join public.projects p on p.id = s.project_id
join public.clients  cl on cl.id = s.client_id
left join cost_agg     ca on ca.sale_id = s.id
left join item_cost_agg ic on ic.sale_id = s.id
left join invoice_agg ia on ia.sale_id = s.id
left join court_agg   co on co.sale_id = s.id
where s.deleted_at is null;

comment on view public.v_sale_financials is
  'Ficha economica completa por venta: costos, facturacion, cobro, margen estimado vs real y estado de entrega.';

-- ---------------------------------------------------------------------
-- v_sale_cost_variance : estimado vs real por categoria (grafico §52)
-- ---------------------------------------------------------------------
create or replace view public.v_sale_cost_variance
with (security_invoker = on) as
select
  sc.project_id,
  sc.sale_id,
  cc.cost_group,
  cc.code                       as category_code,
  cc.name                       as category_name,
  sc.currency,
  sum(sc.estimated_amount)      as estimated_amount,
  sum(sc.actual_amount)         as actual_amount,
  public.money_round(sum(sc.actual_amount) - sum(sc.estimated_amount)) as deviation_amount,
  public.pct(sum(sc.actual_amount) - sum(sc.estimated_amount),
               nullif(sum(sc.estimated_amount), 0))           as deviation_pct
from public.sale_costs sc
join public.cost_categories cc on cc.id = sc.cost_category_id
where sc.deleted_at is null and sc.status <> 'ANULADO'
group by sc.project_id, sc.sale_id, cc.cost_group, cc.code, cc.name, sc.currency;

-- ---------------------------------------------------------------------
-- v_sales_summary : agregados comerciales por proyecto y moneda
-- ---------------------------------------------------------------------
create or replace view public.v_sales_summary
with (security_invoker = on) as
select
  f.project_id,
  f.project_code,
  f.currency,
  count(*)                                                              as sales_count,
  count(*) filter (where f.status = 'COMPROMETIDA')                     as sales_committed_count,
  count(*) filter (where f.status in ('CONFIRMADA','EN_PRODUCCION',
                                      'PARCIALMENTE_ENTREGADA','ENTREGADA','CERRADA')) as sales_closed_count,
  sum(f.total_sale)                                                     as total_sales,
  sum(f.total_sale) filter (where f.status = 'COMPROMETIDA')            as committed_sales,
  sum(f.total_sale) filter (where f.status in ('CONFIRMADA','EN_PRODUCCION',
                                      'PARCIALMENTE_ENTREGADA','ENTREGADA','CERRADA')) as closed_sales,
  sum(f.estimated_cost)                                                 as total_estimated_cost,
  sum(f.actual_cost)                                                    as total_actual_cost,
  sum(f.estimated_margin)                                               as total_estimated_margin,
  sum(f.actual_margin)                                                  as total_actual_margin,
  public.pct(sum(f.actual_margin), nullif(sum(f.total_sale), 0))      as actual_margin_pct,
  sum(f.invoiced_amount)                                                as total_invoiced,
  sum(f.collected_amount)                                               as total_collected,
  sum(f.receivable_amount)                                              as total_receivable,
  sum(f.courts_total)                                                   as courts_sold,
  sum(f.courts_delivered)                                               as courts_delivered,
  sum(f.courts_pending_delivery)                                        as courts_pending_delivery
from public.v_sale_financials f
where f.status <> 'ANULADA'
group by f.project_id, f.project_code, f.currency;

-- ---------------------------------------------------------------------
-- v_court_status_summary : conteo de canchas por estado
-- ---------------------------------------------------------------------
create or replace view public.v_court_status_summary
with (security_invoker = on) as
select
  c.project_id,
  p.code as project_code,
  c.court_type,
  c.status,
  count(*)                                as courts_count,
  sum(coalesce(c.sale_price, 0))          as total_sale_value,
  sum(coalesce(c.purchase_cost, 0) + coalesce(c.refurbishment_cost, 0)) as total_cost_value
from public.courts c
join public.projects p on p.id = c.project_id
where c.deleted_at is null
group by c.project_id, p.code, c.court_type, c.status;

-- ---------------------------------------------------------------------
-- v_manufacturing_summary : avance y atrasos de fabricacion
-- ---------------------------------------------------------------------
create or replace view public.v_manufacturing_summary
with (security_invoker = on) as
select
  mp.id                       as manufacturing_project_id,
  mp.project_id,
  mp.sale_id,
  mp.name,
  mp.status,
  mp.priority,
  mp.start_date,
  mp.estimated_completion_date,
  mp.actual_completion_date,
  mp.responsible_user_id,
  count(c.id)                                                as courts_count,
  count(c.id) filter (where c.status in ('CONSTRUCCION_TERMINADA','GALVANIZADO',
        'GALVANIZADO_TERMINADO','EMBALAJE','EMBALADA','EN_TRANSITO','EN_INSTALACION',
        'INSTALACION_TERMINADA','ENTREGADA'))                as courts_built,
  public.pct(
    count(c.id) filter (where c.status in ('CONSTRUCCION_TERMINADA','GALVANIZADO',
      'GALVANIZADO_TERMINADO','EMBALAJE','EMBALADA','EN_TRANSITO','EN_INSTALACION',
      'INSTALACION_TERMINADA','ENTREGADA')),
    nullif(count(c.id), 0))                                  as progress_pct,
  coalesce((select sum(mr.quantity_missing) from public.material_requirements mr
             where mr.manufacturing_project_id = mp.id), 0)  as materials_missing,
  (mp.estimated_completion_date is not null
    and mp.estimated_completion_date < current_date
    and mp.status not in ('TERMINADO','CANCELADO'))          as is_delayed,
  case when mp.estimated_completion_date is not null and mp.status not in ('TERMINADO','CANCELADO')
       then (mp.estimated_completion_date - current_date) end as days_to_deadline
from public.manufacturing_projects mp
left join public.courts c on c.manufacturing_project_id = mp.id and c.deleted_at is null
where mp.deleted_at is null
group by mp.id;

-- ---------------------------------------------------------------------
-- v_pipeline_summary : embudo comercial
-- ---------------------------------------------------------------------
create or replace view public.v_pipeline_summary
with (security_invoker = on) as
select
  o.project_id,
  o.currency,
  o.status,
  count(*)                                                        as opportunities_count,
  sum(o.estimated_amount)                                         as pipeline_amount,
  sum(public.money_round(o.estimated_amount * o.probability / 100.0))      as weighted_pipeline_amount,
  sum(o.estimated_courts)                                         as estimated_courts,
  count(*) filter (where o.next_action_date < current_date)       as overdue_actions
from public.opportunities o
where o.deleted_at is null
group by o.project_id, o.currency, o.status;

-- ---------------------------------------------------------------------
-- v_accounts_receivable / v_accounts_payable
-- ---------------------------------------------------------------------
create or replace view public.v_accounts_receivable
with (security_invoker = on) as
select
  i.id            as invoice_id,
  i.project_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.currency,
  i.total,
  i.paid_amount,
  i.balance,
  i.status,
  i.client_id,
  cl.company_name as client_name,
  i.sale_id,
  s.sale_number,
  (current_date - i.due_date)                              as days_overdue,
  case
    when i.due_date is null                        then 'SIN_VENCIMIENTO'
    when i.due_date >= current_date                then 'CORRIENTE'
    when current_date - i.due_date <= 30           then '1_30'
    when current_date - i.due_date <= 60           then '31_60'
    when current_date - i.due_date <= 90           then '61_90'
    else '90_MAS'
  end as aging_bucket
from public.invoices i
join public.clients cl on cl.id = i.client_id
left join public.sales s on s.id = i.sale_id
where i.deleted_at is null
  and i.kind = 'VENTA'
  and i.status not in ('BORRADOR','ANULADA')
  and i.balance > 0;

create or replace view public.v_accounts_payable
with (security_invoker = on) as
select
  i.id            as invoice_id,
  i.project_id,
  i.invoice_number,
  i.external_number,
  i.invoice_date,
  i.due_date,
  i.currency,
  i.total,
  i.paid_amount,
  i.balance,
  i.status,
  i.supplier_id,
  sp.company_name as supplier_name,
  i.purchase_order_id,
  (current_date - i.due_date) as days_overdue,
  case
    when i.due_date is null              then 'SIN_VENCIMIENTO'
    when i.due_date >= current_date      then 'CORRIENTE'
    when current_date - i.due_date <= 30 then '1_30'
    when current_date - i.due_date <= 60 then '31_60'
    when current_date - i.due_date <= 90 then '61_90'
    else '90_MAS'
  end as aging_bucket
from public.invoices i
join public.suppliers sp on sp.id = i.supplier_id
where i.deleted_at is null
  and i.kind = 'COMPRA'
  and i.status not in ('BORRADOR','ANULADA')
  and i.balance > 0;

-- ---------------------------------------------------------------------
-- v_financial_summary : caja y deuda por proyecto/moneda
-- ---------------------------------------------------------------------
create or replace view public.v_financial_summary
with (security_invoker = on) as
select
  p.id   as project_id,
  p.code as project_code,
  p.default_currency as currency,
  coalesce((select sum(i.total) from public.invoices i
             where i.project_id = p.id and i.kind = 'VENTA'
               and i.deleted_at is null and i.status not in ('BORRADOR','ANULADA')), 0) as total_invoiced_sales,
  coalesce((select sum(i.paid_amount) from public.invoices i
             where i.project_id = p.id and i.kind = 'VENTA'
               and i.deleted_at is null and i.status not in ('BORRADOR','ANULADA')), 0) as total_collected,
  coalesce((select sum(i.balance) from public.invoices i
             where i.project_id = p.id and i.kind = 'VENTA'
               and i.deleted_at is null and i.status not in ('BORRADOR','ANULADA')), 0) as accounts_receivable,
  coalesce((select sum(i.balance) from public.invoices i
             where i.project_id = p.id and i.kind = 'COMPRA'
               and i.deleted_at is null and i.status not in ('BORRADOR','ANULADA')), 0) as accounts_payable,
  coalesce((select sum(e.amount) from public.expenses e
             where e.project_id = p.id and e.deleted_at is null
               and e.status in ('APROBADO','PAGADO')), 0)                                as total_expenses,
  coalesce((select sum(i.balance) from public.invoices i
             where i.project_id = p.id and i.kind = 'VENTA' and i.deleted_at is null
               and i.status not in ('BORRADOR','ANULADA')
               and i.due_date < current_date), 0)                                       as overdue_receivable
from public.projects p
where p.deleted_at is null;

-- ---------------------------------------------------------------------
-- v_project_profitability : rentabilidad agregada por proyecto
-- ---------------------------------------------------------------------
create or replace view public.v_project_profitability
with (security_invoker = on) as
select
  f.project_id,
  f.project_code,
  f.currency,
  count(*)                        as sales_count,
  sum(f.total_sale)               as revenue,
  sum(f.estimated_cost)           as estimated_cost,
  sum(f.actual_cost)              as actual_cost,
  sum(f.estimated_margin)         as estimated_margin,
  sum(f.actual_margin)            as actual_margin,
  sum(f.projected_cost)           as projected_cost,
  sum(f.projected_margin)         as projected_margin,
  public.pct(sum(f.projected_margin), nullif(sum(f.total_sale), 0)) as projected_margin_pct,
  public.pct(sum(f.estimated_margin), nullif(sum(f.total_sale), 0)) as estimated_margin_pct,
  public.pct(sum(f.actual_margin),    nullif(sum(f.total_sale), 0)) as actual_margin_pct,
  count(*) filter (where f.is_low_margin)   as low_margin_sales,
  count(*) filter (where f.is_cost_overrun) as cost_overrun_sales
from public.v_sale_financials f
where f.status not in ('ANULADA','BORRADOR')
group by f.project_id, f.project_code, f.currency;

-- ---------------------------------------------------------------------
-- v_dashboard_global : una fila por proyecto con todos los KPI de cabecera
-- ---------------------------------------------------------------------
create or replace view public.v_dashboard_global
with (security_invoker = on) as
select
  p.id   as project_id,
  p.code as project_code,
  p.name as project_name,
  p.default_currency as currency,

  -- Comercial
  coalesce((select sum(o.estimated_amount) from public.opportunities o
             where o.project_id = p.id and o.deleted_at is null
               and o.status not in ('GANADA','PERDIDA','ARCHIVADA')), 0)          as pipeline_amount,
  coalesce((select sum(public.money_round(o.estimated_amount * o.probability / 100.0))
              from public.opportunities o
             where o.project_id = p.id and o.deleted_at is null
               and o.status not in ('GANADA','PERDIDA','ARCHIVADA')), 0)          as weighted_pipeline,
  coalesce((select count(*) from public.opportunities o
             where o.project_id = p.id and o.deleted_at is null
               and o.status not in ('GANADA','PERDIDA','ARCHIVADA')), 0)          as open_opportunities,
  coalesce((select count(*) from public.clients c
             where c.project_id = p.id and c.deleted_at is null
               and c.status = 'PROSPECTO'), 0)                                    as prospects,

  -- Ventas
  coalesce((select sum(f.total_sale) from public.v_sale_financials f
             where f.project_id = p.id and f.status = 'COMPROMETIDA'), 0)         as committed_sales,
  coalesce((select sum(f.total_sale) from public.v_sale_financials f
             where f.project_id = p.id
               and f.status in ('CONFIRMADA','EN_PRODUCCION','PARCIALMENTE_ENTREGADA',
                                'ENTREGADA','CERRADA')), 0)                       as closed_sales,

  -- Canchas
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null and c.sale_id is not null), 0) as courts_sold,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.status in ('PLANIFICADA','MATERIALES_PENDIENTES','EN_CONSTRUCCION',
                                'CONSTRUCCION_TERMINADA','GALVANIZADO','GALVANIZADO_TERMINADO',
                                'EMBALAJE','EMBALADA','EN_REPARACION','EN_DESMONTAJE')), 0)    as courts_in_production,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.status in ('EN_TRANSITO','EN_TRANSPORTE')), 0)               as courts_in_transit,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.status in ('EN_INSTALACION','INSTALACION_TERMINADA')), 0)    as courts_installing,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.status = 'ENTREGADA'), 0)                                    as courts_delivered,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.sale_id is not null and c.status <> 'ENTREGADA'), 0)         as courts_pending_delivery,
  coalesce((select count(*) from public.courts c
             where c.project_id = p.id and c.deleted_at is null
               and c.court_type = 'USADA' and c.status = 'DISPONIBLE'), 0)        as used_courts_available,

  -- Finanzas
  fs.total_invoiced_sales,
  fs.total_collected,
  fs.accounts_receivable,
  fs.accounts_payable,
  fs.total_expenses,
  fs.overdue_receivable,

  -- Rentabilidad
  coalesce((select sum(f.estimated_cost) from public.v_sale_financials f
             where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR')), 0) as estimated_cost,
  coalesce((select sum(f.actual_cost) from public.v_sale_financials f
             where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR')), 0) as actual_cost,
  coalesce((select sum(f.actual_margin) from public.v_sale_financials f
             where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR')
               and f.has_actual_cost), 0)                                              as actual_margin,
  (select public.pct(sum(f.actual_margin), nullif(sum(f.total_sale), 0))
     from public.v_sale_financials f
    where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR')
      and f.has_actual_cost)                                                           as actual_margin_pct,
  -- Margen proyectado: real donde existe, estimado donde aun no
  coalesce((select sum(f.projected_margin) from public.v_sale_financials f
             where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR')), 0) as projected_margin,
  (select public.pct(sum(f.projected_margin), nullif(sum(f.total_sale), 0))
     from public.v_sale_financials f
    where f.project_id = p.id and f.status not in ('ANULADA','BORRADOR'))              as projected_margin_pct,

  -- Riesgo
  coalesce((select count(*) from public.manufacturing_projects mp
             where mp.project_id = p.id and mp.deleted_at is null
               and mp.status not in ('TERMINADO','CANCELADO')
               and mp.estimated_completion_date < current_date), 0)               as delayed_manufacturing,
  coalesce((select count(*) from public.follow_ups fu
             where fu.project_id = p.id and fu.status = 'VENCIDO'), 0)            as overdue_follow_ups,
  coalesce((select count(*) from public.alerts a
             where a.project_id = p.id and a.status in ('ABIERTA','RECONOCIDA','EN_GESTION')
               and a.priority = 'CRITICA'), 0)                                    as critical_alerts,
  coalesce((select count(*) from public.alerts a
             where a.project_id = p.id and a.status in ('ABIERTA','RECONOCIDA','EN_GESTION')), 0) as open_alerts
from public.projects p
join public.v_financial_summary fs on fs.project_id = p.id
where p.deleted_at is null and p.active;

comment on view public.v_dashboard_global is
  'KPIs de cabecera por proyecto. Cada campo es clickeable en la UI y navega al listado filtrado equivalente.';

-- ---------------------------------------------------------------------
-- v_client_360 : resumen de la ficha de cliente
-- ---------------------------------------------------------------------
create or replace view public.v_client_360
with (security_invoker = on) as
select
  cl.id as client_id,
  cl.project_id,
  cl.company_name,
  cl.status,
  cl.country,
  cl.owner_user_id,
  (select count(*) from public.contacts ct where ct.client_id = cl.id and ct.deleted_at is null)      as contacts_count,
  (select count(*) from public.opportunities o where o.client_id = cl.id and o.deleted_at is null)    as opportunities_count,
  (select coalesce(sum(o.estimated_amount),0) from public.opportunities o
    where o.client_id = cl.id and o.deleted_at is null
      and o.status not in ('GANADA','PERDIDA','ARCHIVADA'))                                           as open_pipeline,
  (select count(*) from public.sales s where s.client_id = cl.id and s.deleted_at is null)            as sales_count,
  (select coalesce(sum(s.total),0) from public.sales s
    where s.client_id = cl.id and s.deleted_at is null and s.status <> 'ANULADA')                     as total_sold,
  (select coalesce(sum(i.balance),0) from public.invoices i
    where i.client_id = cl.id and i.kind = 'VENTA' and i.deleted_at is null
      and i.status not in ('BORRADOR','ANULADA'))                                                     as receivable,
  (select count(*) from public.courts c where c.client_id = cl.id and c.deleted_at is null)           as courts_count,
  (select max(ca.activity_date) from public.commercial_activities ca where ca.client_id = cl.id)      as last_activity_at,
  (select count(*) from public.follow_ups fu
    where fu.client_id = cl.id and fu.status in ('PENDIENTE','EN_CURSO','VENCIDO'))                   as open_follow_ups,
  (select count(*) from public.follow_ups fu where fu.client_id = cl.id and fu.status = 'VENCIDO')    as overdue_follow_ups
from public.clients cl
where cl.deleted_at is null;

-- ---------------------------------------------------------------------
-- v_agenda : reuniones, seguimientos, instalaciones, despachos y
-- vencimientos en un solo feed (alimenta HOY, PROXIMOS 7 DIAS y calendario)
-- ---------------------------------------------------------------------
create or replace view public.v_agenda
with (security_invoker = on) as
select project_id, 'REUNION'::text as kind, id as entity_id, 'MEETING'::entity_type as entity_type,
       coalesce(objective, 'Reunion') as title, meeting_date as event_date,
       responsible_user_id as user_id, status::text as status, 'MEDIA'::priority_level as priority
  from public.meetings where deleted_at is null and status in ('PLANIFICADA','CONFIRMADA')
union all
select project_id, 'SEGUIMIENTO', id, 'FOLLOW_UP', title, due_date,
       responsible_user_id, status::text, priority
  from public.follow_ups where status in ('PENDIENTE','EN_CURSO','VENCIDO')
union all
select project_id, 'INSTALACION', id, 'INSTALLATION',
       coalesce(name, installation_number), planned_start_date,
       responsible_user_id, status::text, 'ALTA'::priority_level
  from public.installations where deleted_at is null and status in ('PLANIFICADA','CONFIRMADA','EN_CURSO')
union all
select project_id, 'DESPACHO', id, 'SHIPMENT', shipment_number, departure_date,
       created_by, status::text, 'ALTA'::priority_level
  from public.shipments where deleted_at is null and status in ('PLANIFICADO','RESERVADO','CARGADO')
union all
select project_id, 'ENTREGA', id, 'SALE', sale_number, delivery_date,
       salesperson_id, status::text, 'ALTA'::priority_level
  from public.sales
 where deleted_at is null and delivery_date is not null
   and status not in ('ENTREGADA','CERRADA','ANULADA')
union all
select project_id, 'VENCIMIENTO_FACTURA', id, 'INVOICE', invoice_number, due_date,
       created_by, status::text, 'CRITICA'::priority_level
  from public.invoices
 where deleted_at is null and due_date is not null and balance > 0
   and status not in ('BORRADOR','ANULADA')
union all
select project_id, 'VENCIMIENTO_CONTRATO', id, 'CONTRACT', contract_number, end_date,
       created_by, status::text, 'MEDIA'::priority_level
  from public.contracts
 where deleted_at is null and end_date is not null and status in ('FIRMADO','VIGENTE')
union all
select project_id, 'TAREA', id, 'TASK', title, due_date,
       assigned_to, status::text, priority
  from public.tasks where status in ('PENDIENTE','EN_CURSO','BLOQUEADA') and due_date is not null;

comment on view public.v_agenda is
  'Feed unificado de fechas. Filtrar por event_date = current_date (HOY) o rango de 7 dias.';

-- ---------------------------------------------------------------------
-- v_control_center : que requiere atencion hoy
-- ---------------------------------------------------------------------
create or replace view public.v_control_center
with (security_invoker = on) as
select
  a.id,
  a.project_id,
  a.alert_type,
  a.priority,
  a.status,
  a.title,
  a.message,
  a.entity_type,
  a.entity_id,
  a.metadata,
  a.first_detected_at,
  a.last_detected_at,
  case a.priority
    when 'CRITICA' then 'CRITICO'
    when 'ALTA'    then 'IMPORTANTE'
    else 'PROXIMO'
  end as bucket,
  (select count(*) from public.tasks t where t.alert_id = a.id and t.status <> 'CANCELADA') as tasks_count
from public.alerts a
where a.status in ('ABIERTA','RECONOCIDA','EN_GESTION');

-- ---------------------------------------------------------------------
-- v_used_courts_inventory : dashboard de canchas usadas (§48)
-- ---------------------------------------------------------------------
create or replace view public.v_used_courts_inventory
with (security_invoker = on) as
select
  c.project_id,
  c.id as court_id,
  c.court_number,
  c.serial_number,
  c.model,
  c.status,
  c.physical_condition,
  c.current_location,
  c.country,
  c.currency,
  coalesce(c.purchase_cost, 0)                                             as purchase_cost,
  coalesce(c.refurbishment_cost, 0)                                        as refurbishment_cost,
  coalesce((select sum(sc.actual_amount) from public.sale_costs sc
             where sc.court_id = c.id and sc.deleted_at is null), 0)       as allocated_costs,
  coalesce(c.purchase_cost, 0) + coalesce(c.refurbishment_cost, 0)
    + coalesce((select sum(sc.actual_amount) from public.sale_costs sc
                 where sc.court_id = c.id and sc.deleted_at is null), 0)   as total_cost,
  coalesce(c.sale_price, 0)                                                as sale_price,
  public.money_round(coalesce(c.sale_price, 0)
    - (coalesce(c.purchase_cost, 0) + coalesce(c.refurbishment_cost, 0)
       + coalesce((select sum(sc.actual_amount) from public.sale_costs sc
                    where sc.court_id = c.id and sc.deleted_at is null), 0))) as margin,
  c.sale_id,
  c.client_id
from public.courts c
where c.deleted_at is null and c.court_type = 'USADA';

-- ---------------------------------------------------------------------
-- Permisos de lectura sobre las vistas (RLS de las tablas base aplica)
-- ---------------------------------------------------------------------
grant select on
  public.v_sale_financials, public.v_sale_cost_variance, public.v_sales_summary,
  public.v_court_status_summary, public.v_manufacturing_summary, public.v_pipeline_summary,
  public.v_accounts_receivable, public.v_accounts_payable, public.v_financial_summary,
  public.v_project_profitability, public.v_dashboard_global, public.v_client_360,
  public.v_agenda, public.v_control_center, public.v_used_courts_inventory
to authenticated;
