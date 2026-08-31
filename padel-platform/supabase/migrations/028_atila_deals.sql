-- =====================================================================
-- 028_atila_deals.sql
-- MODULO "NEGOCIOS" (trader).
--
-- Contexto de negocio (Atila):
--   Atila es el comprador intermedio: negocia, fija precios y vende al
--   club final. Nosotros somos el trader entre la fabrica y Atila, y
--   cobramos una comision fija por cancha. Por tanto NO necesitamos aqui
--   ni el detalle comercial de Atila (precio final, margenes del club) ni
--   el detalle industrial de la fabrica (materiales, costos, calidad):
--   eso vive en el proyecto EUROPA y solo estorbaria.
--
-- Lo que si es el nucleo del trabajo del trader:
--   1. Registrar cada negocio potencial y su avance.
--   2. Cuantas canchas y de que tipo (catalogo editable, no enum).
--   3. Comision por cancha (1.700 USD por defecto, editable).
--   4. Si la cancha es personalizada, donde va cada logo.
--   5. Las fechas. Y una regla dura: sin venta cerrada NO hay fecha de
--      entrega. Se garantiza con un CHECK, no con un aviso en la UI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type deal_status as enum (
  'POTENCIAL', 'EN_NEGOCIACION', 'CERRADA', 'ENTREGADA', 'PERDIDA'
);

comment on type deal_status is
  'Ciclo de vida del negocio. CERRADA y ENTREGADA son los unicos estados que admiten fechas de cierre y entrega.';

create type logo_brand as enum ('ATILA', 'CLUB');

comment on type logo_brand is
  'De quien es el logo: ATILA (el comprador intermedio) o CLUB (la marca del club final).';

-- ---------------------------------------------------------------------
-- Catalogo de tipos de cancha (editable desde la UI, §2)
--
-- "Atila Pro", "Atila Full" y "Cancha Normal" son datos, no codigo: el
-- administrador puede renombrarlos, desactivarlos o anadir uno nuevo sin
-- un despliegue.
-- ---------------------------------------------------------------------
create table public.court_models (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects(id) on delete cascade,
  code                     text not null,
  name                     text not null,
  description              text,
  -- Comision que se propone al anadir una cancha de este tipo.
  default_commission_usd   numeric(12,2) not null default 1700.00,
  sort_order               integer not null default 100,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint court_models_uk unique (project_id, code),
  constraint court_models_code_ck check (code ~ '^[A-Z0-9_]{2,32}$'),
  constraint court_models_commission_ck check (default_commission_usd >= 0)
);

comment on table public.court_models is
  'Tipos de cancha comercializables por proyecto. Catalogo editable: renombrar un tipo no exige migracion.';

create index court_models_project_idx on public.court_models (project_id) where active;

select app.attach_updated_at('public.court_models');

-- ---------------------------------------------------------------------
-- Catalogo de posiciones de logo (editable)
--
-- Las cuatro posiciones fisicas de una cancha donde puede ir una marca.
-- Tambien es catalogo: si manana aparece una quinta, se anade una fila.
-- ---------------------------------------------------------------------
create table public.logo_positions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  code         text not null,
  name         text not null,
  sort_order   integer not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint logo_positions_uk unique (project_id, code),
  constraint logo_positions_code_ck check (code ~ '^[A-Z0-9_]{2,32}$')
);

comment on table public.logo_positions is
  'Lugares de la cancha donde se puede aplicar un logo (entrada, postes de luz, postes de red, cubre resortes).';

create index logo_positions_project_idx on public.logo_positions (project_id) where active;

select app.attach_updated_at('public.logo_positions');

-- ---------------------------------------------------------------------
-- Negocio
--
-- El cliente se guarda como texto: el trader registra el club o la
-- oportunidad en segundos, sin obligar a dar de alta antes una ficha de
-- cliente completa. Ese nivel de CRM es del proyecto EUROPA.
-- ---------------------------------------------------------------------
create table public.deals (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  code                      text not null,
  client_name               text not null,
  contact_name              text,
  contact_email             text,
  contact_phone             text,
  country                   text,
  city                      text,
  status                    deal_status not null default 'POTENCIAL',

  -- Comision propuesta por defecto al anadir canchas a este negocio.
  commission_per_court_usd  numeric(12,2) not null default 1700.00,

  -- Totales derivados de las canchas (los mantiene un trigger, §85: el
  -- navegador nunca suma dinero).
  courts_count              integer not null default 0,
  total_commission_usd      numeric(14,2) not null default 0,

  -- Fechas. `closed_at` y `delivery_date` solo existen si la venta esta
  -- cerrada; lo garantiza deals_dates_ck mas abajo.
  opened_at                 date not null default current_date,
  expected_close_date       date,
  closed_at                 date,
  delivery_date             date,

  lost_reason               text,
  notes                     text,

  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint deals_code_uk unique (project_id, code),
  constraint deals_commission_ck check (commission_per_court_usd >= 0),

  -- REGLA CLAVE DEL NEGOCIO:
  -- si la venta no esta cerrada no puede haber fecha de cierre ni de
  -- entrega; si lo esta, la fecha de cierre es obligatoria.
  constraint deals_dates_ck check (
    case
      when status in ('CERRADA', 'ENTREGADA') then closed_at is not null
      else closed_at is null and delivery_date is null
    end
  ),
  constraint deals_delivery_after_close_ck check (
    delivery_date is null or closed_at is null or delivery_date >= closed_at
  )
);

comment on table public.deals is
  'Negocio del trader: un club potencial, sus canchas y la comision asociada.';
comment on constraint deals_dates_ck on public.deals is
  'Sin venta cerrada no hay fecha de entrega. La regla vive en la base, no solo en el formulario.';

create index deals_project_status_idx on public.deals (project_id, status) where deleted_at is null;
create index deals_delivery_idx on public.deals (project_id, delivery_date)
  where deleted_at is null and delivery_date is not null;

select app.attach_updated_at('public.deals');

-- ---------------------------------------------------------------------
-- Canchas del negocio
--
-- Una fila por cancha (no una cantidad): cada cancha puede tener su
-- propia personalizacion y sus propios logos, que es justo el detalle que
-- el trader necesita transmitir a la fabrica.
-- ---------------------------------------------------------------------
create table public.deal_courts (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  court_model_id   uuid not null references public.court_models(id) on delete restrict,
  position         integer not null default 1,
  is_custom        boolean not null default false,
  -- Se rellena desde el catalogo si no viene informada (trigger).
  commission_usd   numeric(12,2) not null,
  specs            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint deal_courts_commission_ck check (commission_usd >= 0),
  constraint deal_courts_position_ck check (position >= 1)
);

comment on table public.deal_courts is
  'Cada cancha comprometida en un negocio, con su tipo, personalizacion y comision.';

create index deal_courts_deal_idx on public.deal_courts (deal_id);
create index deal_courts_model_idx on public.deal_courts (court_model_id);

select app.attach_updated_at('public.deal_courts');

-- ---------------------------------------------------------------------
-- Logos por cancha
--
-- Cada fila responde: "el logo de ATILA va en los postes de luz".
-- Solo tiene sentido en canchas personalizadas; lo vigila un trigger.
-- ---------------------------------------------------------------------
create table public.deal_court_logos (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  deal_court_id      uuid not null references public.deal_courts(id) on delete cascade,
  brand              logo_brand not null,
  logo_position_id   uuid not null references public.logo_positions(id) on delete restrict,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint deal_court_logos_uk unique (deal_court_id, brand, logo_position_id)
);

comment on table public.deal_court_logos is
  'Ubicacion de cada logo (Atila / club) en una cancha personalizada.';

create index deal_court_logos_court_idx on public.deal_court_logos (deal_court_id);

select app.attach_updated_at('public.deal_court_logos');

-- =====================================================================
-- REGLAS AUTOMATICAS
-- =====================================================================

-- Numeracion correlativa del negocio (ATILA-2026-0001).
create or replace function app.deal_set_code()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  -- Se pasan los siete argumentos a proposito: desde 025 existen dos
  -- versiones de la funcion y una llamada corta seria ambigua. De paso,
  -- se comprueba de verdad que el numero este libre en `deals.code`.
  if new.code is null or btrim(new.code) = '' then
    new.code := app.next_document_number(
      new.project_id, 'DEAL', null, extract(year from now())::integer,
      'deals', 'code', ''
    );
  end if;
  return new;
end;
$$;

create trigger deals_set_code
  before insert on public.deals
  for each row execute function app.deal_set_code();

-- Comision por defecto: la del negocio si la tiene, si no la del catalogo.
create or replace function app.deal_court_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if new.commission_usd is null then
    new.commission_usd := coalesce(
      (select d.commission_per_court_usd from public.deals d where d.id = new.deal_id),
      (select cm.default_commission_usd from public.court_models cm where cm.id = new.court_model_id),
      1700.00
    );
  end if;
  return new;
end;
$$;

create trigger deal_courts_defaults
  before insert on public.deal_courts
  for each row execute function app.deal_court_defaults();

-- Totales del negocio: numero de canchas y comision total.
create or replace function app.recalc_deal_totals()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_deal_id uuid := coalesce(new.deal_id, old.deal_id);
begin
  update public.deals d
     set courts_count = coalesce(agg.n, 0),
         total_commission_usd = coalesce(agg.total, 0),
         updated_at = now()
    from (
      select count(*) as n, sum(commission_usd) as total
        from public.deal_courts
       where deal_id = v_deal_id
    ) agg
   where d.id = v_deal_id;

  return null;
end;
$$;

create trigger deal_courts_recalc
  after insert or update or delete on public.deal_courts
  for each row execute function app.recalc_deal_totals();

-- Un logo solo puede colocarse en una cancha personalizada.
create or replace function app.deal_court_logo_requires_custom()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if not exists (
    select 1 from public.deal_courts dc
     where dc.id = new.deal_court_id and dc.is_custom
  ) then
    raise exception 'Solo se pueden definir logos en una cancha personalizada'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger deal_court_logos_require_custom
  before insert or update on public.deal_court_logos
  for each row execute function app.deal_court_logo_requires_custom();

-- Al dejar de ser personalizada, la cancha pierde sus logos: si no, se
-- quedarian datos invisibles que reaparecerian al volver a marcarla.
create or replace function app.deal_court_clear_logos()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if old.is_custom and not new.is_custom then
    delete from public.deal_court_logos where deal_court_id = new.id;
  end if;
  return new;
end;
$$;

create trigger deal_courts_clear_logos
  after update of is_custom on public.deal_courts
  for each row execute function app.deal_court_clear_logos();

-- Coherencia de proyecto: una cancha no puede colgar de un negocio de
-- otra unidad de negocio (§83, mismo patron que el resto de tablas hijas).
create or replace function app.deal_child_project_guard()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_parent_project uuid;
begin
  if tg_table_name = 'deal_courts' then
    select project_id into v_parent_project from public.deals where id = new.deal_id;
  else
    select project_id into v_parent_project from public.deal_courts where id = new.deal_court_id;
  end if;

  if v_parent_project is null or v_parent_project <> new.project_id then
    raise exception 'Violacion de aislamiento entre unidades de negocio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger deal_courts_project_guard
  before insert or update on public.deal_courts
  for each row execute function app.deal_child_project_guard();

create trigger deal_court_logos_project_guard
  before insert or update on public.deal_court_logos
  for each row execute function app.deal_child_project_guard();

-- =====================================================================
-- VISTA DE TRABAJO DEL TRADER
-- Una sola fila por negocio con todo lo que se mira a diario.
-- =====================================================================
create or replace view public.v_deal_board
with (security_invoker = on) as
select
  d.id                    as deal_id,
  d.project_id,
  d.code,
  d.client_name,
  d.country,
  d.city,
  d.status,
  d.courts_count,
  d.total_commission_usd,
  d.opened_at,
  d.expected_close_date,
  d.closed_at,
  d.delivery_date,
  d.contact_name,
  d.contact_email,
  d.contact_phone,
  d.notes,
  -- Tipos de cancha del negocio, ya resumidos ("2x Atila Pro, 1x Normal").
  coalesce((
    select string_agg(x.label, ', ' order by x.label)
      from (
        select count(*)::text || 'x ' || cm.name as label
          from public.deal_courts dc
          join public.court_models cm on cm.id = dc.court_model_id
         where dc.deal_id = d.id
         group by cm.name
      ) x
  ), '—')                 as court_mix,
  (select count(*) from public.deal_courts dc
    where dc.deal_id = d.id and dc.is_custom) as custom_courts,
  case
    when d.status in ('CERRADA', 'ENTREGADA') and d.delivery_date is not null
      then (d.delivery_date - current_date)
  end                     as days_to_delivery,
  d.created_at,
  d.updated_at
from public.deals d
where d.deleted_at is null;

comment on view public.v_deal_board is
  'Tablero del trader: un negocio por fila, con mezcla de canchas, comision y fechas.';

-- =====================================================================
-- MODULO, PERMISOS Y RLS
-- =====================================================================
insert into public.modules (code, name, category, icon, sort_order) values
  ('deals', 'Negocios', 'COMERCIAL', 'handshake', 15)
on conflict (code) do nothing;

insert into public.permissions (code, module_code, action, description)
select 'deals.' || a.action, 'deals', a.action,
       initcap(a.action) || ' en modulo Negocios'
from (values ('view'),('create'),('update'),('delete'),('export')) as a(action)
on conflict (code) do nothing;

-- Los permisos creados despues de 004 no entran por el cross join
-- original: hay que asignarlos explicitamente.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where p.module_code = 'deals'
   and (
     r.code = 'ADMIN'
     or (r.code = 'GERENCIA'  and p.action <> 'delete')
     or (r.code = 'COMERCIAL' and p.action in ('view','create','update','export'))
     or (r.code = 'FINANZAS'  and p.action in ('view','export'))
     or (r.code = 'LECTURA'   and p.action = 'view')
   )
on conflict do nothing;

grant select, insert, update, delete on public.court_models     to authenticated;
grant select, insert, update, delete on public.logo_positions   to authenticated;
grant select, insert, update, delete on public.deals            to authenticated;
grant select, insert, update, delete on public.deal_courts      to authenticated;
grant select, insert, update, delete on public.deal_court_logos to authenticated;
grant select on public.v_deal_board to authenticated;

alter table public.court_models       enable row level security;
alter table public.logo_positions     enable row level security;
alter table public.deals              enable row level security;
alter table public.deal_courts        enable row level security;
alter table public.deal_court_logos   enable row level security;

-- Negocios: mismo patron que el resto de tablas operacionales.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('deals',            'deals'),
      ('deal_courts',      'deals'),
      ('deal_court_logos', 'deals')
    ) as t(tbl, module)
  loop
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.view');

    execute format($p$
      create policy %1$s_insert on public.%1$I
        for insert to authenticated
        with check (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.create');

    execute format($p$
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)))
        with check (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.update');

    execute format($p$
      create policy %1$s_delete on public.%1$I
        for delete to authenticated
        using (project_id in (select app.projects_with_permission(%2$L)));
    $p$, r.tbl, r.module || '.delete');
  end loop;
end;
$$;

-- Catalogos: los lee cualquiera que pueda ver negocios; los edita quien
-- administra el proyecto.
do $$
declare r record;
begin
  for r in select unnest(array['court_models','logo_positions']) as tbl
  loop
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (project_id in (select app.projects_with_permission('deals.view')));
    $p$, r.tbl);

    execute format($p$
      create policy %1$s_manage on public.%1$I
        for all to authenticated
        using (project_id in (select app.projects_with_permission('settings.manage')))
        with check (project_id in (select app.projects_with_permission('settings.manage')));
    $p$, r.tbl);
  end loop;
end;
$$;

-- =====================================================================
-- ATILA: catalogo inicial y menu reducido al trabajo del trader
-- =====================================================================
insert into public.court_models (project_id, code, name, description, default_commission_usd, sort_order)
select p.id, v.code, v.name, v.description, 1700.00, v.sort_order
  from public.projects p
  cross join (values
    ('ATILA_PRO',  'Atila Pro',     'Modelo premium de la linea Atila.',       10),
    ('ATILA_FULL', 'Atila Full',    'Modelo completo de la linea Atila.',      20),
    ('NORMAL',     'Cancha Normal', 'Cancha estandar sin linea especifica.',   30)
  ) as v(code, name, description, sort_order)
 where p.code = 'ATILA'
on conflict (project_id, code) do nothing;

insert into public.logo_positions (project_id, code, name, sort_order)
select p.id, v.code, v.name, v.sort_order
  from public.projects p
  cross join (values
    ('ENTRADA',        'Arriba de la entrada de la cancha', 10),
    ('POSTES_LUZ',     'Postes de luz',                     20),
    ('POSTES_RED',     'Postes de red',                     30),
    ('CUBRE_RESORTES', 'Cubre resortes',                    40)
  ) as v(code, name, sort_order)
 where p.code = 'ATILA'
on conflict (project_id, code) do nothing;

-- Menu de ATILA: solo lo que usa un trader.
-- Lo que se apaga aqui no se borra; sigue disponible si algun dia hace
-- falta, basta con volver a habilitarlo en `project_modules`.
insert into public.project_modules (project_id, module_code, enabled)
select p.id, 'deals', true from public.projects p where p.code = 'ATILA'
on conflict (project_id, module_code) do update set enabled = true;

update public.project_modules pm
   set enabled = false
  from public.projects p
 where p.id = pm.project_id
   and p.code = 'ATILA'
   and pm.module_code not in ('deals', 'documents', 'tasks', 'reports', 'settings');

insert into public.project_modules (project_id, module_code, enabled)
select p.id, m.code, true
  from public.projects p
  cross join public.modules m
 where p.code = 'ATILA'
   and m.code in ('documents', 'tasks', 'reports', 'settings')
on conflict (project_id, module_code) do update set enabled = true;
