-- =====================================================================
-- 022_rls.sql
-- Row Level Security.
--
-- MODELO
-- ------
--   auth.uid()
--      -> user_project_access (rol por proyecto)
--      -> role_permissions -> permissions (module.action)
--      -> project_id de la fila
--
-- Patron de policy (rendimiento):
--   using ( project_id in (select app.projects_with_permission('sales.view')) )
-- El subquery no depende de la fila, por lo que Postgres lo evalua UNA
-- sola vez por statement (InitPlan), no una vez por fila.
--
-- Para tablas hijas sin project_id propio se resuelve el proyecto desde
-- el padre con un EXISTS indexado.
--
-- El frontend NUNCA es la frontera de seguridad: aunque se olvide el
-- filtro `where project_id = ...`, PostgreSQL no devuelve filas ajenas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Activar RLS en TODAS las tablas de `public`
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

-- No se usa FORCE ROW LEVEL SECURITY: el propietario de las tablas
-- (`postgres`) debe poder ejecutar migraciones, seeds y jobs. Los roles de
-- la API (`authenticated`, `anon`) NO son propietarios, por lo que RLS
-- siempre se les aplica. `service_role` tiene BYPASSRLS y solo se usa
-- server-side.

-- ---------------------------------------------------------------------
-- 2) Catalogos globales: lectura para cualquier usuario autenticado,
--    escritura solo para super admin.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select unnest(array[
      'modules','roles','permissions','role_permissions',
      'document_types','cost_categories','materials',
      'checklist_templates','checklist_template_items','exchange_rates'
    ]) as tbl
  loop
    execute format($p$
      create policy %1$s_select_all on public.%1$I
        for select to authenticated using (true);
    $p$, r.tbl);

    execute format($p$
      create policy %1$s_admin_write on public.%1$I
        for all to authenticated
        using (app.is_super_admin())
        with check (app.is_super_admin());
    $p$, r.tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) projects / project_modules / document_sequences
-- ---------------------------------------------------------------------
create policy projects_select on public.projects
  for select to authenticated
  using (id in (select app.accessible_project_ids()));

create policy projects_admin_all on public.projects
  for all to authenticated
  using (app.is_super_admin())
  with check (app.is_super_admin());

create policy project_modules_select on public.project_modules
  for select to authenticated
  using (project_id in (select app.accessible_project_ids()));

create policy project_modules_manage on public.project_modules
  for all to authenticated
  using (project_id in (select app.projects_with_permission('settings.manage')))
  with check (project_id in (select app.projects_with_permission('settings.manage')));

create policy document_sequences_select on public.document_sequences
  for select to authenticated
  using (project_id in (select app.accessible_project_ids()));

-- ---------------------------------------------------------------------
-- 4) profiles / user_project_access
-- ---------------------------------------------------------------------
-- Cada usuario ve su perfil; ademas ve los perfiles de quienes comparten
-- proyecto con el (necesario para mostrar responsables y asignaciones).
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or app.is_super_admin()
    or exists (
      select 1 from public.user_project_access upa
      where upa.user_id = profiles.id
        and upa.active
        and upa.project_id in (select app.accessible_project_ids())
    )
  );

-- El usuario edita su propio perfil. La escalada de privilegios se evita
-- a nivel de columna (ver revoke mas abajo), no dentro de la policy: una
-- policy sobre `profiles` que consultara `profiles` provocaria recursion.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (app.is_super_admin())
  with check (app.is_super_admin());

create policy upa_select_own on public.user_project_access
  for select to authenticated
  using (
    user_id = auth.uid()
    or app.is_super_admin()
    or project_id in (select app.projects_with_permission('settings.manage'))
  );

create policy upa_manage on public.user_project_access
  for all to authenticated
  using (app.is_super_admin() or project_id in (select app.projects_with_permission('settings.manage')))
  with check (app.is_super_admin() or project_id in (select app.projects_with_permission('settings.manage')));

-- ---------------------------------------------------------------------
-- 5) Tablas operacionales con project_id propio
--    (tabla, modulo de permisos)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select * from (values
      ('clients',                 'clients'),
      ('contacts',                'contacts'),
      ('opportunities',           'opportunities'),
      ('commercial_activities',   'opportunities'),
      ('meetings',                'meetings'),
      ('follow_ups',              'follow_ups'),
      ('sales',                   'sales'),
      ('sale_items',              'sales'),
      ('sale_costs',              'sales'),
      ('sale_margin_snapshots',   'profitability'),
      ('manufacturing_projects',  'manufacturing'),
      ('courts',                  'courts'),
      ('court_status_history',    'courts'),
      ('material_requirements',   'materials'),
      ('material_purchases',      'materials'),
      ('suppliers',               'suppliers'),
      ('supplier_quotes',         'suppliers'),
      ('supplier_quote_items',    'suppliers'),
      ('purchase_orders',         'purchases'),
      ('purchase_order_items',    'purchases'),
      ('contracts',               'contracts'),
      ('invoices',                'invoices'),
      ('invoice_items',           'invoices'),
      ('payments',                'payments'),
      ('expenses',                'expenses'),
      ('bank_accounts',           'banks'),
      ('bank_transactions',       'banks'),
      ('shipments',               'logistics'),
      ('shipment_items',          'logistics'),
      ('installations',           'installations'),
      ('installation_courts',     'installations'),
      ('quality_checks',          'quality'),
      ('documents',               'documents'),
      ('document_links',          'documents'),
      ('document_versions',       'documents'),
      ('ai_document_extractions', 'documents'),
      ('approvals',               'documents'),
      ('project_checklists',      'manufacturing'),
      ('checklist_items',         'manufacturing'),
      ('tasks',                   'tasks'),
      ('project_events',          'dashboard')
    ) as t(tbl, module)
  loop
    -- SELECT
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.view');

    -- INSERT
    execute format($p$
      create policy %1$s_insert on public.%1$I
        for insert to authenticated
        with check (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.create');

    -- UPDATE
    execute format($p$
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)))
        with check (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.update');

    -- DELETE (borrado fisico; las entidades criticas usan soft delete)
    execute format($p$
      create policy %1$s_delete on public.%1$I
        for delete to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.delete');
  end loop;
end;
$$;

-- Casos especiales: modulos sin accion .create/.delete en el catalogo
-- (dashboard). project_events se escribe solo desde funciones SECURITY
-- DEFINER, por lo que basta la policy de lectura.
drop policy if exists project_events_insert on public.project_events;
drop policy if exists project_events_update on public.project_events;
drop policy if exists project_events_delete on public.project_events;

drop policy if exists court_status_history_insert on public.court_status_history;
drop policy if exists court_status_history_update on public.court_status_history;
drop policy if exists court_status_history_delete on public.court_status_history;

-- ---------------------------------------------------------------------
-- 6) Alertas y notificaciones
-- ---------------------------------------------------------------------
create policy alerts_select on public.alerts
  for select to authenticated
  using (project_id in (select app.projects_with_permission('control_center.view')));

create policy alerts_update on public.alerts
  for update to authenticated
  using (project_id in (select app.projects_with_permission('control_center.view')))
  with check (project_id in (select app.projects_with_permission('control_center.view')));

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7) Auditoria: lectura para quien administra el proyecto o super admin.
--    Nadie puede modificarla ni borrarla desde la API.
-- ---------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    app.is_super_admin()
    or project_id in (select app.projects_with_permission('settings.view'))
  );

-- ---------------------------------------------------------------------
-- 8) Confidencialidad documental: los documentos marcados como
--    confidenciales solo son visibles para quien puede administrar el
--    proyecto o para quien los subio.
-- ---------------------------------------------------------------------
create policy documents_confidential on public.documents
  as restrictive
  for select to authenticated
  using (
    not is_confidential
    or uploaded_by = auth.uid()
    or app.is_super_admin()
    or project_id in (select app.projects_with_permission('settings.manage'))
  );

-- ---------------------------------------------------------------------
-- 9) Grants a nivel tabla (RLS filtra las filas; los grants controlan
--    que verbos SQL son posibles).
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tablas de solo lectura desde la API
revoke insert, update, delete on public.audit_logs        from authenticated;
revoke insert, update, delete on public.project_events    from authenticated;
revoke insert, update, delete on public.court_status_history from authenticated;
revoke insert, update, delete on public.document_sequences from authenticated;
revoke insert, delete          on public.alerts            from authenticated;

-- Blindaje anti escalada de privilegios.
-- IMPORTANTE: un REVOKE por columna NO resta nada si existe un GRANT a
-- nivel de tabla (el privilegio de tabla cubre todas las columnas). Hay
-- que retirar el UPDATE de tabla y volver a otorgarlo columna por
-- columna. Asi `is_super_admin`, `active`, `default_role_id` y `email`
-- quedan fuera del alcance de la API: solo se cambian con service_role.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, job_title, locale, timezone)
  on public.profiles to authenticated;

-- Nadie crea ni borra perfiles desde la API: los crea el trigger sobre
-- auth.users y los gestiona el administrador server-side.
revoke insert, delete on public.profiles from authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
