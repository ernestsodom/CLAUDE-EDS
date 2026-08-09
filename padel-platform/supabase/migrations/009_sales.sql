-- =====================================================================
-- 009_sales.sql
-- Ventas: eje economico del negocio (sale_id).
--
-- DECISION DE ARQUITECTURA
-- ------------------------
-- `sales` almacena SOLO los importes de la venta (subtotal/descuento/
-- impuesto/total), derivados de sale_items mediante trigger porque se
-- consultan y ordenan constantemente.
-- Los COSTOS y MARGENES **no se duplican** en la tabla: se derivan en
-- la vista v_sale_financials (034_views). Cuando se necesita congelar un
-- margen (cierre de mes, comite) se escribe explicitamente en
-- sale_margin_snapshots.
-- =====================================================================

create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete restrict,
  client_id           uuid not null references public.clients(id) on delete restrict,
  opportunity_id      uuid references public.opportunities(id) on delete set null,
  salesperson_id      uuid references public.profiles(id) on delete set null,
  sale_number         text not null,
  sale_date           date not null default current_date,
  status              sale_status not null default 'BORRADOR',
  currency            currency_code not null default 'EUR',
  exchange_rate       numeric(18,8),                 -- a la moneda de reporte, si aplica
  subtotal            numeric(14,2) not null default 0,
  discount            numeric(14,2) not null default 0,
  tax_rate            numeric(5,2)  not null default 0,
  tax                 numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  delivery_date       date,
  confirmed_at        timestamptz,
  closed_at           timestamptz,
  payment_terms       text,
  incoterm            text,
  delivery_address    text,
  delivery_country    text,
  delivery_city       text,
  notes               text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint sales_number_uk       unique (project_id, sale_number),
  constraint sales_amounts_ck      check (subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0),
  constraint sales_discount_ck     check (discount <= subtotal),
  constraint sales_tax_rate_ck     check (tax_rate between 0 and 100),
  constraint sales_confirmed_ck    check (
    status not in ('CONFIRMADA','EN_PRODUCCION','PARCIALMENTE_ENTREGADA','ENTREGADA','CERRADA')
    or confirmed_at is not null
  )
);

comment on table public.sales is
  'Venta = eje economico. Todo (canchas, fabricacion, costos, logistica, facturas, pagos) se ancla a sale_id.';

create index sales_project_idx        on public.sales (project_id) where deleted_at is null;
create index sales_project_status_idx on public.sales (project_id, status) where deleted_at is null;
create index sales_client_idx         on public.sales (client_id) where deleted_at is null;
create index sales_opportunity_idx    on public.sales (opportunity_id) where deleted_at is null;
create index sales_salesperson_idx    on public.sales (salesperson_id) where deleted_at is null;
create index sales_date_idx           on public.sales (project_id, sale_date desc) where deleted_at is null;
create index sales_delivery_idx       on public.sales (delivery_date)
  where deleted_at is null and status not in ('ENTREGADA','CERRADA','ANULADA');
create index sales_number_trgm_idx    on public.sales using gin (sale_number gin_trgm_ops);

select app.attach_updated_at('public.sales');

-- Numeracion automatica: EU-2026-0014
create or replace function app.tg_sales_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.sale_number is null or btrim(new.sale_number) = '' then
    new.sale_number := app.next_document_number(
      new.project_id, 'SALE', null, extract(year from new.sale_date)::integer
    );
  end if;
  return new;
end;
$$;

create trigger sales_set_number
  before insert on public.sales
  for each row execute function app.tg_sales_number();

-- ---------------------------------------------------------------------
-- Lineas de venta
-- ---------------------------------------------------------------------
create table public.sale_items (
  id                    uuid primary key default gen_random_uuid(),
  sale_id               uuid not null references public.sales(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete restrict,
  product_type          sale_item_type not null,
  description           text not null,
  model                 text,
  quantity              numeric(12,3) not null default 1,
  unit_price            numeric(14,2) not null default 0,
  discount              numeric(14,2) not null default 0,
  subtotal              numeric(14,2) generated always as
                          (round(quantity * unit_price - discount, 2)) stored,
  estimated_unit_cost   numeric(14,2) not null default 0,
  estimated_total_cost  numeric(14,2) generated always as
                          (round(quantity * estimated_unit_cost, 2)) stored,
  sort_order            integer not null default 100,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint sale_items_quantity_ck check (quantity > 0),
  constraint sale_items_price_ck    check (unit_price >= 0 and discount >= 0),
  constraint sale_items_discount_ck check (discount <= quantity * unit_price),
  constraint sale_items_cost_ck     check (estimated_unit_cost >= 0)
);

create index sale_items_sale_idx    on public.sale_items (sale_id);
create index sale_items_project_idx on public.sale_items (project_id);

select app.attach_updated_at('public.sale_items');

-- Recalculo de cabecera a partir de las lineas
create or replace function app.recalculate_sale_totals(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_tax_rate numeric(5,2);
begin
  select coalesce(sum(round(si.quantity * si.unit_price, 2)), 0),
         coalesce(sum(si.discount), 0)
    into v_subtotal, v_discount
    from public.sale_items si
   where si.sale_id = p_sale_id;

  select tax_rate into v_tax_rate from public.sales where id = p_sale_id;

  update public.sales s
     set subtotal   = v_subtotal,
         discount   = v_discount,
         tax        = public.money_round((v_subtotal - v_discount) * coalesce(v_tax_rate, 0) / 100),
         total      = public.money_round((v_subtotal - v_discount)
                                * (1 + coalesce(v_tax_rate, 0) / 100)),
         updated_at = now()
   where s.id = p_sale_id
     and exists (select 1 from public.sale_items where sale_id = p_sale_id);
end;
$$;

create or replace function app.tg_sale_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  perform app.recalculate_sale_totals(coalesce(new.sale_id, old.sale_id));
  return coalesce(new, old);
end;
$$;

create trigger sale_items_recalc
  after insert or update or delete on public.sale_items
  for each row execute function app.tg_sale_items_recalc();

-- Recalcular tambien si cambia el tax_rate de la cabecera
create or replace function app.tg_sales_tax_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.tax_rate is distinct from old.tax_rate then
    perform app.recalculate_sale_totals(new.id);
  end if;
  return null;
end;
$$;

create trigger sales_tax_recalc
  after update of tax_rate on public.sales
  for each row execute function app.tg_sales_tax_recalc();

-- ---------------------------------------------------------------------
-- Categorias de costo (catalogo administrable por ADMIN)
-- ---------------------------------------------------------------------
create table public.cost_categories (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade, -- null = global
  code          text not null,
  name          text not null,
  parent_id     uuid references public.cost_categories(id) on delete set null,
  cost_group    text not null,   -- FABRICACION | LOGISTICA | INSTALACION | COMERCIAL | OTROS
  sort_order    integer not null default 100,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index cost_categories_global_code_uk
  on public.cost_categories (code) where project_id is null;
create unique index cost_categories_project_code_uk
  on public.cost_categories (project_id, code) where project_id is not null;

select app.attach_updated_at('public.cost_categories');

insert into public.cost_categories (code, name, cost_group, sort_order) values
  ('FABRICACION',   'Fabricacion',            'FABRICACION', 10),
  ('MATERIALES',    'Materiales',             'FABRICACION', 11),
  ('FIERRO',        'Fierro / Acero',         'FABRICACION', 12),
  ('GALVANIZADO',   'Galvanizado',            'FABRICACION', 13),
  ('VIDRIOS',       'Vidrios',                'FABRICACION', 14),
  ('ESTRUCTURA',    'Estructura',             'FABRICACION', 15),
  ('TORNILLERIA',   'Tornilleria',            'FABRICACION', 16),
  ('ACCESORIOS',    'Accesorios',             'FABRICACION', 17),
  ('CESPED',        'Cesped artificial',      'FABRICACION', 18),
  ('ILUMINACION',   'Iluminacion',            'FABRICACION', 19),
  ('LOGISTICA',     'Logistica',              'LOGISTICA',   20),
  ('TRANSPORTE',    'Transporte terrestre',   'LOGISTICA',   21),
  ('CONTENEDOR',    'Contenedor / Flete',     'LOGISTICA',   22),
  ('ADUANA',        'Aduana y aranceles',     'LOGISTICA',   23),
  ('SEGURO',        'Seguro de carga',        'LOGISTICA',   24),
  ('ALMACENAJE',    'Almacenaje',             'LOGISTICA',   25),
  ('INSTALACION',   'Instalacion',            'INSTALACION', 30),
  ('MANO_OBRA',     'Mano de obra',           'INSTALACION', 31),
  ('ALOJAMIENTO',   'Alojamiento',            'INSTALACION', 32),
  ('TRASLADOS',     'Traslados',              'INSTALACION', 33),
  ('DESMONTAJE',    'Desmontaje',             'INSTALACION', 34),
  ('REPARACION',    'Reparacion / Refurbish', 'INSTALACION', 35),
  ('COMISIONES',    'Comisiones comerciales', 'COMERCIAL',   40),
  ('VIAJES',        'Viajes comerciales',     'COMERCIAL',   41),
  ('MARKETING',     'Marketing',              'COMERCIAL',   42),
  ('OTROS',         'Otros costos',           'OTROS',       90);

-- ---------------------------------------------------------------------
-- Costos de la venta (presupuesto vs real)
-- ---------------------------------------------------------------------
create table public.sale_costs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  sale_id           uuid not null references public.sales(id) on delete cascade,
  cost_category_id  uuid not null references public.cost_categories(id) on delete restrict,
  court_id          uuid,   -- FK diferida a courts (010): costo imputable a una cancha
  description       text,
  estimated_amount  numeric(14,2) not null default 0,
  actual_amount     numeric(14,2) not null default 0,
  currency          currency_code not null default 'EUR',
  supplier_id       uuid,   -- FK diferida a suppliers (011)
  invoice_id        uuid,   -- FK diferida a invoices (013)
  purchase_order_id uuid,   -- FK diferida a purchase_orders (012)
  expense_id        uuid,   -- FK diferida a expenses (013)
  cost_date         date,
  status            cost_status not null default 'ESTIMADO',
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint sale_costs_amounts_ck check (estimated_amount >= 0 and actual_amount >= 0)
);

comment on table public.sale_costs is
  'Presupuesto (estimated_amount) vs realidad (actual_amount) por categoria y venta.';

create index sale_costs_sale_idx     on public.sale_costs (sale_id) where deleted_at is null;
create index sale_costs_project_idx  on public.sale_costs (project_id) where deleted_at is null;
create index sale_costs_category_idx on public.sale_costs (cost_category_id);
create index sale_costs_court_idx    on public.sale_costs (court_id) where court_id is not null;
create index sale_costs_supplier_idx on public.sale_costs (supplier_id) where supplier_id is not null;

select app.attach_updated_at('public.sale_costs');

-- ---------------------------------------------------------------------
-- Snapshots explicitos de margen (historico congelado)
-- ---------------------------------------------------------------------
create table public.sale_margin_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null references public.projects(id) on delete cascade,
  sale_id                     uuid not null references public.sales(id) on delete cascade,
  snapshot_date               date not null default current_date,
  reason                      text,
  currency                    currency_code not null,
  total_sale                  numeric(14,2) not null,
  estimated_cost              numeric(14,2) not null,
  actual_cost                 numeric(14,2) not null,
  estimated_margin            numeric(14,2) not null,
  actual_margin               numeric(14,2) not null,
  estimated_margin_percentage numeric(7,2),
  actual_margin_percentage    numeric(7,2),
  created_by                  uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),

  constraint sale_margin_snapshots_uk unique (sale_id, snapshot_date, reason)
);

create index sale_margin_snapshots_sale_idx on public.sale_margin_snapshots (sale_id, snapshot_date desc);
