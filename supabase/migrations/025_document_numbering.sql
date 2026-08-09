-- =====================================================================
-- 025_document_numbering.sql
--
-- CORRECCION: la numeracion automatica colisionaba con los numeros
-- introducidos a mano.
--
-- `app.next_document_number` incrementaba un contador propio sin mirar los
-- numeros ya existentes. En cuanto alguien tecleaba un numero de factura o
-- de venta (o se cargaba un historico), el contador se quedaba atras y el
-- siguiente documento autogenerado chocaba contra el indice unico:
--
--   duplicate key value violates unique constraint "sales_number_uk"
--
-- Se corrige por dos vias complementarias:
--   1. Al guardar un numero explicito, el contador se eleva a ese valor
--      (`app.sync_document_sequence`). Resuelve tambien la carga masiva de
--      historicos.
--   2. Al generar, se comprueba que el numero este libre y, si no, se
--      sigue avanzando. Es la red de seguridad para cualquier hueco que
--      quede: dos numeraciones distintas conviviendo, importaciones
--      parciales o correlativos manipulados a mano en la base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Eleva el contador hasta un numero ya usado
-- ---------------------------------------------------------------------
create or replace function app.sync_document_sequence(
  p_project_id   uuid,
  p_sequence_key text,
  p_prefix       text,
  p_year         integer,
  p_number       text
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_tail  text;
  v_value integer;
begin
  if p_number is null then return; end if;

  -- El correlativo es el ultimo bloque de digitos: EU-2026-0014 -> 14
  v_tail := regexp_replace(p_number, '^.*[^0-9]', '');
  if v_tail is null or v_tail = '' or v_tail !~ '^\d+$' then
    return;   -- numeracion libre que no sigue el patron: no se toca nada
  end if;

  v_value := v_tail::integer;

  insert into public.document_sequences (project_id, sequence_key, prefix, year, last_value)
  values (p_project_id, p_sequence_key, coalesce(p_prefix, ''), p_year, v_value)
  on conflict (project_id, sequence_key, year)
  do update set last_value = greatest(public.document_sequences.last_value, v_value),
                updated_at = now();
end;
$$;

comment on function app.sync_document_sequence is
  'Sube el correlativo al numero indicado si este es mayor. Evita colisiones tras numeros manuales o cargas historicas.';

-- ---------------------------------------------------------------------
-- Generacion con comprobacion de unicidad real
-- ---------------------------------------------------------------------
create or replace function app.next_document_number(
  p_project_id   uuid,
  p_sequence_key text,
  p_prefix       text default null,
  p_year         integer default null,
  -- Tabla y columna contra las que verificar que el numero esta libre.
  -- Si se omiten, se mantiene el comportamiento anterior.
  p_unique_table  text default null,
  p_unique_column text default null,
  -- Prefijo literal que la tabla antepone (ej. 'FV-'), para que la
  -- comprobacion de unicidad mire el numero tal como se va a guardar.
  p_literal_prefix text default ''
)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year      integer := coalesce(p_year, extract(year from now())::integer);
  v_prefix    text    := coalesce(p_prefix, (select code from public.projects where id = p_project_id));
  v_value     integer;
  v_candidate text;
  v_taken     boolean;
  v_attempts  integer := 0;
begin
  loop
    v_attempts := v_attempts + 1;

    insert into public.document_sequences (project_id, sequence_key, prefix, year, last_value)
    values (p_project_id, p_sequence_key, v_prefix, v_year, 1)
    on conflict (project_id, sequence_key, year)
    do update set last_value = public.document_sequences.last_value + 1,
                  updated_at = now()
    returning last_value into v_value;

    v_candidate := format('%s-%s-%s', v_prefix, v_year, lpad(v_value::text, 4, '0'));

    exit when p_unique_table is null or p_unique_column is null;

    execute format(
      'select exists (select 1 from public.%I where project_id = $1 and %I = $2)',
      p_unique_table, p_unique_column
    )
    into v_taken
    using p_project_id, p_literal_prefix || v_candidate;

    exit when not v_taken;

    if v_attempts > 1000 then
      raise exception
        'No se pudo generar un numero libre para % tras % intentos', p_sequence_key, v_attempts
        using hint = 'Revisa document_sequences y los numeros existentes en la tabla.';
    end if;
  end loop;

  return v_candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers de numeracion: generar comprobando unicidad, o sincronizar el
-- contador cuando el numero viene dado.
-- ---------------------------------------------------------------------
create or replace function app.tg_sales_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year integer := extract(year from new.sale_date)::integer;
begin
  if new.sale_number is null or btrim(new.sale_number) = '' then
    new.sale_number := app.next_document_number(
      new.project_id, 'SALE', null, v_year, 'sales', 'sale_number'
    );
  else
    perform app.sync_document_sequence(
      new.project_id, 'SALE',
      (select code from public.projects where id = new.project_id),
      v_year, new.sale_number
    );
  end if;
  return new;
end;
$$;

create or replace function app.tg_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year   integer := extract(year from new.invoice_date)::integer;
  v_prefix text    := case when new.kind = 'VENTA' then 'FV-' else 'FC-' end;
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := v_prefix || app.next_document_number(
      new.project_id, 'INVOICE_' || new.kind::text, null, v_year,
      'invoices', 'invoice_number', v_prefix
    );
  else
    perform app.sync_document_sequence(
      new.project_id, 'INVOICE_' || new.kind::text,
      (select code from public.projects where id = new.project_id),
      v_year, new.invoice_number
    );
  end if;
  return new;
end;
$$;

create or replace function app.tg_po_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year integer := extract(year from new.order_date)::integer;
begin
  if new.po_number is null or btrim(new.po_number) = '' then
    new.po_number := 'OC-' || app.next_document_number(
      new.project_id, 'PO', null, v_year, 'purchase_orders', 'po_number', 'OC-'
    );
  else
    perform app.sync_document_sequence(
      new.project_id, 'PO',
      (select code from public.projects where id = new.project_id),
      v_year, new.po_number
    );
  end if;
  return new;
end;
$$;

create or replace function app.tg_shipment_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  if new.shipment_number is null or btrim(new.shipment_number) = '' then
    new.shipment_number := 'SH-' || app.next_document_number(
      new.project_id, 'SHIPMENT', null, v_year, 'shipments', 'shipment_number', 'SH-'
    );
  else
    perform app.sync_document_sequence(
      new.project_id, 'SHIPMENT',
      (select code from public.projects where id = new.project_id),
      v_year, new.shipment_number
    );
  end if;
  return new;
end;
$$;

create or replace function app.tg_installation_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  if new.installation_number is null or btrim(new.installation_number) = '' then
    new.installation_number := 'INS-' || app.next_document_number(
      new.project_id, 'INSTALLATION', null, v_year,
      'installations', 'installation_number', 'INS-'
    );
  else
    perform app.sync_document_sequence(
      new.project_id, 'INSTALLATION',
      (select code from public.projects where id = new.project_id),
      v_year, new.installation_number
    );
  end if;
  return new;
end;
$$;

-- Canchas: correlativo continuo (year = 0), mismo tratamiento.
create or replace function app.tg_courts_number()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_prefix text;
  v_next   integer;
  v_taken  boolean;
  v_attempts integer := 0;
begin
  select code into v_prefix from public.projects where id = new.project_id;

  if new.court_number is null or btrim(new.court_number) = '' then
    loop
      v_attempts := v_attempts + 1;

      insert into public.document_sequences (project_id, sequence_key, prefix, year, last_value)
      values (new.project_id, 'COURT', v_prefix, 0, 1)
      on conflict (project_id, sequence_key, year)
        do update set last_value = public.document_sequences.last_value + 1,
                      updated_at = now()
      returning last_value into v_next;

      new.court_number := format('%s-%s', v_prefix, lpad(v_next::text, 4, '0'));

      select exists (
        select 1 from public.courts
         where project_id = new.project_id and court_number = new.court_number
      ) into v_taken;

      exit when not v_taken;

      if v_attempts > 1000 then
        raise exception 'No se pudo generar un numero de cancha libre tras % intentos', v_attempts;
      end if;
    end loop;
  else
    perform app.sync_document_sequence(new.project_id, 'COURT', v_prefix, 0, new.court_number);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Reparacion de los contadores existentes.
-- Deja `document_sequences` alineada con los numeros ya guardados, de modo
-- que una base creada antes de esta migracion no colisione en el primer
-- documento autogenerado.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select project_id, extract(year from sale_date)::integer as year, sale_number
      from public.sales where deleted_at is null
  loop
    perform app.sync_document_sequence(
      r.project_id, 'SALE',
      (select code from public.projects where id = r.project_id), r.year, r.sale_number);
  end loop;

  for r in
    select project_id, kind, extract(year from invoice_date)::integer as year, invoice_number
      from public.invoices where deleted_at is null
  loop
    perform app.sync_document_sequence(
      r.project_id, 'INVOICE_' || r.kind::text,
      (select code from public.projects where id = r.project_id), r.year, r.invoice_number);
  end loop;

  for r in
    select project_id, extract(year from order_date)::integer as year, po_number
      from public.purchase_orders where deleted_at is null
  loop
    perform app.sync_document_sequence(
      r.project_id, 'PO',
      (select code from public.projects where id = r.project_id), r.year, r.po_number);
  end loop;

  for r in select project_id, court_number from public.courts where deleted_at is null loop
    perform app.sync_document_sequence(
      r.project_id, 'COURT',
      (select code from public.projects where id = r.project_id), 0, r.court_number);
  end loop;

  for r in
    select project_id, extract(year from coalesce(departure_date, created_at::date))::integer as year,
           shipment_number
      from public.shipments where deleted_at is null
  loop
    perform app.sync_document_sequence(
      r.project_id, 'SHIPMENT',
      (select code from public.projects where id = r.project_id), r.year, r.shipment_number);
  end loop;

  for r in
    select project_id, extract(year from coalesce(planned_start_date, created_at::date))::integer as year,
           installation_number
      from public.installations where deleted_at is null
  loop
    perform app.sync_document_sequence(
      r.project_id, 'INSTALLATION',
      (select code from public.projects where id = r.project_id), r.year, r.installation_number);
  end loop;
end;
$$;

revoke execute on function app.sync_document_sequence(uuid, text, text, integer, text)
  from public, authenticated;
revoke execute on function app.next_document_number(uuid, text, text, integer, text, text, text)
  from public, authenticated;
