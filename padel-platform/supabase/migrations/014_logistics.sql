-- =====================================================================
-- 014_logistics.sql
-- Embarques internacionales y su contenido (canchas).
-- =====================================================================

create table public.shipments (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete restrict,
  sale_id             uuid references public.sales(id) on delete set null,
  client_id           uuid references public.clients(id) on delete set null,
  shipment_number     text not null,
  transport_mode      transport_mode not null default 'MARITIMO',
  origin              text,
  origin_country      text,
  destination         text,
  destination_country text,
  carrier             text,
  forwarder           text,
  container_number    text,
  container_type      text,               -- 40HC, 20DV, ...
  booking_number      text,
  bl_number           text,
  incoterm            text,
  departure_date      date,
  estimated_arrival   date,
  actual_arrival      date,
  customs_status      customs_status not null default 'NO_APLICA',
  customs_cleared_at  date,
  status              shipment_status not null default 'PLANIFICADO',
  freight_cost        numeric(14,2),
  insurance_cost      numeric(14,2),
  customs_cost        numeric(14,2),
  currency            currency_code not null default 'EUR',
  notes               text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint shipments_number_uk unique (project_id, shipment_number),
  constraint shipments_dates_ck  check (
    estimated_arrival is null or departure_date is null or estimated_arrival >= departure_date
  ),
  constraint shipments_costs_ck check (
    coalesce(freight_cost,0) >= 0 and coalesce(insurance_cost,0) >= 0 and coalesce(customs_cost,0) >= 0
  )
);

create index shipments_project_status_idx on public.shipments (project_id, status) where deleted_at is null;
create index shipments_sale_idx           on public.shipments (sale_id) where deleted_at is null;
create index shipments_arrival_idx        on public.shipments (estimated_arrival)
  where deleted_at is null and status not in ('ENTREGADO','CANCELADO');
create index shipments_departure_idx      on public.shipments (project_id, departure_date) where deleted_at is null;

select app.attach_updated_at('public.shipments');

create or replace function app.tg_shipment_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.shipment_number is null or btrim(new.shipment_number) = '' then
    new.shipment_number := 'SH-' || app.next_document_number(new.project_id, 'SHIPMENT');
  end if;
  return new;
end;
$$;

create trigger shipments_set_number
  before insert on public.shipments
  for each row execute function app.tg_shipment_number();

-- ---------------------------------------------------------------------
create table public.shipment_items (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete restrict,
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  court_id      uuid references public.courts(id) on delete set null,
  description   text,
  packages      integer,
  gross_weight_kg numeric(12,2),
  volume_m3     numeric(12,3),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint shipment_items_ck check (
    coalesce(packages,0) >= 0 and coalesce(gross_weight_kg,0) >= 0 and coalesce(volume_m3,0) >= 0
  )
);

create unique index shipment_items_court_uk on public.shipment_items (shipment_id, court_id)
  where court_id is not null;
create index shipment_items_shipment_idx on public.shipment_items (shipment_id);
create index shipment_items_court_idx    on public.shipment_items (court_id);

select app.attach_updated_at('public.shipment_items');
