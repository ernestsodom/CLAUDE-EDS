-- =====================================================================
-- 013_finance.sql
-- Contratos, facturas (venta y compra), pagos, gastos, bancos y
-- tipos de cambio.
--
-- REGLA MONETARIA
-- ---------------
-- Todo importe se guarda como numeric(14,2) + currency_code.
-- NUNCA se convierte moneda de forma implicita: la conversion requiere
-- una fila en exchange_rates (tasa, fecha, fuente).
-- =====================================================================

create table public.exchange_rates (
  id             uuid primary key default gen_random_uuid(),
  base_currency  currency_code not null,
  quote_currency currency_code not null,
  rate           numeric(18,8) not null,
  rate_date      date not null,
  source         text not null default 'MANUAL',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),

  constraint exchange_rates_uk        unique (base_currency, quote_currency, rate_date, source),
  constraint exchange_rates_rate_ck   check (rate > 0),
  constraint exchange_rates_differ_ck check (base_currency <> quote_currency)
);

create index exchange_rates_lookup_idx on public.exchange_rates (base_currency, quote_currency, rate_date desc);

-- Conversion explicita: devuelve NULL si no existe tasa (nunca inventa una).
create or replace function public.convert_amount(
  p_amount numeric,
  p_from currency_code,
  p_to currency_code,
  p_date date default current_date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_rate numeric(18,8);
begin
  if p_amount is null then return null; end if;
  if p_from = p_to then return public.money_round(p_amount); end if;

  select rate into v_rate
    from public.exchange_rates
   where base_currency = p_from and quote_currency = p_to and rate_date <= p_date
   order by rate_date desc limit 1;

  if v_rate is null then
    -- intento inverso
    select 1 / rate into v_rate
      from public.exchange_rates
     where base_currency = p_to and quote_currency = p_from and rate_date <= p_date
     order by rate_date desc limit 1;
  end if;

  if v_rate is null then return null; end if;
  return public.money_round(p_amount * v_rate);
end;
$$;

grant execute on function public.convert_amount(numeric, currency_code, currency_code, date) to authenticated;

-- ---------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------
create table public.contracts (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  client_id         uuid references public.clients(id) on delete restrict,
  sale_id           uuid references public.sales(id) on delete set null,
  contract_number   text not null,
  title             text not null,
  contract_date     date not null default current_date,
  start_date        date,
  end_date          date,
  amount            numeric(14,2) not null default 0,
  currency          currency_code not null default 'EUR',
  payment_terms     text,
  warranty_terms    text,
  penalty_terms     text,
  status            contract_status not null default 'BORRADOR',
  signed_at         timestamptz,
  signed_by_client  text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint contracts_number_uk unique (project_id, contract_number),
  constraint contracts_amount_ck check (amount >= 0),
  constraint contracts_dates_ck  check (end_date is null or start_date is null or end_date >= start_date)
);

create index contracts_project_status_idx on public.contracts (project_id, status) where deleted_at is null;
create index contracts_sale_idx           on public.contracts (sale_id) where deleted_at is null;
create index contracts_expiry_idx         on public.contracts (end_date)
  where deleted_at is null and status in ('FIRMADO','VIGENTE');

select app.attach_updated_at('public.contracts');

-- ---------------------------------------------------------------------
-- Facturas (venta y compra en una sola tabla, discriminadas por kind)
-- ---------------------------------------------------------------------
create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete restrict,
  kind                invoice_kind not null,
  invoice_number      text not null,
  external_number     text,                       -- numero del proveedor
  invoice_date        date not null default current_date,
  due_date            date,
  status              invoice_status not null default 'BORRADOR',
  currency            currency_code not null default 'EUR',
  subtotal            numeric(14,2) not null default 0,
  tax_rate            numeric(5,2)  not null default 0,
  tax                 numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  -- paid_amount se mantiene por trigger desde payments (unica fuente: pagos)
  paid_amount         numeric(14,2) not null default 0,
  balance             numeric(14,2) generated always as (round(total - paid_amount, 2)) stored,
  -- Relaciones VENTA
  client_id           uuid references public.clients(id) on delete restrict,
  sale_id             uuid references public.sales(id) on delete set null,
  contract_id         uuid references public.contracts(id) on delete set null,
  -- Relaciones COMPRA
  supplier_id         uuid references public.suppliers(id) on delete restrict,
  purchase_order_id   uuid references public.purchase_orders(id) on delete set null,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint invoices_number_uk  unique (project_id, kind, invoice_number),
  constraint invoices_amounts_ck check (subtotal >= 0 and tax >= 0 and total >= 0 and paid_amount >= 0),
  constraint invoices_paid_ck    check (paid_amount <= total + 0.01),
  constraint invoices_party_ck   check (
    (kind = 'VENTA'  and client_id   is not null and supplier_id is null) or
    (kind = 'COMPRA' and supplier_id is not null and client_id   is null)
  )
);

comment on column public.invoices.balance is 'Saldo pendiente = total - paid_amount (columna generada).';

create index invoices_project_kind_status_idx on public.invoices (project_id, kind, status) where deleted_at is null;
create index invoices_client_idx   on public.invoices (client_id) where deleted_at is null;
create index invoices_supplier_idx on public.invoices (supplier_id) where deleted_at is null;
create index invoices_sale_idx     on public.invoices (sale_id) where deleted_at is null;
create index invoices_due_idx      on public.invoices (due_date)
  where deleted_at is null and status not in ('PAGADA','ANULADA','BORRADOR');
create index invoices_overdue_idx  on public.invoices (project_id, kind, due_date)
  where deleted_at is null and status in ('EMITIDA','ENVIADA','PARCIALMENTE_PAGADA','VENCIDA');

select app.attach_updated_at('public.invoices');

create or replace function app.tg_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := case when new.kind = 'VENTA' then 'FV-' else 'FC-' end
      || app.next_document_number(
           new.project_id,
           'INVOICE_' || new.kind::text,
           null,
           extract(year from new.invoice_date)::integer
         );
  end if;
  return new;
end;
$$;

create trigger invoices_set_number
  before insert on public.invoices
  for each row execute function app.tg_invoice_number();

create table public.invoice_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  invoice_id        uuid not null references public.invoices(id) on delete cascade,
  sale_item_id      uuid references public.sale_items(id) on delete set null,
  cost_category_id  uuid references public.cost_categories(id) on delete set null,
  description       text not null,
  quantity          numeric(14,3) not null default 1,
  unit_price        numeric(14,4) not null default 0,
  discount          numeric(14,2) not null default 0,
  subtotal          numeric(14,2) generated always as
                      (round(quantity * unit_price - discount, 2)) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint invoice_items_ck check (quantity > 0 and unit_price >= 0 and discount >= 0)
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

select app.attach_updated_at('public.invoice_items');

create or replace function app.recalculate_invoice_totals(p_invoice_id uuid)
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
    from public.invoice_items where invoice_id = p_invoice_id;

  select tax_rate into v_tax_rate from public.invoices where id = p_invoice_id;

  update public.invoices
     set subtotal = v_subtotal,
         tax      = public.money_round(v_subtotal * coalesce(v_tax_rate,0) / 100),
         total    = public.money_round(v_subtotal * (1 + coalesce(v_tax_rate,0) / 100)),
         updated_at = now()
   where id = p_invoice_id
     and exists (select 1 from public.invoice_items where invoice_id = p_invoice_id);
end;
$$;

create or replace function app.tg_invoice_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  perform app.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

create trigger invoice_items_recalc
  after insert or update or delete on public.invoice_items
  for each row execute function app.tg_invoice_items_recalc();

alter table public.sale_costs
  add constraint sale_costs_invoice_fk
  foreign key (invoice_id) references public.invoices(id) on delete set null;

-- ---------------------------------------------------------------------
-- Bancos
-- ---------------------------------------------------------------------
create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete restrict,
  name            text not null,
  bank_name       text,
  account_number  text,
  iban            text,
  swift           text,
  currency        currency_code not null default 'EUR',
  opening_balance numeric(14,2) not null default 0,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index bank_accounts_project_idx on public.bank_accounts (project_id) where deleted_at is null;

select app.attach_updated_at('public.bank_accounts');

-- ---------------------------------------------------------------------
-- Pagos (cobros y pagos)
-- ---------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  direction         payment_direction not null,
  payment_date      date not null default current_date,
  amount            numeric(14,2) not null,
  currency          currency_code not null default 'EUR',
  exchange_rate     numeric(18,8),
  method            payment_method not null default 'TRANSFERENCIA',
  reference         text,
  invoice_id        uuid references public.invoices(id) on delete set null,
  sale_id           uuid references public.sales(id) on delete set null,
  client_id         uuid references public.clients(id) on delete set null,
  supplier_id       uuid references public.suppliers(id) on delete set null,
  bank_account_id   uuid references public.bank_accounts(id) on delete set null,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint payments_amount_ck check (amount > 0)
);

create index payments_project_date_idx on public.payments (project_id, payment_date desc) where deleted_at is null;
create index payments_invoice_idx      on public.payments (invoice_id) where deleted_at is null;
create index payments_sale_idx         on public.payments (sale_id) where deleted_at is null;
create index payments_client_idx       on public.payments (client_id) where deleted_at is null;
create index payments_supplier_idx     on public.payments (supplier_id) where deleted_at is null;

select app.attach_updated_at('public.payments');

-- Sincroniza invoices.paid_amount y el estado de la factura.
create or replace function app.recalculate_invoice_payments(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_paid  numeric(14,2);
  v_total numeric(14,2);
  v_due   date;
  v_status invoice_status;
begin
  if p_invoice_id is null then return; end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
   where p.invoice_id = p_invoice_id and p.deleted_at is null;

  select total, due_date, status into v_total, v_due, v_status
    from public.invoices where id = p_invoice_id;

  if v_status in ('BORRADOR','ANULADA') then
    update public.invoices set paid_amount = v_paid, updated_at = now() where id = p_invoice_id;
    return;
  end if;

  update public.invoices
     set paid_amount = v_paid,
         status = case
           when v_paid >= v_total - 0.01 and v_total > 0 then 'PAGADA'::invoice_status
           when v_paid > 0                               then 'PARCIALMENTE_PAGADA'::invoice_status
           when v_due is not null and v_due < current_date then 'VENCIDA'::invoice_status
           else 'EMITIDA'::invoice_status
         end,
         updated_at = now()
   where id = p_invoice_id;
end;
$$;

create or replace function app.tg_payments_sync_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform app.recalculate_invoice_payments(old.invoice_id);
  end if;
  perform app.recalculate_invoice_payments(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

create trigger payments_sync_invoice
  after insert or update or delete on public.payments
  for each row execute function app.tg_payments_sync_invoice();

-- ---------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------
create table public.expenses (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  cost_category_id  uuid references public.cost_categories(id) on delete set null,
  sale_id           uuid references public.sales(id) on delete set null,
  supplier_id       uuid references public.suppliers(id) on delete set null,
  invoice_id        uuid references public.invoices(id) on delete set null,
  description       text not null,
  expense_date      date not null default current_date,
  amount            numeric(14,2) not null,
  currency          currency_code not null default 'EUR',
  status            expense_status not null default 'BORRADOR',
  paid_at           date,
  bank_account_id   uuid references public.bank_accounts(id) on delete set null,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  approved_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint expenses_amount_ck check (amount >= 0)
);

create index expenses_project_date_idx on public.expenses (project_id, expense_date desc) where deleted_at is null;
create index expenses_sale_idx         on public.expenses (sale_id) where deleted_at is null;
create index expenses_category_idx     on public.expenses (cost_category_id);

select app.attach_updated_at('public.expenses');

alter table public.sale_costs
  add constraint sale_costs_expense_fk
  foreign key (expense_id) references public.expenses(id) on delete set null;

-- ---------------------------------------------------------------------
-- Movimientos bancarios (importables desde CSV/XLSX) + conciliacion
-- ---------------------------------------------------------------------
create table public.bank_transactions (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete restrict,
  bank_account_id       uuid not null references public.bank_accounts(id) on delete cascade,
  transaction_date      date not null,
  value_date            date,
  transaction_type      bank_transaction_type not null,
  description           text,
  counterparty          text,
  reference             text,
  amount                numeric(14,2) not null,
  currency              currency_code not null default 'EUR',
  balance_after         numeric(14,2),
  -- Conciliacion
  reconciled            boolean not null default false,
  reconciled_at         timestamptz,
  reconciled_by         uuid references public.profiles(id) on delete set null,
  payment_id            uuid references public.payments(id) on delete set null,
  expense_id            uuid references public.expenses(id) on delete set null,
  transfer_account_id   uuid references public.bank_accounts(id) on delete set null,
  -- Idempotencia de importaciones
  import_batch_id       uuid,
  import_hash           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint bank_transactions_amount_ck check (amount <> 0)
);

create unique index bank_transactions_import_hash_uk
  on public.bank_transactions (bank_account_id, import_hash) where import_hash is not null;
create index bank_transactions_account_date_idx on public.bank_transactions (bank_account_id, transaction_date desc);
create index bank_transactions_unreconciled_idx on public.bank_transactions (project_id, transaction_date)
  where not reconciled;

select app.attach_updated_at('public.bank_transactions');
