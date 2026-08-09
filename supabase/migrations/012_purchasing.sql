-- =====================================================================
-- 012_purchasing.sql
-- Ordenes de compra y recepciones.
-- =====================================================================

create table public.purchase_orders (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete restrict,
  supplier_id               uuid not null references public.suppliers(id) on delete restrict,
  supplier_quote_id         uuid references public.supplier_quotes(id) on delete set null,
  manufacturing_project_id  uuid references public.manufacturing_projects(id) on delete set null,
  sale_id                   uuid references public.sales(id) on delete set null,
  po_number                 text not null,
  order_date                date not null default current_date,
  expected_delivery_date    date,
  actual_delivery_date      date,
  status                    purchase_order_status not null default 'BORRADOR',
  currency                  currency_code not null default 'EUR',
  subtotal                  numeric(14,2) not null default 0,
  tax_rate                  numeric(5,2)  not null default 0,
  tax                       numeric(14,2) not null default 0,
  total                     numeric(14,2) not null default 0,
  delivery_address          text,
  payment_terms             text,
  notes                     text,
  approved_by               uuid references public.profiles(id) on delete set null,
  approved_at               timestamptz,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint purchase_orders_number_uk  unique (project_id, po_number),
  constraint purchase_orders_amounts_ck check (subtotal >= 0 and tax >= 0 and total >= 0),
  constraint purchase_orders_approved_ck check (
    status not in ('APROBADA','RECIBIDA','FACTURADA','PAGADA') or approved_at is not null
  )
);

create index purchase_orders_project_status_idx on public.purchase_orders (project_id, status) where deleted_at is null;
create index purchase_orders_supplier_idx       on public.purchase_orders (supplier_id) where deleted_at is null;
create index purchase_orders_sale_idx           on public.purchase_orders (sale_id) where deleted_at is null;
create index purchase_orders_mp_idx             on public.purchase_orders (manufacturing_project_id);

select app.attach_updated_at('public.purchase_orders');

create or replace function app.tg_po_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.po_number is null or btrim(new.po_number) = '' then
    new.po_number := 'OC-' || app.next_document_number(
      new.project_id, 'PO', null, extract(year from new.order_date)::integer
    );
  end if;
  return new;
end;
$$;

create trigger purchase_orders_set_number
  before insert on public.purchase_orders
  for each row execute function app.tg_po_number();

-- ---------------------------------------------------------------------
create table public.purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete restrict,
  purchase_order_id   uuid not null references public.purchase_orders(id) on delete cascade,
  material_id         uuid references public.materials(id) on delete set null,
  cost_category_id    uuid references public.cost_categories(id) on delete set null,
  description         text not null,
  quantity            numeric(14,3) not null default 1,
  unit                text not null default 'UN',
  unit_price          numeric(14,4) not null default 0,
  subtotal            numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  quantity_received   numeric(14,3) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint purchase_order_items_ck check (
    quantity > 0 and unit_price >= 0 and quantity_received >= 0 and quantity_received <= quantity
  )
);

create index purchase_order_items_po_idx       on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_material_idx on public.purchase_order_items (material_id);

select app.attach_updated_at('public.purchase_order_items');

-- Recalculo de totales de la OC
create or replace function app.recalculate_po_totals(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_subtotal numeric(14,2);
  v_tax_rate numeric(5,2);
begin
  select coalesce(sum(subtotal), 0) into v_subtotal
    from public.purchase_order_items where purchase_order_id = p_po_id;

  select tax_rate into v_tax_rate from public.purchase_orders where id = p_po_id;

  update public.purchase_orders
     set subtotal = v_subtotal,
         tax      = public.money_round(v_subtotal * coalesce(v_tax_rate,0) / 100),
         total    = public.money_round(v_subtotal * (1 + coalesce(v_tax_rate,0) / 100)),
         updated_at = now()
   where id = p_po_id;
end;
$$;

create or replace function app.tg_po_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  perform app.recalculate_po_totals(coalesce(new.purchase_order_id, old.purchase_order_id));
  return coalesce(new, old);
end;
$$;

create trigger purchase_order_items_recalc
  after insert or update or delete on public.purchase_order_items
  for each row execute function app.tg_po_items_recalc();

alter table public.sale_costs
  add constraint sale_costs_po_fk
  foreign key (purchase_order_id) references public.purchase_orders(id) on delete set null;

-- ---------------------------------------------------------------------
-- Compras de material imputadas a un requerimiento (trazabilidad de stock)
-- ---------------------------------------------------------------------
create table public.material_purchases (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects(id) on delete restrict,
  material_requirement_id  uuid references public.material_requirements(id) on delete set null,
  purchase_order_item_id   uuid references public.purchase_order_items(id) on delete set null,
  material_id              uuid not null references public.materials(id) on delete restrict,
  supplier_id              uuid references public.suppliers(id) on delete set null,
  quantity                 numeric(14,3) not null,
  unit_cost                numeric(14,4) not null default 0,
  total_cost               numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  currency                 currency_code not null default 'EUR',
  purchase_date            date not null default current_date,
  received_at              timestamptz,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint material_purchases_ck check (quantity > 0 and unit_cost >= 0)
);

create index material_purchases_requirement_idx on public.material_purchases (material_requirement_id);
create index material_purchases_project_idx     on public.material_purchases (project_id, purchase_date desc);

select app.attach_updated_at('public.material_purchases');

-- Al registrar una compra recibida, actualizar quantity_purchased del requerimiento
create or replace function app.tg_material_purchase_sync()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_req uuid := coalesce(new.material_requirement_id, old.material_requirement_id);
begin
  if v_req is not null then
    update public.material_requirements mr
       set quantity_purchased = coalesce((
             select sum(mp.quantity) from public.material_purchases mp
              where mp.material_requirement_id = v_req
           ), 0),
           updated_at = now()
     where mr.id = v_req;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger material_purchases_sync
  after insert or update or delete on public.material_purchases
  for each row execute function app.tg_material_purchase_sync();
