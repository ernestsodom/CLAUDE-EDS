-- =====================================================================
-- 00_supabase_shim.sql
-- Emula la plataforma Supabase sobre un PostgreSQL vanilla para poder
-- ejecutar y verificar las migraciones en local / CI.
-- NO forma parte del esquema de la aplicacion y NO debe ejecutarse en
-- un proyecto Supabase real (alli estos objetos ya existen).
-- =====================================================================

-- Roles de la plataforma
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
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end;
$$;

grant anon, authenticated, service_role to authenticator;

-- Esquema auth
create schema if not exists auth;

-- Subconjunto de columnas de auth.users de Supabase suficiente para que
-- el mismo seed.sql funcione en local y en un proyecto real.
create table if not exists auth.users (
  instance_id         uuid,
  id                  uuid primary key default gen_random_uuid(),
  aud                 varchar(255),
  role                varchar(255),
  email               varchar(255) unique,
  encrypted_password  varchar(255),
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Presentes solo para que el INSERT de seed.sql (que los fija en '' a
  -- proposito, ver el comentario alli) valga igual en el shim.
  confirmation_token      varchar(255) not null default '',
  recovery_token          varchar(255) not null default '',
  email_change_token_new  varchar(255) not null default '',
  email_change            varchar(255) not null default ''
);

-- Subconjunto de auth.identities: seed.sql inserta aqui la fila que
-- vincula el proveedor "email" a cada usuario (lo exige GoTrue en un
-- proyecto real; el shim la necesita solo para que el mismo seed.sql
-- corra sin tocarlo).
create table if not exists auth.identities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider_id       text not null,
  identity_data     jsonb not null default '{}'::jsonb,
  provider          text not null,
  last_sign_in_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint identities_provider_id_provider_uk unique (provider_id, provider)
);

grant select on auth.identities to authenticated, service_role;

-- auth.uid() lee el claim `sub` del JWT publicado en request.jwt.claims.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- Esquema storage
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id           uuid primary key default gen_random_uuid(),
  bucket_id    text references storage.buckets(id),
  name         text not null,
  owner        uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
