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
