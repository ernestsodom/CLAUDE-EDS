-- =====================================================================
-- 011_materials_suppliers.sql
-- Materiales, requerimientos, compras de material y proveedores.
-- =====================================================================

create table public.materials (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade, -- null = catalogo global
  code            text not null,
  name            text not null,
  category        text,
  unit            text not null default 'UN',      -- UN | KG | M | M2 | L
  standard_cost   numeric(14,4) not null default 0,
  currency        currency_code not null default 'EUR',
  stock_quantity  numeric(14,3) not null default 0,
  min_stock       numeric(14,3) not null default 0,
  lead_time_days  integer not null default 0,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint materials_amounts_ck check (
    standard_cost >= 0 and stock_quantity >= 0 and min_stock >= 0 and lead_time_days >= 0
  )
);

create unique index materials_global_code_uk  on public.materials (code) where project_id is null;
create unique index materials_project_code_uk on public.materials (project_id, code) where project_id is not null;
create index materials_name_trgm_idx on public.materials using gin (name gin_trgm_ops);

select app.attach_updated_at('public.materials');

-- ---------------------------------------------------------------------
-- Requerimiento de material por proyecto de fabricacion
-- missing = required - available - purchased   (nunca negativo)
-- ---------------------------------------------------------------------
create table public.material_requirements (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete restrict,
  manufacturing_project_id  uuid not null references public.manufacturing_projects(id) on delete cascade,
  sale_id                   uuid references public.sales(id) on delete set null,
  court_id                  uuid references public.courts(id) on delete set null,
  material_id               uuid not null references public.materials(id) on delete restrict,
  quantity_required         numeric(14,3) not null default 0,
  quantity_available        numeric(14,3) not null default 0,
  quantity_purchased        numeric(14,3) not null default 0,
  quantity_missing          numeric(14,3) generated always as (
                              greatest(quantity_required - quantity_available - quantity_purchased, 0)
                            ) stored,
  needed_by_date            date,
  estimated_unit_cost       numeric(14,4) not null default 0,
  currency                  currency_code not null default 'EUR',
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint material_requirements_qty_ck check (
    quantity_required >= 0 and quantity_available >= 0 and quantity_purchased >= 0
  )
);

-- Un requerimiento por (fabricacion, material, cancha). NULL en court_id se
-- normaliza para que el indice unico funcione tambien a nivel proyecto.
create unique index material_requirements_uk
  on public.material_requirements (
    manufacturing_project_id, material_id, coalesce(court_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index material_requirements_mp_idx      on public.material_requirements (manufacturing_project_id);
create index material_requirements_project_idx on public.material_requirements (project_id);
create index material_requirements_missing_idx on public.material_requirements (project_id, needed_by_date)
  where quantity_missing > 0;

select app.attach_updated_at('public.material_requirements');

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete restrict,
  company_name   text not null,
  tax_id         text,
  country        text,
  city           text,
  address        text,
  contact_name   text,
  email          citext,
  phone          text,
  category       text,                    -- FIERRO | GALVANIZADO | VIDRIO | LOGISTICA | ...
  currency       currency_code not null default 'EUR',
  payment_terms  text,
  rating         integer,
  status         supplier_status not null default 'ACTIVO',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint suppliers_rating_ck check (rating is null or rating between 1 and 5)
);

create unique index suppliers_project_tax_uk on public.suppliers (project_id, lower(tax_id))
  where tax_id is not null and deleted_at is null;
create index suppliers_project_idx on public.suppliers (project_id) where deleted_at is null;
create index suppliers_name_trgm_idx on public.suppliers using gin (company_name gin_trgm_ops);

select app.attach_updated_at('public.suppliers');

alter table public.sale_costs
  add constraint sale_costs_supplier_fk
  foreign key (supplier_id) references public.suppliers(id) on delete set null;

-- ---------------------------------------------------------------------
-- Cotizaciones de proveedor
-- ---------------------------------------------------------------------
create table public.supplier_quotes (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete restrict,
  supplier_id               uuid not null references public.suppliers(id) on delete restrict,
  manufacturing_project_id  uuid references public.manufacturing_projects(id) on delete set null,
  sale_id                   uuid references public.sales(id) on delete set null,
  quote_number              text,
  quote_date                date not null default current_date,
  valid_until               date,
  currency                  currency_code not null default 'EUR',
  subtotal                  numeric(14,2) not null default 0,
  tax                       numeric(14,2) not null default 0,
  total                     numeric(14,2) not null default 0,
  lead_time_days            integer,
  status                    quote_status not null default 'SOLICITADA',
  notes                     text,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint supplier_quotes_amounts_ck check (subtotal >= 0 and tax >= 0 and total >= 0)
);

create index supplier_quotes_project_idx  on public.supplier_quotes (project_id) where deleted_at is null;
create index supplier_quotes_supplier_idx on public.supplier_quotes (supplier_id) where deleted_at is null;
create index supplier_quotes_mp_idx       on public.supplier_quotes (manufacturing_project_id);

select app.attach_updated_at('public.supplier_quotes');

create table public.supplier_quote_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  supplier_quote_id uuid not null references public.supplier_quotes(id) on delete cascade,
  material_id       uuid references public.materials(id) on delete set null,
  description       text not null,
  quantity          numeric(14,3) not null default 1,
  unit              text not null default 'UN',
  unit_price        numeric(14,4) not null default 0,
  subtotal          numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint supplier_quote_items_ck check (quantity > 0 and unit_price >= 0)
);

create index supplier_quote_items_quote_idx on public.supplier_quote_items (supplier_quote_id);

select app.attach_updated_at('public.supplier_quote_items');
