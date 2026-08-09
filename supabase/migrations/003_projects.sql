-- =====================================================================
-- 003_projects.sql
-- Unidades de negocio (EUROPA / ATILA / VENTA_USADAS) y configuracion
-- de modulos por proyecto.
-- =====================================================================

create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  code              text not null,
  description       text,
  country_scope     text[] not null default '{}',
  default_currency  currency_code not null default 'EUR',
  timezone          text not null default 'Europe/Madrid',
  court_kind        court_kind not null default 'NUEVA',
  color_hex         text not null default '#FF5A00',
  -- Umbrales configurables usados por el motor de alertas
  cost_deviation_threshold_pct  numeric(5,2) not null default 10.00,
  min_margin_threshold_pct      numeric(5,2) not null default 15.00,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint projects_code_format_ck check (code ~ '^[A-Z0-9_]{2,32}$'),
  constraint projects_code_uk unique (code),
  constraint projects_thresholds_ck check (
    cost_deviation_threshold_pct >= 0 and min_margin_threshold_pct >= 0
  )
);

comment on table public.projects is
  'Unidades de negocio. Todo dato operacional cuelga de un project_id y queda aislado por RLS.';
comment on column public.projects.court_kind is
  'Determina el set de estados validos de canchas del proyecto (NUEVA vs USADA).';

create index projects_active_idx on public.projects (active) where deleted_at is null;

select app.attach_updated_at('public.projects');

-- ---------------------------------------------------------------------
-- Modulos habilitables por proyecto (sin tocar codigo)
-- ---------------------------------------------------------------------
create table public.modules (
  code          text primary key,
  name          text not null,
  category      text not null,          -- COMERCIAL | OPERACIONES | FINANZAS | GENERAL
  icon          text,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now()
);

comment on table public.modules is 'Catalogo maestro de modulos de la plataforma.';

insert into public.modules (code, name, category, icon, sort_order) values
  ('dashboard',        'Dashboard',            'GENERAL',      'layout-dashboard', 10),
  ('clients',          'Clientes',             'COMERCIAL',    'building-2',       20),
  ('contacts',         'Contactos',            'COMERCIAL',    'users',            25),
  ('opportunities',    'Oportunidades',        'COMERCIAL',    'target',           30),
  ('meetings',         'Reuniones',            'COMERCIAL',    'calendar-check',   35),
  ('follow_ups',       'Seguimientos',         'COMERCIAL',    'bell-ring',        40),
  ('sales',            'Ventas',               'COMERCIAL',    'handshake',        45),
  ('manufacturing',    'Fabricacion',          'OPERACIONES',  'factory',          50),
  ('courts',           'Canchas',              'OPERACIONES',  'layout-grid',      55),
  ('materials',        'Materiales',           'OPERACIONES',  'boxes',            60),
  ('suppliers',        'Proveedores',          'OPERACIONES',  'truck',            62),
  ('purchases',        'Ordenes de Compra',    'OPERACIONES',  'shopping-cart',    65),
  ('logistics',        'Logistica',            'OPERACIONES',  'ship',             70),
  ('installations',    'Instalaciones',        'OPERACIONES',  'hard-hat',         75),
  ('quality',          'Calidad',              'OPERACIONES',  'badge-check',      78),
  ('used_inventory',   'Inventario Usadas',    'OPERACIONES',  'warehouse',        80),
  ('dismantling',      'Desmontaje',           'OPERACIONES',  'wrench',           82),
  ('refurbishment',    'Reparacion',           'OPERACIONES',  'hammer',           84),
  ('contracts',        'Contratos',            'FINANZAS',     'file-signature',   90),
  ('invoices',         'Facturas',             'FINANZAS',     'receipt',          92),
  ('payments',         'Pagos',                'FINANZAS',     'banknote',         94),
  ('expenses',         'Gastos',               'FINANZAS',     'credit-card',      96),
  ('banks',            'Bancos',               'FINANZAS',     'landmark',         98),
  ('profitability',    'Rentabilidad',         'FINANZAS',     'trending-up',     100),
  ('documents',        'Documentos',           'GENERAL',      'folder-open',     110),
  ('reports',          'Reportes',             'GENERAL',      'bar-chart-3',     120),
  ('control_center',   'Control Center',       'GENERAL',      'siren',           130),
  ('tasks',            'Tareas',               'GENERAL',      'check-square',    135),
  ('calendar',         'Calendario',           'GENERAL',      'calendar',        140),
  ('settings',         'Configuracion',        'GENERAL',      'settings',        200);

create table public.project_modules (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  module_code text not null references public.modules(code) on delete cascade,
  enabled     boolean not null default true,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint project_modules_uk unique (project_id, module_code)
);

create index project_modules_project_idx on public.project_modules (project_id) where enabled;

select app.attach_updated_at('public.project_modules');

-- ---------------------------------------------------------------------
-- Secuencias de numeracion por proyecto (ventas, facturas, OC...)
-- Evita condiciones de carrera usando UPDATE ... RETURNING.
-- ---------------------------------------------------------------------
create table public.document_sequences (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  sequence_key text not null,            -- SALE | INVOICE_SALE | INVOICE_PURCHASE | PO | COURT | SHIPMENT
  prefix      text not null,
  year        integer not null,
  last_value  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint document_sequences_uk unique (project_id, sequence_key, year)
);

select app.attach_updated_at('public.document_sequences');

create or replace function app.next_document_number(
  p_project_id uuid,
  p_sequence_key text,
  p_prefix text default null,
  p_year integer default null
)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_year   integer := coalesce(p_year, extract(year from now())::integer);
  v_prefix text    := coalesce(p_prefix, (select code from public.projects where id = p_project_id));
  v_value  integer;
begin
  insert into public.document_sequences (project_id, sequence_key, prefix, year, last_value)
  values (p_project_id, p_sequence_key, v_prefix, v_year, 1)
  on conflict (project_id, sequence_key, year)
  do update set last_value = public.document_sequences.last_value + 1,
                updated_at = now()
  returning last_value into v_value;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_value::text, 4, '0'));
end;
$$;

comment on function app.next_document_number is
  'Genera correlativos atomicos por proyecto/tipo/anio. Ej: EU-2026-0014.';
