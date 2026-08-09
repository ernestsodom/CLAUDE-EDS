-- =====================================================================
-- 001_extensions.sql
-- PADEL BUSINESS MANAGEMENT PLATFORM
-- Extensiones, esquemas internos y utilidades base.
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";       -- busquedas ILIKE / fuzzy
create extension if not exists "btree_gist";
create extension if not exists "citext";        -- emails case-insensitive

-- ---------------------------------------------------------------------
-- Esquema `app`: funciones internas, helpers de seguridad y logica de
-- negocio. NUNCA se expone via PostgREST (no esta en el search_path
-- publico de la API), lo que evita que el cliente invoque helpers
-- SECURITY DEFINER directamente.
-- ---------------------------------------------------------------------
create schema if not exists app;

revoke all on schema app from public;
revoke all on schema app from anon, authenticated;
grant usage on schema app to postgres, service_role;

-- ---------------------------------------------------------------------
-- Utilidad global: updated_at
-- ---------------------------------------------------------------------
create or replace function app.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.tg_set_updated_at() is
  'Trigger BEFORE UPDATE: mantiene updated_at sincronizado.';

-- ---------------------------------------------------------------------
-- Utilidad: aplicar el trigger de updated_at a una tabla
-- ---------------------------------------------------------------------
create or replace function app.attach_updated_at(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_name text := 'set_updated_at_' || replace(p_table::text, '.', '_');
begin
  execute format(
    'drop trigger if exists %I on %s', v_name, p_table::text
  );
  execute format(
    'create trigger %I before update on %s
       for each row execute function app.tg_set_updated_at()',
    v_name, p_table::text
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Helpers matematicos.
-- Viven en `public` (no en `app`) porque las VIEWS analiticas se ejecutan
-- con `security_invoker = on`: el usuario final necesita EXECUTE sobre
-- ellos. Son inmutables y sin acceso a datos, por lo que exponerlos no
-- tiene implicancias de seguridad.
-- ---------------------------------------------------------------------

-- Redondeo monetario consistente (2 decimales)
create or replace function public.money_round(p_value numeric)
returns numeric
language sql
immutable
parallel safe
as $$
  select round(coalesce(p_value, 0)::numeric, 2);
$$;

-- Porcentaje seguro (evita division por cero devolviendo NULL)
create or replace function public.pct(p_numerator numeric, p_denominator numeric)
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_denominator, 0) = 0 then null
    else round((coalesce(p_numerator, 0) / p_denominator) * 100, 2)
  end;
$$;

grant execute on function public.money_round(numeric) to authenticated, anon;
grant execute on function public.pct(numeric, numeric) to authenticated, anon;
