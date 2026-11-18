-- PAROCK ERP · esquema MVP
-- Cada registro: ID estable, fechas de creación/modificación, usuario responsable y estado.

create table if not exists users (
  id text primary key,
  name text not null,
  role text not null,
  fin boolean not null default false,
  admin boolean not null default false,
  img text,
  pass_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id text primary key,
  name text not null,
  rut text not null unique,
  com text not null,
  term int not null default 30,
  cds text[] not null default '{}',
  stage text not null default 'prospecto',
  owner text references users(id),
  contact text, phone text, mail text,
  price_mode text not null default 'regular' check (price_mode in ('regular','especial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  sku text primary key,
  name text not null, brand text not null, cat text not null,
  ean text, dun text, grams text,
  ucj int, cjp int,
  cost int not null, price int not null,
  img text, lead_days int, moq int, mult int, ss int, supplier text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lista de precios diferenciada por cliente (historial: nunca se sobrescribe)
create table if not exists client_prices (
  id serial primary key,
  client_id text not null references clients(id),
  sku text not null references products(sku),
  price int not null check (price > 0),
  valid_from date not null default current_date,
  created_by text references users(id),
  created_at timestamptz not null default now()
);
create index if not exists client_prices_idx on client_prices(client_id, sku, valid_from desc, id desc);

create table if not exists purchase_orders (
  id serial primary key,
  number text not null,
  client_id text not null references clients(id),
  issued date not null, requested date, cd text,
  status text not null default 'pendiente validación',
  ai boolean not null default false,
  reason text,
  created_by text references users(id),
  approved_by text references users(id), approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, number)
);

create table if not exists po_lines (
  po_id int not null references purchase_orders(id) on delete cascade,
  line int not null,
  sku text not null references products(sku),
  qty int not null check (qty > 0),
  price int not null,
  accepted int,
  primary key (po_id, line)
);

create table if not exists dispatches (
  id text primary key,
  po_number text not null,
  client_id text not null references clients(id),
  shipped date, delivered date, committed date,
  requested int not null, dispatched int not null default 0, accepted int not null default 0,
  reason text, status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id serial primary key,
  folio int not null, dte int not null, issuer_rut text not null default '77.000.000-0',
  client_id text not null references clients(id),
  issued date not null, due date,
  net bigint not null, iva bigint not null, total bigint not null,
  ref_folio int,
  po_numbers text[] not null default '{}', dispatch_ids text[] not null default '{}',
  created_by text references users(id),
  created_at timestamptz not null default now(),
  unique (folio, dte, issuer_rut)
);

create table if not exists payments (
  id serial primary key,
  invoice_id int not null references invoices(id),
  paid_at date not null, amount bigint not null check (amount > 0),
  method text, created_by text references users(id),
  created_at timestamptz not null default now()
);

-- Documentos de compra/gasto con IVA (crédito fiscal)
create table if not exists purchases (
  id serial primary key,
  supplier text not null, supplier_rut text,
  folio int, dte int not null default 33,
  issued date not null, due date,
  category text not null,
  net bigint not null, iva bigint not null, total bigint not null,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists stock (
  sku text primary key references products(sku),
  assigned int not null, reserved int not null,
  transit int not null default 0, eta date,
  plan jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists stock_loads (
  load_no serial primary key,
  cutoff timestamptz not null,
  file_name text, status text not null,
  rows jsonb not null default '[]',
  created_by text references users(id),
  created_at timestamptz not null default now()
);

create table if not exists forecast_versions (
  version text primary key,
  status text not null default 'borrador',
  frozen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists forecast_lines (
  version text not null references forecast_versions(version),
  client_id text not null references clients(id),
  sku text not null references products(sku),
  m int[] not null,
  updated_at timestamptz not null default now(),
  primary key (version, client_id, sku)
);

create table if not exists sales_monthly (
  month date not null,
  client_id text not null references clients(id),
  net bigint not null, cost bigint not null,
  primary key (month, client_id)
);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id text,
  record text not null,
  detail text not null
);
-- Bitácora inalterable: bloquear UPDATE y DELETE
create or replace function audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log es inalterable'; end $$;
drop trigger if exists audit_no_change on audit_log;
create trigger audit_no_change before update or delete on audit_log
  for each row execute function audit_immutable();

create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
