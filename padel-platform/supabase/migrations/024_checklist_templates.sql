-- =====================================================================
-- 024_checklist_templates.sql
-- Plantillas de checklist globales (§57, §59, §120).
-- Son CONFIGURACION, no datos demo: confirm_sale() depende de ellas.
-- =====================================================================

insert into public.checklist_templates (id, project_id, code, name, scope) values
  ('11111111-0000-4000-8000-000000000001', null, 'VENTA_CONFIRMADA', 'Checklist de venta',        'SALE'),
  ('11111111-0000-4000-8000-000000000002', null, 'FABRICACION',      'Checklist de fabricacion',  'MANUFACTURING_PROJECT'),
  ('11111111-0000-4000-8000-000000000003', null, 'INSTALACION',      'Checklist de instalacion',  'INSTALLATION')
on conflict do nothing;

-- Checklist de venta (§120)
insert into public.checklist_template_items (template_id, title, sort_order, is_required) values
  ('11111111-0000-4000-8000-000000000001', 'Datos de cliente completos',        10, true),
  ('11111111-0000-4000-8000-000000000001', 'Contrato firmado',                  20, true),
  ('11111111-0000-4000-8000-000000000001', 'Anticipo recibido',                 30, true),
  ('11111111-0000-4000-8000-000000000001', 'Diseno aprobado por el cliente',    40, true),
  ('11111111-0000-4000-8000-000000000001', 'Especificaciones tecnicas cerradas',50, true),
  ('11111111-0000-4000-8000-000000000001', 'Produccion planificada',            60, true),
  ('11111111-0000-4000-8000-000000000001', 'Logistica reservada',               70, true),
  ('11111111-0000-4000-8000-000000000001', 'Instalacion agendada',              80, false),
  ('11111111-0000-4000-8000-000000000001', 'Facturacion emitida',               90, true);

-- Checklist de fabricacion (§57)
insert into public.checklist_template_items (template_id, title, sort_order, is_required) values
  ('11111111-0000-4000-8000-000000000002', 'Diseno aprobado',            10, true),
  ('11111111-0000-4000-8000-000000000002', 'Materiales comprados',       20, true),
  ('11111111-0000-4000-8000-000000000002', 'Fierro disponible',          30, true),
  ('11111111-0000-4000-8000-000000000002', 'Construccion terminada',     40, true),
  ('11111111-0000-4000-8000-000000000002', 'Galvanizado',                50, true),
  ('11111111-0000-4000-8000-000000000002', 'Control de calidad',         60, true),
  ('11111111-0000-4000-8000-000000000002', 'Embalaje',                   70, true),
  ('11111111-0000-4000-8000-000000000002', 'Documentacion de despacho',  80, true),
  ('11111111-0000-4000-8000-000000000002', 'Despacho',                   90, true);

-- Checklist de instalacion (§59)
insert into public.checklist_template_items (template_id, title, sort_order, is_required) values
  ('11111111-0000-4000-8000-000000000003', 'Canchas recibidas en destino', 10, true),
  ('11111111-0000-4000-8000-000000000003', 'Vidrios revisados',            20, true),
  ('11111111-0000-4000-8000-000000000003', 'Estructura revisada',          30, true),
  ('11111111-0000-4000-8000-000000000003', 'Terreno preparado',            40, true),
  ('11111111-0000-4000-8000-000000000003', 'Instalacion iniciada',         50, true),
  ('11111111-0000-4000-8000-000000000003', 'Iluminacion instalada',        60, false),
  ('11111111-0000-4000-8000-000000000003', 'Cesped instalado',             70, true),
  ('11111111-0000-4000-8000-000000000003', 'Red y accesorios',             80, true),
  ('11111111-0000-4000-8000-000000000003', 'Terminaciones',                90, true),
  ('11111111-0000-4000-8000-000000000003', 'Limpieza final',              100, true),
  ('11111111-0000-4000-8000-000000000003', 'Recepcion firmada por cliente',110, true);

-- =====================================================================
-- Proyectos iniciales (§7). Son las 3 unidades de negocio reales, no
-- datos demo: la aplicacion no funciona sin ellas.
-- =====================================================================
insert into public.projects (id, name, code, description, country_scope, default_currency, timezone, court_kind, color_hex)
values
  ('a0000000-0000-4000-8000-000000000001', 'Europa', 'EUROPA',
   'Fabricacion y comercializacion de canchas nuevas para Europa.',
   array['ES','FR','IT','PT','DE'], 'EUR', 'Europe/Madrid', 'NUEVA', '#FF5A00'),
  ('a0000000-0000-4000-8000-000000000002', 'Atila', 'ATILA',
   'Unidad de negocio Atila.',
   array['AR','ES'], 'EUR', 'America/Argentina/Buenos_Aires', 'NUEVA', '#FF7A2F'),
  ('a0000000-0000-4000-8000-000000000003', 'Venta de canchas usadas', 'VENTA_USADAS',
   'Compra, refurbishment y reventa de canchas usadas.',
   array['ES','AR','CL'], 'EUR', 'Europe/Madrid', 'USADA', '#FF9A5A')
on conflict (code) do nothing;

-- Modulos habilitados por proyecto (§2)
insert into public.project_modules (project_id, module_code, enabled)
select 'a0000000-0000-4000-8000-000000000001', code, true
from public.modules
where code in ('dashboard','clients','contacts','opportunities','meetings','follow_ups','sales',
               'manufacturing','courts','materials','suppliers','purchases','logistics',
               'installations','quality','contracts','invoices','payments','expenses','banks',
               'profitability','documents','reports','control_center','tasks','calendar','settings')
on conflict do nothing;

insert into public.project_modules (project_id, module_code, enabled)
select 'a0000000-0000-4000-8000-000000000002', code, true
from public.modules
where code in ('dashboard','clients','contacts','opportunities','meetings','follow_ups','sales',
               'manufacturing','courts','installations','documents','tasks','calendar',
               'control_center','reports','settings')
on conflict do nothing;

insert into public.project_modules (project_id, module_code, enabled)
select 'a0000000-0000-4000-8000-000000000003', code, true
from public.modules
where code in ('dashboard','clients','contacts','opportunities','sales','used_inventory',
               'dismantling','refurbishment','courts','logistics','installations',
               'documents','reports','control_center','tasks','calendar','profitability',
               'invoices','payments','settings')
on conflict do nothing;
