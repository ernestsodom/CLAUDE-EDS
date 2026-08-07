-- ============================================================================
-- LicitIA — Datos de ejemplo (seed) para desarrollo y pruebas
-- Ejecutar DESPUÉS de crear al menos un usuario en Supabase Auth y reemplazar
-- :admin_user_id por su UUID (o usar scripts/seed.sh que lo hace por ti).
-- ============================================================================

-- Organización demo
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Xperti Consultores', 'xperti')
on conflict (id) do nothing;

insert into app_settings (organization_id) values
  ('11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- Clientes demo (municipios chilenos)
insert into clients (id, organization_id, name, kind, country, region, city) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Municipalidad de Puerto Montt', 'municipio', 'Chile', 'Los Lagos', 'Puerto Montt'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Municipalidad de Valdivia', 'municipio', 'Chile', 'Los Ríos', 'Valdivia'),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Servicio de Salud Reloncaví', 'institucion', 'Chile', 'Los Lagos', 'Puerto Montt')
on conflict (id) do nothing;

-- Carpeta de proyecto demo
insert into projects (id, organization_id, client_id, name, description) values
  ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001', 'SGM Puerto Montt 2026',
   'Implementación del Sistema de Gestión Municipal — licitación 2397-45-LR26')
on conflict (id) do nothing;

-- Documento demo (licitación) con requerimientos y cronograma
insert into documents (id, organization_id, client_id, title, doc_type, status,
  tender_number, tender_name, market_id, doc_date, amount, currency,
  contract_duration, country, region, city, language)
values (
  '33333333-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '22222222-0000-0000-0000-000000000001',
  'Licitación Sistema de Gestión Municipal — Puerto Montt',
  'licitacion', 'procesado',
  '2397-45-LR26', 'Adquisición e implementación de Sistema de Gestión Municipal',
  '2397-45-LR26', '2026-03-15', 185000000, 'CLP',
  '24 meses', 'Chile', 'Los Lagos', 'Puerto Montt', 'es'
)
on conflict (id) do nothing;

insert into document_versions (id, document_id, version, is_current) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 1, true)
on conflict do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from requirements where document_id = '33333333-0000-0000-0000-000000000001') then
  insert into requirements (document_id, code, title, description, category, mandatory, page, priority) values
    ('33333333-0000-0000-0000-000000000001', 'RQ-001', 'Módulo de Rentas y Patentes',
     'Sistema debe incluir gestión completa de rentas municipales y patentes comerciales.', 'modulo', true, 12, 'alto'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-002', 'Integración con Tesorería General',
     'Integración en línea con Tesorería General de la República para conciliación.', 'integracion', true, 14, 'critico'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-003', 'Firma electrónica avanzada',
     'Documentos oficiales deben firmarse con FEA según Ley 19.799.', 'seguridad', true, 18, 'alto'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-004', 'Dashboard ejecutivo con Power BI',
     'Reportería gerencial con tableros Power BI actualizados diariamente.', 'dashboard', false, 22, 'medio'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-005', 'Capacitación a 50 funcionarios',
     'Plan de capacitación presencial para 50 funcionarios en 3 módulos.', 'capacitacion', true, 30, 'medio');
  end if;
end $seed$;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from technical_variables where document_id = '33333333-0000-0000-0000-000000000001') then
  insert into technical_variables (document_id, category, name, description, page, confidence) values
    ('33333333-0000-0000-0000-000000000001', 'sistema', 'Sistema de Gestión Municipal', 'Plataforma integral web', 8, 0.98),
    ('33333333-0000-0000-0000-000000000001', 'modulo', 'Rentas y Patentes', 'Gestión de rentas municipales', 12, 0.97),
    ('33333333-0000-0000-0000-000000000001', 'modulo', 'Permisos de Circulación', 'Emisión y renovación en línea', 13, 0.95),
    ('33333333-0000-0000-0000-000000000001', 'integracion', 'Tesorería General de la República', 'Conciliación de ingresos', 14, 0.96),
    ('33333333-0000-0000-0000-000000000001', 'integracion', 'Registro Civil', 'Validación de identidad', 15, 0.91),
    ('33333333-0000-0000-0000-000000000001', 'seguridad', 'Firma Electrónica Avanzada', 'Ley 19.799', 18, 0.95),
    ('33333333-0000-0000-0000-000000000001', 'sla', 'Disponibilidad 99.5%', 'Medida mensualmente, con multas', 25, 0.93),
    ('33333333-0000-0000-0000-000000000001', 'capacitacion', 'Capacitación 50 funcionarios', '3 módulos presenciales', 30, 0.94);
  end if;
end $seed$;

insert into timelines (id, document_id, title) values
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   'Cronograma Sistema de Gestión Municipal')
on conflict do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from milestones where timeline_id = '55555555-0000-0000-0000-000000000001') then
  insert into milestones (timeline_id, milestone_type, title, starts_on, ends_on, sort_order) values
    ('55555555-0000-0000-0000-000000000001', 'inicio', 'Firma de contrato e inicio', '2026-05-01', '2026-05-01', 0),
    ('55555555-0000-0000-0000-000000000001', 'implementacion', 'Implementación módulos core', '2026-05-02', '2026-09-30', 1),
    ('55555555-0000-0000-0000-000000000001', 'capacitacion', 'Capacitación funcionarios', '2026-09-01', '2026-10-15', 2),
    ('55555555-0000-0000-0000-000000000001', 'marcha_blanca', 'Marcha blanca', '2026-10-16', '2026-12-15', 3),
    ('55555555-0000-0000-0000-000000000001', 'recepcion', 'Recepción conforme', '2026-12-20', '2026-12-20', 4),
    ('55555555-0000-0000-0000-000000000001', 'garantia', 'Período de garantía', '2026-12-21', '2027-12-20', 5),
    ('55555555-0000-0000-0000-000000000001', 'soporte', 'Soporte y mantención', '2026-12-21', '2028-04-30', 6),
    ('55555555-0000-0000-0000-000000000001', 'termino', 'Término de contrato', '2028-04-30', '2028-04-30', 7);
  end if;
end $seed$;

-- Documento de control interno de entregas (lo realmente entregado)
insert into documents (id, organization_id, client_id, title, doc_type, status,
  tender_number, doc_date, country, language)
values (
  '33333333-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '22222222-0000-0000-0000-000000000001',
  'Control Interno de Entregas — SGM Puerto Montt',
  'control_entregas', 'procesado',
  '2397-45-LR26', '2026-07-28', 'Chile', 'es'
)
on conflict (id) do nothing;

insert into document_versions (id, document_id, version, is_current) values
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 1, true)
on conflict do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from delivered_items where document_id = '33333333-0000-0000-0000-000000000002') then
  insert into delivered_items (document_id, title, description, delivered_on, delivery_state,
    is_additional, is_free, requirement_ref, page, confidence) values
    ('33333333-0000-0000-0000-000000000002', 'Módulo de Rentas y Patentes',
     'En producción, recepcionado conforme', '2026-06-15', 'entregado', false, false, 'RQ-001', 4, 0.97),
    ('33333333-0000-0000-0000-000000000002', 'Firma electrónica avanzada',
     'FEA operativa integrada con E-Sign', '2026-07-01', 'entregado', false, false, 'RQ-003', 6, 0.95),
    ('33333333-0000-0000-0000-000000000002', 'Tableros Power BI de Rentas',
     'Publicados; pendientes los de Circulación', '2026-07-10', 'en_progreso', false, false, 'RQ-004', 7, 0.9),
    ('33333333-0000-0000-0000-000000000002', 'Capacitación 52 funcionarios',
     'Superó la meta de 50; asistencia firmada', '2026-07-20', 'entregado', false, false, 'RQ-005', 9, 0.96),
    ('33333333-0000-0000-0000-000000000002', 'Portal de pagos Webpay',
     'Pasarela de pagos no exigida en bases, habilitada sin costo', '2026-07-05', 'entregado', true, true, null, 10, 0.94),
    ('33333333-0000-0000-0000-000000000002', 'Notificaciones por WhatsApp',
     'Avisos de vencimiento de patentes; mejora de cortesía sin costo', '2026-07-18', 'entregado', true, true, null, 11, 0.92);
  end if;
end $seed$;

-- Archivar los documentos demo en la carpeta del proyecto
update documents set project_id = '66666666-0000-0000-0000-000000000001'
where id in ('33333333-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002');

insert into tags (organization_id, name, color) values
  ('11111111-1111-1111-1111-111111111111', 'urgente', '#ef4444'),
  ('11111111-1111-1111-1111-111111111111', 'en-evaluacion', '#f59e0b'),
  ('11111111-1111-1111-1111-111111111111', 'adjudicada', '#22c55e')
on conflict do nothing;

-- NOTA: para vincular tu usuario de Auth a la organización demo:
--   insert into profiles (id, organization_id, email, full_name, role)
--   values ('<TU-AUTH-UUID>', '11111111-1111-1111-1111-111111111111',
--           '<tu-email>', 'Administrador Demo', 'admin');
