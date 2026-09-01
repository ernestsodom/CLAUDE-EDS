-- =====================================================================
-- 03_better_auth_schema.sql — Fase 3: autenticación sobre Neon.
--
-- Tablas propias de better-auth (`ba_user`, `ba_session`, `ba_account`,
-- `ba_verification`), separadas a propósito del `auth` de compatibilidad
-- de `00_compat_auth.sql`: ese esquema solo existe para que `auth.uid()`
-- siga leyendo `app.user_id` y las 65 políticas RLS no tuvieran que
-- cambiar. Este archivo es la fuente de identidad real; el otro, el punto
-- por donde RLS la observa. Ya aplicado en el proyecto Neon `licitia`
-- (polished-firefly-39510970) — este archivo documenta lo ejecutado.
--
-- El id del único usuario real (`ba_user.id`) se hizo coincidir con
-- `profiles.id`/`auth.users.id` para no reescribir las FKs que ya
-- apuntaban a ese valor. Ver `02_data_migration_plan.md`.
-- =====================================================================

create table if not exists public.ba_user (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.ba_session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references public.ba_user(id) on delete cascade
);

create table if not exists public.ba_account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references public.ba_user(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.ba_verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

create index if not exists ba_session_user_id_idx on public.ba_session("userId");
create index if not exists ba_account_user_id_idx on public.ba_account("userId");

-- Sin RLS: son tablas propias de better-auth, no de datos de negocio, y la
-- aplicación se conecta siempre como `app_user`, un rol no-dueño con grants
-- explícitos (abajo) — no hace falta el mecanismo de RLS aquí.
grant select, insert, update, delete
  on public.ba_user, public.ba_session, public.ba_account, public.ba_verification
  to app_user;

-- ---------------------------------------------------------------------
-- Migración del único usuario real (ernestodom@gmail.com).
--
-- El hash de la contraseña se copió tal cual desde
-- `auth.users.encrypted_password` en Supabase (bcrypt, formato $2a$) y
-- better-auth se configuró (`lib/auth.ts`) para verificar con bcrypt en vez
-- de su scrypt por defecto — así el usuario sigue entrando con la misma
-- contraseña, sin flujo de reseteo.
-- ---------------------------------------------------------------------
insert into public.ba_user (id, name, email, "emailVerified", "createdAt", "updatedAt")
values ('f3b44a36-8f58-4322-98ff-af9bb078ec91', 'ernestodom', 'ernestodom@gmail.com', true,
        '2026-08-06 15:47:43.895757+00', now())
on conflict (id) do nothing;

insert into public.ba_account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
values (gen_random_uuid()::text, 'f3b44a36-8f58-4322-98ff-af9bb078ec91', 'credential',
        'f3b44a36-8f58-4322-98ff-af9bb078ec91',
        '$2a$10$F0Ai9aDw67x.vNNN7Igpue/YUAmQDuXIFLpp17xTTwBXDYOWsr9su', now(), now())
on conflict (id) do nothing;
