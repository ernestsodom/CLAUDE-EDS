-- =====================================================================
-- 02_rls_security.sql
-- Verificacion de RLS (§100 "Seguridad", §68).
--
-- Se impersona a cada usuario tal como lo hace PostgREST: rol
-- `authenticated` + claim `sub` en request.jwt.claims. Si RLS estuviera
-- mal, estas pruebas devolverian filas de otros proyectos.
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

-- Usuario sin ningun acceso: sirve para probar el aislamiento total.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000099','authenticated','authenticated',
        'intruso@example.com','x', now(), '{}','{"full_name":"Usuario Sin Acceso"}')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name) values
  ('b0000000-0000-4000-8000-000000000099','intruso@example.com','Usuario Sin Acceso')
on conflict (id) do nothing;

-- =====================================================================
-- 1) Usuario SIN acceso no ve absolutamente nada
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000099","role":"authenticated"}', false);

do $$
declare n integer;
begin
  select count(*) into n from public.clients;       perform pg_temp.assert_eq('sin acceso: clientes',  n, 0);
  select count(*) into n from public.sales;         perform pg_temp.assert_eq('sin acceso: ventas',    n, 0);
  select count(*) into n from public.courts;        perform pg_temp.assert_eq('sin acceso: canchas',   n, 0);
  select count(*) into n from public.invoices;      perform pg_temp.assert_eq('sin acceso: facturas',  n, 0);
  select count(*) into n from public.projects;      perform pg_temp.assert_eq('sin acceso: proyectos', n, 0);
  select count(*) into n from public.v_sale_financials;
                                                    perform pg_temp.assert_eq('sin acceso: vista financiera', n, 0);
  select count(*) into n from public.v_dashboard_global;
                                                    perform pg_temp.assert_eq('sin acceso: dashboard', n, 0);
end;
$$;

reset role;

-- =====================================================================
-- 2) Usuario COMERCIAL: ve EUROPA y VENTA_USADAS, NO ve ATILA
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $$
declare n integer;
begin
  -- Aunque la consulta NO filtre por project_id, RLS excluye ATILA.
  select count(*) into n from public.clients c
    join public.projects p on p.id = c.project_id where p.code = 'ATILA';
  perform pg_temp.assert_eq('comercial: clientes de ATILA visibles', n, 0);

  select count(*) into n from public.clients c
    join public.projects p on p.id = c.project_id where p.code = 'EUROPA';
  perform pg_temp.assert_eq('comercial: clientes de EUROPA visibles', n, 5);

  select count(*) into n from public.projects;
  perform pg_temp.assert_eq('comercial: proyectos accesibles', n, 2);

  -- COMERCIAL no tiene permisos financieros de escritura ni banks.view
  select count(*) into n from public.bank_accounts;
  perform pg_temp.assert_eq('comercial: cuentas bancarias', n, 0);

  select count(*) into n from public.expenses;
  perform pg_temp.assert_eq('comercial: gastos', n, 0);

  -- Pero si ve las facturas (necesita el estado de cobro de sus ventas)
  select count(*) into n from public.invoices;
  if n = 0 then raise exception 'FALLO: comercial deberia ver facturas'; end if;
  raise notice 'OK   comercial: facturas visibles = %', n;
end;
$$;

-- El comercial NO puede escribir en un proyecto al que no tiene acceso
do $$
declare v_atila uuid;
begin
  select id into v_atila from public.projects where code = 'ATILA';
  -- v_atila es NULL porque el proyecto ni siquiera es visible -> el INSERT
  -- fallaria por not-null. Usamos el UUID literal del seed.
  begin
    insert into public.clients (project_id, company_name, status)
    values ('a0000000-0000-4000-8000-000000000002','Cliente Intruso','PROSPECTO');
    raise exception 'FALLO: se permitio insertar en un proyecto sin acceso';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'OK   comercial: INSERT en ATILA bloqueado por RLS';
  end;
end;
$$;

reset role;

-- =====================================================================
-- 3) Usuario OPERACIONES: no puede modificar ventas ni ver finanzas
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

do $$
declare n integer;
begin
  select count(*) into n from public.courts;
  if n = 0 then raise exception 'FALLO: operaciones deberia ver canchas'; end if;
  raise notice 'OK   operaciones: canchas visibles = %', n;

  select count(*) into n from public.sales;
  if n = 0 then raise exception 'FALLO: operaciones deberia ver ventas'; end if;
  raise notice 'OK   operaciones: ventas visibles = %', n;

  -- OPERACIONES no tiene sales.update -> la fila no es actualizable
  update public.sales set notes = 'modificado por operaciones'
   where sale_number = 'EUROPA-2026-0001';
  get diagnostics n = row_count;
  perform pg_temp.assert_eq('operaciones: filas de venta actualizadas', n, 0);

  -- Sin permisos financieros
  select count(*) into n from public.payments;
  perform pg_temp.assert_eq('operaciones: pagos visibles', n, 0);

  -- ATILA en modo LECTURA: ve, pero no escribe
  update public.courts set notes = 'x'
   where project_id = 'a0000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.assert_eq('operaciones: canchas de ATILA modificadas (rol LECTURA)', n, 0);
end;
$$;

reset role;

-- =====================================================================
-- 4) Escalada de privilegios bloqueada
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $$
begin
  begin
    update public.profiles set is_super_admin = true where id = auth.uid();
    raise exception 'FALLO: un usuario pudo auto-asignarse super admin';
  exception
    when insufficient_privilege then
      raise notice 'OK   escalada a super admin bloqueada (privilegio de columna)';
  end;

  begin
    insert into public.user_project_access (user_id, project_id, role_id)
    values (auth.uid(), 'a0000000-0000-4000-8000-000000000002',
            (select id from public.roles where code = 'ADMIN'));
    raise exception 'FALLO: un usuario pudo auto-asignarse acceso a otro proyecto';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'OK   auto-asignacion de acceso a proyecto bloqueada';
  end;
end;
$$;

reset role;

-- =====================================================================
-- 5) Usuario FINANZAS: ve dinero, no toca fabricacion
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated"}', false);

do $$
declare n integer;
begin
  select count(*) into n from public.invoices;
  if n = 0 then raise exception 'FALLO: finanzas deberia ver facturas'; end if;
  raise notice 'OK   finanzas: facturas visibles = %', n;

  select count(*) into n from public.v_accounts_receivable;
  if n = 0 then raise exception 'FALLO: finanzas deberia ver cuentas por cobrar'; end if;
  raise notice 'OK   finanzas: cuentas por cobrar = %', n;

  update public.manufacturing_projects set notes = 'x';
  get diagnostics n = row_count;
  perform pg_temp.assert_eq('finanzas: proyectos de fabricacion modificados', n, 0);
end;
$$;

reset role;

-- =====================================================================
-- 6) Super admin ve los 3 proyectos
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $$
declare n integer;
begin
  select count(*) into n from public.projects;
  perform pg_temp.assert_eq('super admin: proyectos visibles', n, 3);

  select count(*) into n from public.v_dashboard_global;
  perform pg_temp.assert_eq('super admin: filas de dashboard', n, 3);

  select jsonb_array_length(public.get_session_context() -> 'projects') into n;
  perform pg_temp.assert_eq('super admin: proyectos en el contexto de sesion', n, 3);
end;
$$;

reset role;

do $$
begin
  raise notice '--------------------------------------------------';
  raise notice 'TODAS LAS PRUEBAS DE SEGURIDAD (RLS) PASARON';
  raise notice '--------------------------------------------------';
end;
$$;
