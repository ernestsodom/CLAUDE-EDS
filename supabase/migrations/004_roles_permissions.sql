-- =====================================================================
-- 004_roles_permissions.sql
-- Modelo de autorizacion granular: roles -> permisos.
-- La UI y las policies NUNCA evaluan el nombre del rol, siempre el
-- permiso concreto (module.action).
-- =====================================================================

create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_system     boolean not null default false,   -- roles del sistema no se borran
  level         integer not null default 10,      -- 100 = ADMIN, 10 = LECTURA
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint roles_code_uk unique (code),
  constraint roles_code_format_ck check (code ~ '^[A-Z_]{3,32}$')
);

select app.attach_updated_at('public.roles');

insert into public.roles (code, name, description, is_system, level) values
  ('ADMIN',       'Administrador',  'Acceso total al proyecto y a la configuracion.', true, 100),
  ('GERENCIA',    'Gerencia',       'Vision ejecutiva completa, edicion comercial y financiera.', true, 80),
  ('COMERCIAL',   'Comercial',      'Gestion de clientes, oportunidades y ventas.', true, 50),
  ('OPERACIONES', 'Operaciones',    'Fabricacion, canchas, materiales, logistica e instalaciones.', true, 50),
  ('FINANZAS',    'Finanzas',       'Contratos, facturas, pagos, gastos y bancos.', true, 50),
  ('LECTURA',     'Solo lectura',   'Consulta sin capacidad de modificacion.', true, 10);

-- ---------------------------------------------------------------------
-- Permisos granulares: <module>.<action>
-- ---------------------------------------------------------------------
create table public.permissions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  module_code   text not null references public.modules(code) on delete cascade,
  action        text not null,
  description   text,
  created_at    timestamptz not null default now(),

  constraint permissions_code_uk unique (code),
  constraint permissions_action_ck check (action in
    ('view','create','update','delete','approve','export','upload','manage'))
);

-- Genera automaticamente el catalogo base de permisos por modulo.
insert into public.permissions (code, module_code, action, description)
select m.code || '.' || a.action,
       m.code,
       a.action,
       initcap(a.action) || ' en modulo ' || m.name
from public.modules m
cross join (values ('view'),('create'),('update'),('delete'),('export')) as a(action)
where m.code not in ('dashboard','control_center','calendar','reports','settings');

-- Permisos especiales (no CRUD). Algunos codigos ya fueron generados por
-- el bloque anterior, de ahi el ON CONFLICT.
insert into public.permissions (code, module_code, action, description) values
  ('dashboard.view',      'dashboard',      'view',   'Ver dashboards del proyecto'),
  ('control_center.view', 'control_center', 'view',   'Ver Control Center'),
  ('calendar.view',       'calendar',       'view',   'Ver calendario'),
  ('reports.view',        'reports',        'view',   'Ver reportes'),
  ('reports.export',      'reports',        'export', 'Exportar reportes (CSV/XLSX/PDF)'),
  ('settings.view',       'settings',       'view',   'Ver configuracion del proyecto'),
  ('settings.manage',     'settings',       'manage', 'Administrar proyecto, usuarios, modulos y catalogos'),
  ('documents.upload',    'documents',      'upload', 'Subir documentos a Storage'),
  ('sales.approve',       'sales',          'approve','Confirmar / aprobar ventas'),
  ('purchases.approve',   'purchases',      'approve','Aprobar ordenes de compra'),
  ('quality.approve',     'quality',        'approve','Aprobar controles de calidad'),
  ('profitability.view',  'profitability',  'view',   'Ver margenes y rentabilidad')
on conflict (code) do nothing;

create table public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create index role_permissions_permission_idx on public.role_permissions (permission_id);

-- ---------------------------------------------------------------------
-- Asignacion de permisos a roles del sistema
-- ---------------------------------------------------------------------

-- ADMIN: todo
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'ADMIN';

-- GERENCIA: todo excepto administracion del sistema y borrados destructivos
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'GERENCIA'
  and p.code <> 'settings.manage'
  and p.action <> 'delete';

-- COMERCIAL
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'COMERCIAL'
  and (
    (p.module_code in ('clients','contacts','opportunities','meetings','follow_ups','sales','tasks')
      and p.action in ('view','create','update','export'))
    or p.code in ('dashboard.view','calendar.view','control_center.view','reports.view',
                  'documents.view','documents.create','documents.upload','documents.export',
                  'courts.view','manufacturing.view','installations.view','logistics.view',
                  'invoices.view','payments.view','contracts.view','profitability.view')
  );

-- OPERACIONES
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'OPERACIONES'
  and (
    (p.module_code in ('manufacturing','courts','materials','suppliers','purchases','logistics',
                       'installations','quality','used_inventory','dismantling','refurbishment','tasks')
      and p.action in ('view','create','update','export'))
    or p.code in ('dashboard.view','calendar.view','control_center.view','reports.view',
                  'documents.view','documents.create','documents.upload','documents.export',
                  'clients.view','sales.view','quality.approve')
  );

-- FINANZAS
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'FINANZAS'
  and (
    (p.module_code in ('contracts','invoices','payments','expenses','banks','profitability','tasks')
      and p.action in ('view','create','update','export'))
    or p.code in ('dashboard.view','calendar.view','control_center.view','reports.view','reports.export',
                  'documents.view','documents.create','documents.upload','documents.export',
                  'clients.view','sales.view','sales.update','purchases.view','purchases.approve',
                  'suppliers.view','courts.view')
  );

-- LECTURA: solo view
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'LECTURA' and p.action = 'view' and p.code <> 'settings.view';
