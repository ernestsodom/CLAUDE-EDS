-- =====================================================================
-- 006_user_project_access.sql
-- Acceso de usuarios a proyectos + helpers de seguridad usados por RLS.
-- =====================================================================

create table public.user_project_access (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  role_id       uuid not null references public.roles(id) on delete restrict,
  is_default    boolean not null default false,
  active        boolean not null default true,
  granted_by    uuid references public.profiles(id) on delete set null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint user_project_access_uk unique (user_id, project_id)
);

comment on table public.user_project_access is
  'Un usuario puede tener un rol distinto en cada proyecto. Es la fuente unica de verdad de RLS.';

create index user_project_access_user_idx    on public.user_project_access (user_id) where active;
create index user_project_access_project_idx on public.user_project_access (project_id) where active;
create unique index user_project_access_one_default_idx
  on public.user_project_access (user_id) where is_default and active;

select app.attach_updated_at('public.user_project_access');

-- =====================================================================
-- HELPERS DE SEGURIDAD
-- SECURITY DEFINER + search_path fijo. Viven en el esquema `app`, que no
-- esta expuesto por PostgREST, por lo que el cliente no puede invocarlos.
-- =====================================================================

create or replace function app.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select coalesce(
    (select p.is_super_admin and p.active
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

-- Proyectos donde el usuario tiene acceso activo (cualquier rol).
create or replace function app.accessible_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select p.id
    from public.projects p
   where p.deleted_at is null
     and app.is_super_admin()
  union
  select upa.project_id
    from public.user_project_access upa
    join public.profiles pr on pr.id = upa.user_id
   where upa.user_id = auth.uid()
     and upa.active
     and pr.active;
$$;

-- Proyectos donde el usuario posee un permiso concreto (ej. 'sales.update').
-- Patron de uso en RLS:
--    using ( project_id in (select app.projects_with_permission('sales.view')) )
-- El subquery no depende de la fila -> Postgres lo evalua UNA vez (InitPlan).
create or replace function app.projects_with_permission(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select p.id
    from public.projects p
   where p.deleted_at is null
     and app.is_super_admin()
  union
  select upa.project_id
    from public.user_project_access upa
    join public.profiles      pr on pr.id = upa.user_id and pr.active
    join public.role_permissions rp on rp.role_id = upa.role_id
    join public.permissions      pm on pm.id = rp.permission_id
   where upa.user_id = auth.uid()
     and upa.active
     and pm.code = p_permission;
$$;

-- Version booleana (util dentro de funciones de negocio y WITH CHECK puntuales).
create or replace function app.has_permission(p_project_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select p_project_id in (select app.projects_with_permission(p_permission));
$$;

create or replace function app.has_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select p_project_id in (select app.accessible_project_ids());
$$;

-- Codigo de rol del usuario en un proyecto (solo informativo / UI).
create or replace function app.role_in_project(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select case when app.is_super_admin() then 'ADMIN' else r.code end
    from public.user_project_access upa
    join public.roles r on r.id = upa.role_id
   where upa.user_id = auth.uid()
     and upa.project_id = p_project_id
     and upa.active
   limit 1;
$$;

-- =====================================================================
-- RPC expuesto a la aplicacion (esquema public) para hidratar la sesion:
-- proyectos accesibles + permisos + modulos habilitados, en 1 sola query.
-- =====================================================================
create or replace function public.get_session_context()
returns jsonb
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select jsonb_build_object(
    'user', (
      select jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'email', p.email,
        'avatar_url', p.avatar_url, 'is_super_admin', p.is_super_admin,
        'locale', p.locale, 'timezone', p.timezone
      )
      from public.profiles p where p.id = auth.uid()
    ),
    'projects', coalesce((
      select jsonb_agg(x order by x->>'name')
      from (
        select jsonb_build_object(
          'id', pr.id,
          'code', pr.code,
          'name', pr.name,
          'default_currency', pr.default_currency,
          'timezone', pr.timezone,
          'court_kind', pr.court_kind,
          'role', app.role_in_project(pr.id),
          'modules', coalesce((
            select jsonb_agg(pm.module_code order by m.sort_order)
            from public.project_modules pm
            join public.modules m on m.code = pm.module_code
            where pm.project_id = pr.id and pm.enabled
          ), '[]'::jsonb),
          'permissions', coalesce((
            select jsonb_agg(distinct pm2.code)
            from public.user_project_access upa
            join public.role_permissions rp on rp.role_id = upa.role_id
            join public.permissions pm2 on pm2.id = rp.permission_id
            where upa.user_id = auth.uid() and upa.project_id = pr.id and upa.active
          ), case when app.is_super_admin()
                  then (select jsonb_agg(code) from public.permissions)
                  else '[]'::jsonb end)
        ) as x
        from public.projects pr
        where pr.id in (select app.accessible_project_ids())
          and pr.active
      ) s
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_session_context() to authenticated;

comment on function public.get_session_context() is
  'Contexto de sesion: usuario, proyectos accesibles, rol, modulos y permisos efectivos.';
