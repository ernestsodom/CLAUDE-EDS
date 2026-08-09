-- =====================================================================
-- 01_business_cases.sql
-- Verificacion de los casos de negocio criticos (§101, §102, §103) y de
-- los calculos financieros. Falla ruidosamente si un numero no cuadra.
-- Ejecutar despues de las migraciones + seed.
-- =====================================================================

\set ON_ERROR_STOP on

create or replace function pg_temp.assert_eq(p_label text, p_actual anyelement, p_expected anyelement)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLO [%]: esperado %, obtenido %', p_label, p_expected, p_actual;
  end if;
  raise notice 'OK   % = %', p_label, p_actual;
end;
$$;

do $$
declare v record; n integer; t numeric;
begin
  -- ===================================================================
  -- CASO §101: venta de 4 canchas por 48.000 EUR
  -- ===================================================================
  select * into v from public.v_sale_financials where sale_number = 'EUROPA-2026-0001';

  perform pg_temp.assert_eq('101 total venta',        v.total_sale,        48000.00::numeric);
  perform pg_temp.assert_eq('101 canchas creadas',    v.courts_total,      4::bigint);
  perform pg_temp.assert_eq('101 costo estimado',     v.estimated_cost,    31000.00::numeric);
  perform pg_temp.assert_eq('101 costo real',         v.actual_cost,       32500.00::numeric);
  perform pg_temp.assert_eq('101 margen estimado',    v.estimated_margin,  17000.00::numeric);
  perform pg_temp.assert_eq('101 margen real',        v.actual_margin,     15500.00::numeric);
  perform pg_temp.assert_eq('101 facturado',          v.invoiced_amount,   48000.00::numeric);
  perform pg_temp.assert_eq('101 cobrado',            v.collected_amount,  20000.00::numeric);
  perform pg_temp.assert_eq('101 por cobrar',         v.receivable_amount, 28000.00::numeric);
  perform pg_temp.assert_eq('101 margen real %',      v.actual_margin_percentage, 32.29::numeric);

  -- El proyecto de fabricacion se creo automaticamente
  select count(*) into n from public.manufacturing_projects
   where sale_id = v.sale_id and deleted_at is null;
  perform pg_temp.assert_eq('101 proyecto fabricacion', n, 1);

  -- Los checklists se instanciaron
  select count(*) into n from public.checklist_items ci
    join public.project_checklists pc on pc.id = ci.checklist_id
   where pc.entity_id = v.sale_id;
  perform pg_temp.assert_eq('101 items checklist venta', n, 9);

  -- ===================================================================
  -- CASO §102: 2 canchas, 1 entregada + 1 en transito
  -- ===================================================================
  select * into v from public.v_sale_financials where sale_number = 'EUROPA-2026-0002';

  perform pg_temp.assert_eq('102 total venta',          v.total_sale,       24000.00::numeric);
  perform pg_temp.assert_eq('102 canchas',              v.courts_total,     2::bigint);
  perform pg_temp.assert_eq('102 entregadas',           v.courts_delivered, 1::bigint);
  perform pg_temp.assert_eq('102 en transito',          v.courts_in_transit,1::bigint);
  perform pg_temp.assert_eq('102 por entregar',         v.courts_pending_delivery, 1::bigint);
  perform pg_temp.assert_eq('102 estado de entrega',    v.delivery_state,   'PARCIALMENTE_ENTREGADA');
  -- El trigger propago el estado a la cabecera de la venta
  perform pg_temp.assert_eq('102 estado de la venta',   v.status::text,     'PARCIALMENTE_ENTREGADA');

  -- ===================================================================
  -- CASO §103: cancha usada 8.000, costos 3.300, margen 4.700
  -- ===================================================================
  select * into v from public.v_sale_financials where sale_number = 'VENTA_USADAS-2026-0001';

  perform pg_temp.assert_eq('103 precio venta',   v.total_sale,    8000.00::numeric);
  perform pg_temp.assert_eq('103 costo real',     v.actual_cost,   3300.00::numeric);
  perform pg_temp.assert_eq('103 margen',         v.actual_margin, 4700.00::numeric);
  perform pg_temp.assert_eq('103 margen %',       v.actual_margin_percentage, 58.75::numeric);
  perform pg_temp.assert_eq('103 cobrado 100%',   v.collection_percentage, 100.00::numeric);

  -- ===================================================================
  -- Motor de calculo: totales derivados de las lineas
  -- ===================================================================
  select total into t from public.sales where sale_number = 'EUROPA-2026-0003';
  perform pg_temp.assert_eq('totales desde lineas (6 x 12.000)', t, 72000.00::numeric);

  -- IVA aplicado sobre la OC
  select total into t from public.purchase_orders where po_number = 'OC-EUROPA-2026-0001';
  perform pg_temp.assert_eq('OC con IVA 21%', t, 9982.50::numeric);

  -- ===================================================================
  -- Saldo de factura mantenido por trigger desde los pagos
  -- ===================================================================
  select balance into t from public.invoices where invoice_number = 'FV-EUROPA-2026-0001';
  perform pg_temp.assert_eq('saldo factura 0001', t, 28000.00::numeric);

  select status::text into v from public.invoices where invoice_number = 'FV-VENTA_USADAS-2026-0001';
  perform pg_temp.assert_eq('factura pagada al 100% cambia de estado',
    (select status::text from public.invoices where invoice_number = 'FV-VENTA_USADAS-2026-0001'), 'PAGADA');

  -- ===================================================================
  -- Trazabilidad: historial de estados y timeline
  -- ===================================================================
  select count(*) into n from public.court_status_history h
    join public.courts c on c.id = h.court_id
   where c.sale_id = (select id from public.sales where sale_number = 'EUROPA-2026-0002');
  -- 2 canchas x (creacion + cambio de estado) = 4
  perform pg_temp.assert_eq('historial de estados generado', n, 4);

  select count(*) into n from public.project_events
   where entity_type = 'SALE'
     and entity_id = (select id from public.sales where sale_number = 'EUROPA-2026-0001')
     and event_type = 'SALE_CONFIRMED';
  perform pg_temp.assert_eq('evento SALE_CONFIRMED', n, 1);

  -- Auditoria
  select count(*) into n from public.audit_logs where entity_type = 'SALE' and action = 'STATUS_CHANGE';
  if n = 0 then raise exception 'FALLO: la auditoria no registro cambios de estado de venta'; end if;
  raise notice 'OK   auditoria de cambios de estado = % registros', n;

  -- ===================================================================
  -- Materiales: quantity_missing nunca negativo
  -- ===================================================================
  select count(*) into n from public.material_requirements where quantity_missing < 0;
  perform pg_temp.assert_eq('sin faltantes negativos', n, 0);

  select quantity_missing into t from public.material_requirements mr
    join public.materials m on m.id = mr.material_id
   where m.code = 'PERF-80x80' limit 1;
  perform pg_temp.assert_eq('faltante calculado (480-300-100)', t, 80.000::numeric);

  -- ===================================================================
  -- Motor de alertas
  -- ===================================================================
  select count(*) into n from public.alerts where alert_type = 'FACTURA_VENCIDA';
  if n = 0 then raise exception 'FALLO: no se genero la alerta FACTURA_VENCIDA'; end if;
  raise notice 'OK   alertas FACTURA_VENCIDA = %', n;

  select count(*) into n from public.alerts where alert_type = 'FABRICACION_ATRASADA';
  if n = 0 then raise exception 'FALLO: no se genero la alerta FABRICACION_ATRASADA'; end if;
  raise notice 'OK   alertas FABRICACION_ATRASADA = %', n;

  select count(*) into n from public.alerts where alert_type = 'MATERIAL_FALTANTE';
  if n = 0 then raise exception 'FALLO: no se genero la alerta MATERIAL_FALTANTE'; end if;
  raise notice 'OK   alertas MATERIAL_FALTANTE = %', n;

  select count(*) into n from public.alerts where alert_type = 'COSTO_EXCEDIDO';
  if n = 0 then raise exception 'FALLO: no se genero la alerta COSTO_EXCEDIDO'; end if;
  raise notice 'OK   alertas COSTO_EXCEDIDO = %', n;

  -- Idempotencia: volver a ejecutar el motor no duplica alertas
  select count(*) into n from public.alerts;
  perform app.generate_alerts();
  if (select count(*) from public.alerts) <> n then
    raise exception 'FALLO: el motor de alertas duplica registros (% -> %)',
      n, (select count(*) from public.alerts);
  end if;
  raise notice 'OK   motor de alertas idempotente (% alertas)', n;

  -- ===================================================================
  -- Conversion de moneda: explicita, nunca inventada
  -- ===================================================================
  perform pg_temp.assert_eq('conversion EUR->USD', public.convert_amount(1000, 'EUR', 'USD'), 1085.00::numeric);
  perform pg_temp.assert_eq('sin tasa devuelve NULL',
    public.convert_amount(1000, 'CLP', 'ARS', current_date - 3650), null::numeric);

  raise notice '--------------------------------------------------';
  raise notice 'TODOS LOS CASOS DE NEGOCIO PASARON';
  raise notice '--------------------------------------------------';
end;
$$;
