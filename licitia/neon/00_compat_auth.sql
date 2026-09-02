-- ============================================================================
-- LicitIA en Neon — capa de compatibilidad
--
-- El esquema de la aplicacion se mantiene TAL CUAL (35 tablas, 65 policies
-- RLS). Lo unico que Supabase aportaba y Neon no trae de fabrica es el
-- esquema `auth`: la tabla de identidades y la funcion `auth.uid()` que
-- usan las 22 expresiones de las policies.
--
-- En Supabase, auth.uid() leia el `sub` del JWT que PostgREST publicaba en
-- cada peticion. En Neon no hay PostgREST: la aplicacion abre la conexion,
-- asi que es ella la que declara de quien es la sesion con
--     select set_config('app.user_id', $1, true)   -- true = solo esta transaccion
-- al inicio de cada transaccion. `local = true` es deliberado: con un pool
-- de conexiones, un valor de sesion se filtraria a la siguiente peticion
-- que reutilice esa conexion.
--
-- Asi las 65 policies siguen siendo la frontera de seguridad real, sin
-- reescribir ninguna.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists auth;

-- Identidades. La gestiona el proveedor de autenticacion elegido (Neon
-- Auth / Better Auth); aqui vive el minimo que el esquema referencia:
-- profiles.id -> auth.users(id).
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

-- Equivalentes de los roles de Supabase, para que los GRANT del volcado
-- se apliquen sin cambios.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- ---------------------------------------------------------------------
-- `service_role` como lo usa el pipeline de ingesta (fase 2)
--
-- `createAdminDbClient()` (lib/db/index.ts) ejecuta "sin identidad" para
-- tareas de fondo — el equivalente a `service_role` en Supabase, que
-- BYPASSA RLS por completo. Al principio esa capa solo dejaba
-- `app.user_id` vacío en vez de cambiar de rol: con eso, `auth.uid()` es
-- null y expresiones como `organization_id = current_org_id()` son NULL
-- (falsas) — el resultado es CERO filas visibles, lo opuesto de "verlo
-- todo". Detectado en producción: la ingesta fallaba con "Documento no
-- encontrado" sobre un documento que sí existía y sí pasaba RLS para el
-- usuario que lo subió.
--
-- La corrección: `service_role` ya tiene `bypassrls` (arriba) pero le
-- faltaban permisos sobre las tablas de negocio (solo tenía acceso a
-- `auth.users`), y `app_user` no podía asumirlo. El ejecutor
-- (`lib/db/executor.ts`) hace `set local role service_role` cuando
-- `userId` es null — dura solo la transacción, igual que `app.user_id`.
-- ---------------------------------------------------------------------
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant service_role to app_user;

-- ---------------------------------------------------------------------
-- Rol de aplicacion
--
-- PostgreSQL EXIME al dueño de una tabla de sus propias politicas RLS. Si
-- la aplicacion se conectara con el rol dueño (el que Neon crea por
-- defecto), los 65 candados quedarian desactivados en silencio y nadie se
-- enteraria hasta que un usuario viera datos de otra organizacion.
--
-- Por eso la aplicacion se conecta con este rol, que no es dueño de nada.
-- La contrasena se fija al crear el proyecto en Neon y viaja en
-- DATABASE_URL; aqui no se escribe ninguna.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login;
  end if;
end;
$$;

grant usage on schema public, auth to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant select on auth.users to app_user;

alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;
