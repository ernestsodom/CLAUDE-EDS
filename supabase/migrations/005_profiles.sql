-- =====================================================================
-- 005_profiles.sql
-- Perfil de usuario ligado 1:1 a auth.users.
-- =====================================================================

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             citext not null,
  phone             text,
  avatar_url        text,
  job_title         text,
  -- Rol por defecto sugerido al asignar el usuario a un proyecto nuevo.
  default_role_id   uuid references public.roles(id) on delete set null,
  -- Super admin de plataforma: puede crear proyectos y ver auditoria global.
  is_super_admin    boolean not null default false,
  locale            text not null default 'es',
  timezone          text not null default 'Europe/Madrid',
  active            boolean not null default true,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint profiles_email_uk unique (email)
);

comment on table public.profiles is
  'Datos de negocio del usuario. auth.users mantiene credenciales y sesion.';
comment on column public.profiles.is_super_admin is
  'Bypass controlado de RLS a nivel plataforma. Solo se asigna via service_role / SQL.';

create index profiles_active_idx on public.profiles (active);

select app.attach_updated_at('public.profiles');

-- ---------------------------------------------------------------------
-- Alta automatica del perfil al registrarse en Supabase Auth
-- ---------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@no-email.local'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
