-- =====================================================================
-- 010_manufacturing_courts.sql
-- Proyectos de fabricacion, canchas e historial de estados.
-- =====================================================================

create table public.manufacturing_projects (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null references public.projects(id) on delete restrict,
  sale_id                     uuid references public.sales(id) on delete set null,
  client_id                   uuid references public.clients(id) on delete set null,
  code                        text,
  name                        text not null,
  description                 text,
  quantity_courts             integer not null default 0,
  start_date                  date,
  estimated_completion_date   date,
  actual_completion_date      date,
  status                      manufacturing_status not null default 'PLANIFICACION',
  responsible_user_id         uuid references public.profiles(id) on delete set null,
  priority                    priority_level not null default 'MEDIA',
  notes                       text,
  created_by                  uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,

  constraint manufacturing_quantity_ck check (quantity_courts >= 0),
  constraint manufacturing_dates_ck check (
    start_date is null or estimated_completion_date is null
    or estimated_completion_date >= start_date
  )
);

create index manufacturing_project_idx        on public.manufacturing_projects (project_id) where deleted_at is null;
create index manufacturing_sale_idx           on public.manufacturing_projects (sale_id) where deleted_at is null;
create index manufacturing_project_status_idx on public.manufacturing_projects (project_id, status) where deleted_at is null;
create index manufacturing_late_idx           on public.manufacturing_projects (estimated_completion_date)
  where deleted_at is null and status not in ('TERMINADO','CANCELADO');

select app.attach_updated_at('public.manufacturing_projects');

-- ---------------------------------------------------------------------
-- Canchas (nuevas y usadas)
-- ---------------------------------------------------------------------
create table public.courts (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete restrict,
  sale_id                   uuid references public.sales(id) on delete set null,
  manufacturing_project_id  uuid references public.manufacturing_projects(id) on delete set null,
  client_id                 uuid references public.clients(id) on delete set null,
  court_number              text not null,
  serial_number             text,
  model                     text,
  court_type                court_kind not null default 'NUEVA',
  year                      integer,
  status                    court_status not null default 'PLANIFICADA',
  current_location          text,
  country                   text,
  city                      text,
  purchase_cost             numeric(14,2),
  refurbishment_cost        numeric(14,2),
  sale_price                numeric(14,2),
  currency                  currency_code not null default 'EUR',
  physical_condition        physical_condition,
  dimensions                text,
  glass_thickness_mm        integer,
  has_lighting              boolean not null default false,
  delivered_at              timestamptz,
  notes                     text,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint courts_number_uk   unique (project_id, court_number),
  constraint courts_year_ck     check (year is null or year between 1980 and 2100),
  constraint courts_amounts_ck  check (
    coalesce(purchase_cost,0) >= 0 and coalesce(sale_price,0) >= 0
    and coalesce(refurbishment_cost,0) >= 0
  ),
  -- Maquina de estados: cada tipo de cancha solo admite su set de estados.
  constraint courts_status_domain_ck check (
    (court_type = 'NUEVA' and status in (
      'PLANIFICADA','MATERIALES_PENDIENTES','EN_CONSTRUCCION','CONSTRUCCION_TERMINADA',
      'GALVANIZADO','GALVANIZADO_TERMINADO','EMBALAJE','EMBALADA','EN_TRANSITO',
      'EN_INSTALACION','INSTALACION_TERMINADA','ENTREGADA','BAJA'))
    or
    (court_type = 'USADA' and status in (
      'DISPONIBLE','RESERVADA','EN_DESMONTAJE','DESMONTADA','EN_REPARACION',
      'PREPARADA','EN_TRANSPORTE','EN_TRANSITO','EN_INSTALACION',
      'INSTALACION_TERMINADA','ENTREGADA','VENDIDA','BAJA'))
  )
);

comment on table public.courts is
  'Unidad fisica trazable. Estado propio + historial. Se relaciona con venta, fabricacion, embarque e instalacion.';

create unique index courts_serial_uk on public.courts (project_id, serial_number)
  where serial_number is not null and deleted_at is null;

create index courts_project_status_idx on public.courts (project_id, status) where deleted_at is null;
create index courts_sale_idx           on public.courts (sale_id) where deleted_at is null;
create index courts_manufacturing_idx  on public.courts (manufacturing_project_id) where deleted_at is null;
create index courts_client_idx         on public.courts (client_id) where deleted_at is null;
create index courts_type_status_idx    on public.courts (project_id, court_type, status) where deleted_at is null;

select app.attach_updated_at('public.courts');

-- Numeracion automatica de cancha (EU-0023)
create or replace function app.tg_courts_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_prefix text;
  v_next   integer;
begin
  if new.court_number is null or btrim(new.court_number) = '' then
    select code into v_prefix from public.projects where id = new.project_id;

    -- year = 0 => correlativo continuo (no se reinicia cada anio)
    insert into public.document_sequences (project_id, sequence_key, prefix, year, last_value)
    values (new.project_id, 'COURT', v_prefix, 0, 1)
    on conflict (project_id, sequence_key, year)
      do update set last_value = public.document_sequences.last_value + 1,
                    updated_at = now()
    returning last_value into v_next;

    new.court_number := format('%s-%s', v_prefix, lpad(v_next::text, 4, '0'));
  end if;
  return new;
end;
$$;

create trigger courts_set_number
  before insert on public.courts
  for each row execute function app.tg_courts_number();

-- ---------------------------------------------------------------------
-- Historial de estados (poblado automaticamente por trigger)
-- ---------------------------------------------------------------------
create table public.court_status_history (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  court_id        uuid not null references public.courts(id) on delete cascade,
  previous_status court_status,
  new_status      court_status not null,
  changed_by      uuid references public.profiles(id) on delete set null,
  changed_at      timestamptz not null default now(),
  comment         text
);

create index court_status_history_court_idx on public.court_status_history (court_id, changed_at desc);
create index court_status_history_project_idx on public.court_status_history (project_id, changed_at desc);

-- ---------------------------------------------------------------------
-- FKs diferidas de sale_costs -> courts
-- ---------------------------------------------------------------------
alter table public.sale_costs
  add constraint sale_costs_court_fk
  foreign key (court_id) references public.courts(id) on delete set null;
