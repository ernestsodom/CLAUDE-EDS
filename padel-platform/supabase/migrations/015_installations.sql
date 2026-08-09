-- =====================================================================
-- 015_installations.sql
-- Instalaciones en destino, canchas instaladas y acta de entrega.
-- =====================================================================

create table public.installations (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete restrict,
  sale_id               uuid references public.sales(id) on delete set null,
  client_id             uuid references public.clients(id) on delete set null,
  shipment_id           uuid references public.shipments(id) on delete set null,
  installation_number   text not null,
  name                  text,
  address               text,
  city                  text,
  country               text,
  postal_code           text,
  responsible_user_id   uuid references public.profiles(id) on delete set null,
  crew                  jsonb not null default '[]'::jsonb,  -- [{name, role, phone}]
  planned_start_date    date,
  planned_end_date      date,
  actual_start_date     date,
  actual_end_date       date,
  status                installation_status not null default 'PLANIFICADA',
  -- Acta de recepcion
  received_at           timestamptz,
  received_by_name      text,
  signature_document_id uuid,               -- FK diferida a documents (016)
  client_observations   text,
  notes                 text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint installations_number_uk unique (project_id, installation_number),
  constraint installations_dates_ck check (
    planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date
  ),
  constraint installations_received_ck check (
    status <> 'RECEPCIONADA' or received_at is not null
  )
);

create index installations_project_status_idx on public.installations (project_id, status) where deleted_at is null;
create index installations_sale_idx           on public.installations (sale_id) where deleted_at is null;
create index installations_client_idx         on public.installations (client_id) where deleted_at is null;
create index installations_upcoming_idx       on public.installations (planned_start_date)
  where deleted_at is null and status in ('PLANIFICADA','CONFIRMADA');

select app.attach_updated_at('public.installations');

create or replace function app.tg_installation_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.installation_number is null or btrim(new.installation_number) = '' then
    new.installation_number := 'INS-' || app.next_document_number(new.project_id, 'INSTALLATION');
  end if;
  return new;
end;
$$;

create trigger installations_set_number
  before insert on public.installations
  for each row execute function app.tg_installation_number();

-- ---------------------------------------------------------------------
create table public.installation_courts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete restrict,
  installation_id uuid not null references public.installations(id) on delete cascade,
  court_id        uuid not null references public.courts(id) on delete cascade,
  installed_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),

  constraint installation_courts_uk unique (installation_id, court_id)
);

create index installation_courts_court_idx on public.installation_courts (court_id);

-- ---------------------------------------------------------------------
-- FK diferida instalacion -> documento de acta
-- (documents se crea en 016; la FK se agrega alli)
-- ---------------------------------------------------------------------
