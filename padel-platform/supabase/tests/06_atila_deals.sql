-- =====================================================================
-- 06_atila_deals.sql
-- Reglas del modulo Negocios (trader / Atila).
--
-- Lo que se verifica aqui no es "que el INSERT funcione", sino que las
-- reglas del negocio esten donde tienen que estar: en la base. Si manana
-- alguien escribe desde otro cliente, un script o la consola de Supabase,
-- estas mismas reglas siguen aplicando.
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

-- Exige que la operacion falle Y que falle por el motivo esperado.
-- Sin `p_expect`, cualquier error (un nombre mal escrito, una funcion
-- ambigua) daria la prueba por buena y la regla real quedaria sin
-- verificar.
create or replace function pg_temp.assert_fails(p_label text, p_sql text, p_expect text)
returns void language plpgsql as $$
declare v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
    if position(lower(p_expect) in lower(v_error)) = 0 then
      raise exception 'FALLO [%]: rechazado por otro motivo. Esperaba "%", obtuve "%"',
        p_label, p_expect, v_error;
    end if;
    raise notice 'OK   % (rechazado: %)', p_label, left(v_error, 50);
    return;
  end;
  raise exception 'FALLO [%]: la operacion deberia haber sido rechazada', p_label;
end;
$$;

do $$
declare
  v_project   uuid;
  v_pro       uuid;
  v_full      uuid;
  v_normal    uuid;
  v_entrada   uuid;
  v_postes    uuid;
  v_deal      uuid;
  v_court     uuid;
  v_code      text;
  n           integer;
  t           numeric;
  v           record;
begin
  select id into v_project from public.projects where code = 'ATILA';

  -- ===================================================================
  -- Catalogos: los tres tipos de cancha y las cuatro posiciones de logo
  -- ===================================================================
  select count(*) into n from public.court_models where project_id = v_project and active;
  perform pg_temp.assert_eq('catalogo tipos de cancha', n, 3);

  select count(*) into n from public.logo_positions where project_id = v_project and active;
  perform pg_temp.assert_eq('catalogo posiciones de logo', n, 4);

  select id into v_pro    from public.court_models where project_id = v_project and code = 'ATILA_PRO';
  select id into v_full   from public.court_models where project_id = v_project and code = 'ATILA_FULL';
  select id into v_normal from public.court_models where project_id = v_project and code = 'NORMAL';

  select default_commission_usd into t from public.court_models where id = v_pro;
  perform pg_temp.assert_eq('comision por defecto del catalogo', t, 1700.00::numeric);

  select id into v_entrada from public.logo_positions where project_id = v_project and code = 'ENTRADA';
  select id into v_postes  from public.logo_positions where project_id = v_project and code = 'POSTES_LUZ';

  -- ===================================================================
  -- REGLA CLAVE: sin venta cerrada no hay fecha de entrega
  -- ===================================================================
  perform pg_temp.assert_fails(
    'negocio potencial con fecha de entrega',
    format($q$
      insert into public.deals (project_id, client_name, status, delivery_date)
      values (%L, 'Club Prueba', 'POTENCIAL', current_date + 30)
    $q$, v_project),
    'deals_dates_ck'
  );

  perform pg_temp.assert_fails(
    'negocio cerrado sin fecha de cierre',
    format($q$
      insert into public.deals (project_id, client_name, status)
      values (%L, 'Club Prueba', 'CERRADA')
    $q$, v_project),
    'deals_dates_ck'
  );

  perform pg_temp.assert_fails(
    'entrega anterior al cierre',
    format($q$
      insert into public.deals (project_id, client_name, status, closed_at, delivery_date)
      values (%L, 'Club Prueba', 'CERRADA', current_date, current_date - 1)
    $q$, v_project),
    'deals_delivery_after_close_ck'
  );

  -- El caso valido: cerrada, con cierre y entrega coherentes.
  insert into public.deals (project_id, client_name, country, city, status, closed_at, delivery_date)
  values (v_project, 'Club Rosario Padel', 'AR', 'Rosario', 'CERRADA',
          current_date - 5, current_date + 45)
  returning id, code into v_deal, v_code;

  perform pg_temp.assert_eq('negocio cerrado admitido', (v_deal is not null), true);

  -- Numeracion correlativa automatica: ATILA-<anio>-0001
  perform pg_temp.assert_eq(
    'codigo correlativo generado',
    (v_code ~ ('^ATILA-' || extract(year from current_date)::text || '-\d{4}$')),
    true
  );

  -- Volver el negocio a potencial obliga a soltar las fechas: la regla
  -- tambien aplica en UPDATE, no solo al crear.
  perform pg_temp.assert_fails(
    'reabrir negocio conservando la entrega',
    format('update public.deals set status = ''EN_NEGOCIACION'' where id = %L', v_deal),
    'deals_dates_ck'
  );

  -- ===================================================================
  -- Canchas: comision por defecto y totales del negocio
  -- ===================================================================
  insert into public.deal_courts (project_id, deal_id, court_model_id, position)
  values (v_project, v_deal, v_pro, 1)
  returning id into v_court;

  select commission_usd into t from public.deal_courts where id = v_court;
  perform pg_temp.assert_eq('comision heredada del catalogo', t, 1700.00::numeric);

  insert into public.deal_courts (project_id, deal_id, court_model_id, position, is_custom)
  values (v_project, v_deal, v_full,   2, true),
         (v_project, v_deal, v_normal, 3, false);

  select courts_count, total_commission_usd into n, t from public.deals where id = v_deal;
  perform pg_temp.assert_eq('canchas del negocio', n, 3);
  perform pg_temp.assert_eq('comision total (3 x 1.700)', t, 5100.00::numeric);

  -- Una comision distinta a la del catalogo se respeta y recalcula.
  update public.deal_courts set commission_usd = 2000.00 where id = v_court;
  select total_commission_usd into t from public.deals where id = v_deal;
  perform pg_temp.assert_eq('comision total tras ajuste manual', t, 5400.00::numeric);

  -- ===================================================================
  -- Logos: solo en canchas personalizadas
  -- ===================================================================
  perform pg_temp.assert_fails(
    'logo en cancha no personalizada',
    format($q$
      insert into public.deal_court_logos (project_id, deal_court_id, brand, logo_position_id)
      values (%L, %L, 'ATILA', %L)
    $q$, v_project, v_court, v_entrada),
    'cancha personalizada'
  );

  -- La cancha personalizada (posicion 2) si los admite.
  select id into v_court from public.deal_courts where deal_id = v_deal and position = 2;

  insert into public.deal_court_logos (project_id, deal_court_id, brand, logo_position_id)
  values (v_project, v_court, 'ATILA', v_entrada),
         (v_project, v_court, 'ATILA', v_postes),
         (v_project, v_court, 'CLUB',  v_postes);

  select count(*) into n from public.deal_court_logos where deal_court_id = v_court;
  perform pg_temp.assert_eq('logos de la cancha personalizada', n, 3);

  perform pg_temp.assert_fails(
    'logo duplicado (misma marca y posicion)',
    format($q$
      insert into public.deal_court_logos (project_id, deal_court_id, brand, logo_position_id)
      values (%L, %L, 'ATILA', %L)
    $q$, v_project, v_court, v_entrada),
    'deal_court_logos_uk'
  );

  -- Al dejar de ser personalizada, la cancha pierde sus logos.
  update public.deal_courts set is_custom = false where id = v_court;
  select count(*) into n from public.deal_court_logos where deal_court_id = v_court;
  perform pg_temp.assert_eq('logos eliminados al quitar la personalizacion', n, 0);

  -- ===================================================================
  -- Aislamiento entre unidades de negocio
  -- ===================================================================
  perform pg_temp.assert_fails(
    'cancha colgada de un negocio de otro proyecto',
    format($q$
      insert into public.deal_courts (project_id, deal_id, court_model_id, position)
      values ((select id from public.projects where code = 'EUROPA'), %L, %L, 9)
    $q$, v_deal, v_pro),
    'aislamiento'
  );

  -- ===================================================================
  -- Tablero del trader
  -- ===================================================================
  select * into v from public.v_deal_board where deal_id = v_deal;
  perform pg_temp.assert_eq('tablero: canchas', v.courts_count, 3);
  perform pg_temp.assert_eq('tablero: mezcla de tipos', v.court_mix,
    '1x Atila Full, 1x Atila Pro, 1x Cancha Normal');
  perform pg_temp.assert_eq('tablero: dias hasta la entrega', v.days_to_delivery, 45);

  -- Un negocio sin cerrar no puede mostrar cuenta atras de entrega.
  insert into public.deals (project_id, client_name, status)
  values (v_project, 'Club Potencial', 'POTENCIAL')
  returning id into v_deal;

  select * into v from public.v_deal_board where deal_id = v_deal;
  perform pg_temp.assert_eq('tablero: potencial sin fecha de entrega', v.delivery_date, null::date);
  perform pg_temp.assert_eq('tablero: potencial sin cuenta atras', v.days_to_delivery, null::integer);

  -- ===================================================================
  -- Menu de ATILA reducido al trabajo del trader
  -- ===================================================================
  select count(*) into n
    from public.project_modules
   where project_id = v_project and enabled;
  perform pg_temp.assert_eq('modulos activos en ATILA', n, 5);

  select count(*) into n
    from public.project_modules
   where project_id = v_project and enabled and module_code = 'deals';
  perform pg_temp.assert_eq('modulo Negocios activo en ATILA', n, 1);

  select count(*) into n
    from public.project_modules
   where project_id = v_project and enabled
     and module_code in ('manufacturing', 'courts', 'materials', 'sales', 'opportunities');
  perform pg_temp.assert_eq('modulos de fabrica/CRM apagados en ATILA', n, 0);

  -- EUROPA no se toca: sigue con su operacion industrial completa.
  select count(*) into n
    from public.project_modules pm
    join public.projects p on p.id = pm.project_id
   where p.code = 'EUROPA' and pm.enabled and pm.module_code = 'manufacturing';
  perform pg_temp.assert_eq('EUROPA conserva fabricacion', n, 1);

  raise notice 'TODAS LAS REGLAS DE NEGOCIOS (ATILA) PASARON';
end;
$$;
