-- =====================================================================
-- seed.sql
-- Datos demo realistas para que los dashboards tengan informacion desde
-- el minuto cero (§87, §88).
--
-- IMPORTANTE
-- ----------
-- Estos datos son SEMILLA DE DESARROLLO, no datos hardcodeados en el
-- frontend. Se cargan en PostgreSQL y viajan por el mismo camino que
-- cualquier dato real: triggers, calculos, RLS y vistas.
--
-- Ejecutar: supabase db reset   (o psql -f supabase/seed.sql)
-- Es idempotente: usa UUIDs deterministas + ON CONFLICT DO NOTHING.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. USUARIOS
-- Password de todos los usuarios demo: Padel2026!
-- ---------------------------------------------------------------------
-- Los 4 campos "*_token"/"email_change" van con '' explicito, no NULL.
-- GoTrue lee estas columnas en un tipo que no admite NULL: si quedan en
-- NULL (el default de la tabla cuando no se listan en el INSERT), la
-- lectura del usuario truena del lado de GoTrue con 500
-- "unexpected_failure" al iniciar sesion -- no es un rechazo de
-- credenciales, es una lectura que nunca llega a comparar la contrasena.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000001','authenticated','authenticated',
   'ernesto@padelbusiness.com',  crypt('Padel2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ernesto Sodom"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000002','authenticated','authenticated',
   'comercial@padelbusiness.com', crypt('Padel2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Laura Fernandez"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000003','authenticated','authenticated',
   'operaciones@padelbusiness.com', crypt('Padel2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Marco Rossi"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000004','authenticated','authenticated',
   'finanzas@padelbusiness.com', crypt('Padel2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Molina"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Repara instalaciones ya sembradas antes de este fix, donde esas
-- columnas quedaron en NULL.
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, '')
 where id::text like 'b0000000-%';

-- Sin esto, `signInWithPassword` devuelve 400 "Invalid login credentials"
-- aunque el usuario y el hash de la contrasena sean correctos: GoTrue
-- exige una fila en auth.identities que vincule el proveedor "email" a
-- cada usuario. `insert into auth.users` sola no la crea.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now(), now()
from auth.users u
where u.id::text like 'b0000000-%'
on conflict (provider_id, provider) do nothing;

-- El trigger on_auth_user_created ya creo los perfiles; ajustamos datos.
insert into public.profiles (id, email, full_name, active)
select id, email, raw_user_meta_data->>'full_name', true from auth.users
where id::text like 'b0000000-%'
on conflict (id) do nothing;

update public.profiles set is_super_admin = true, job_title = 'Direccion General'
 where id = 'b0000000-0000-4000-8000-000000000001';
update public.profiles set job_title = 'Responsable Comercial'
 where id = 'b0000000-0000-4000-8000-000000000002';
update public.profiles set job_title = 'Jefe de Operaciones'
 where id = 'b0000000-0000-4000-8000-000000000003';
update public.profiles set job_title = 'Controller Financiero'
 where id = 'b0000000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------
-- 2. ACCESOS POR PROYECTO (§12)
-- ---------------------------------------------------------------------
insert into public.user_project_access (user_id, project_id, role_id, is_default, active)
select u.id, p.id, r.id, m.is_default, true
from (values
  ('b0000000-0000-4000-8000-000000000001','EUROPA',      'ADMIN',       true),
  ('b0000000-0000-4000-8000-000000000001','ATILA',       'ADMIN',       false),
  ('b0000000-0000-4000-8000-000000000001','VENTA_USADAS','ADMIN',       false),
  ('b0000000-0000-4000-8000-000000000002','EUROPA',      'COMERCIAL',   true),
  ('b0000000-0000-4000-8000-000000000002','VENTA_USADAS','COMERCIAL',   false),
  ('b0000000-0000-4000-8000-000000000003','EUROPA',      'OPERACIONES', true),
  ('b0000000-0000-4000-8000-000000000003','ATILA',       'LECTURA',     false),
  ('b0000000-0000-4000-8000-000000000004','EUROPA',      'FINANZAS',    true)
) as m(user_id, project_code, role_code, is_default)
join auth.users u    on u.id = m.user_id::uuid
join public.projects p on p.code = m.project_code
join public.roles r   on r.code = m.role_code
on conflict (user_id, project_id) do nothing;

-- A partir de aqui operamos como el usuario ADMIN para que la auditoria,
-- el timeline y las funciones de negocio registren un autor real.
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- ---------------------------------------------------------------------
-- 3. TIPOS DE CAMBIO (§37)
-- ---------------------------------------------------------------------
insert into public.exchange_rates (base_currency, quote_currency, rate, rate_date, source) values
  ('EUR','USD', 1.08500000, current_date - 1, 'ECB'),
  ('EUR','ARS', 1180.00000000, current_date - 1, 'BCRA'),
  ('EUR','CLP', 1010.00000000, current_date - 1, 'BCCH'),
  ('USD','ARS', 1087.00000000, current_date - 1, 'BCRA')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. MATERIALES Y PROVEEDORES
-- ---------------------------------------------------------------------
insert into public.materials (id, project_id, code, name, category, unit, standard_cost, currency, stock_quantity, min_stock, lead_time_days) values
  ('d0000000-0000-4000-8000-000000000001', null, 'PERF-80x80', 'Perfil estructural 80x80 mm',  'FIERRO',      'M',  18.5000, 'EUR', 1200, 400, 21),
  ('d0000000-0000-4000-8000-000000000002', null, 'PERF-60x60', 'Perfil estructural 60x60 mm',  'FIERRO',      'M',  13.2000, 'EUR',  900, 300, 21),
  ('d0000000-0000-4000-8000-000000000003', null, 'VID-12MM',   'Vidrio templado 12 mm 2x3 m',  'VIDRIO',      'UN', 210.0000,'EUR',   60,  20, 35),
  ('d0000000-0000-4000-8000-000000000004', null, 'MALLA-4MM',  'Malla electrosoldada 4 mm',    'MALLA',       'M2',  22.0000,'EUR',  400, 150, 20),
  ('d0000000-0000-4000-8000-000000000005', null, 'CESP-12MM',  'Cesped artificial 12 mm',      'CESPED',      'M2',  11.5000,'EUR', 1500, 500, 30),
  ('d0000000-0000-4000-8000-000000000006', null, 'TORN-KIT',   'Kit tornilleria inox cancha',  'TORNILLERIA', 'UN', 340.0000,'EUR',   25,  10, 15),
  ('d0000000-0000-4000-8000-000000000007', null, 'LED-200W',   'Proyector LED 200W',           'ILUMINACION', 'UN', 145.0000,'EUR',   48,  16, 25),
  ('d0000000-0000-4000-8000-000000000008', null, 'GALV-SERV',  'Servicio de galvanizado',      'GALVANIZADO', 'KG',   1.4500,'EUR',    0,   0, 10)
on conflict do nothing;

insert into public.suppliers (id, project_id, company_name, tax_id, country, city, contact_name, email, phone, category, currency, status, payment_terms) values
  ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Aceros del Norte S.L.','B12345678','ES','Bilbao','Iker Zubizarreta','ventas@acerosnorte.es','+34 944 000 111','FIERRO','EUR','ACTIVO','60 dias'),
  ('e0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Galvanizados Ebro S.A.','A87654321','ES','Zaragoza','Pilar Sanz','info@galvaebro.es','+34 976 000 222','GALVANIZADO','EUR','ACTIVO','30 dias'),
  ('e0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','Cristaleria Mediterranea','B55512345','ES','Valencia','Jordi Ferrer','pedidos@cristalmed.es','+34 963 000 333','VIDRIO','EUR','ACTIVO','45 dias'),
  ('e0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','TransEuro Logistics BV','NL998877','NL','Rotterdam','Peter de Vries','ops@transeuro.nl','+31 10 000 444','LOGISTICA','EUR','ACTIVO','Contado'),
  ('e0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000003','Desmontajes Iberia S.L.','B44433322','ES','Madrid','Raul Nunez','info@desmontajesiberia.es','+34 915 000 555','SERVICIOS','EUR','ACTIVO','30 dias')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. BANCOS
-- ---------------------------------------------------------------------
insert into public.bank_accounts (id, project_id, name, bank_name, iban, currency, opening_balance) values
  ('f0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Cuenta operativa EUR','Banco Santander','ES9121000418450200051332','EUR', 85000.00),
  ('f0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Cuenta USD export','BBVA','ES7620770024003102575766','USD', 24000.00),
  ('f0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','Cuenta usadas','CaixaBank','ES1000492352082414205416','EUR', 31000.00)
on conflict do nothing;

-- =====================================================================
-- PROYECTO EUROPA
-- =====================================================================

-- 5 clientes (§87)
insert into public.clients (id, project_id, company_name, legal_name, tax_id, country, city, address, postal_code, website, industry, status, source, owner_user_id, preferred_currency, payment_terms) values
  ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Club Padel Madrid','Club Padel Madrid S.L.','B81234567','ES','Madrid','Calle Alcala 234','28027','clubpadelmadrid.es','CLUB_DEPORTIVO','ACTIVO','REFERIDO','b0000000-0000-4000-8000-000000000002','EUR','30% anticipo / 70% entrega'),
  ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Padel Indoor Lisboa','Padel Indoor Lisboa Lda','PT509876543','PT','Lisboa','Av. da Liberdade 110','1250-146','padelindoor.pt','CLUB_DEPORTIVO','ACTIVO','WEB','b0000000-0000-4000-8000-000000000002','EUR','50/50'),
  ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','Milano Padel Center','Milano Padel Center S.r.l.','IT09876543210','IT','Milano','Via Torino 45','20123','milanopadel.it','CLUB_DEPORTIVO','ACTIVO','FERIA','b0000000-0000-4000-8000-000000000002','EUR','40% / 60%'),
  ('c0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','Racket Club Lyon','Racket Club Lyon SARL','FR40123456824','FR','Lyon','12 Rue de la Republique','69002','racketlyon.fr','CLUB_DEPORTIVO','CALIFICADO','CAMPANA','b0000000-0000-4000-8000-000000000002','EUR','Contra entrega'),
  ('c0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','Sportzentrum Munchen','Sportzentrum Munchen GmbH','DE811234567','DE','Munchen','Leopoldstrasse 88','80802','sportzentrum-m.de','CENTRO_DEPORTIVO','PROSPECTO','WEB','b0000000-0000-4000-8000-000000000002','EUR',null)
on conflict do nothing;

insert into public.contacts (project_id, client_id, first_name, last_name, position, email, phone, is_primary) values
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Javier','Ruiz','Director deportivo','javier.ruiz@clubpadelmadrid.es','+34 600 111 222', true),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Sofia','Almeida','Gerente','sofia@padelindoor.pt','+351 910 222 333', true),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','Luca','Bianchi','Owner','luca@milanopadel.it','+39 340 333 444', true),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','Camille','Dubois','Directrice','camille@racketlyon.fr','+33 6 44 55 66 77', true),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','Stefan','Weber','Geschaftsfuhrer','s.weber@sportzentrum-m.de','+49 170 5556677', true)
on conflict do nothing;

-- 15 oportunidades (§87)
insert into public.opportunities (id, project_id, client_id, owner_user_id, name, estimated_courts, estimated_amount, currency, probability, expected_close_date, status, source, next_action, next_action_date) values
  ('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','Ampliacion 4 canchas Madrid',      4, 48000, 'EUR', 100, current_date - 30, 'GANADA',      'REFERIDO','Cerrada',                    null),
  ('a1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Padel Indoor Lisboa fase 1',       2, 24000, 'EUR', 100, current_date - 20, 'GANADA',      'WEB','Cerrada',                        null),
  ('a1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Milano Padel Center 6 canchas',    6, 72000, 'EUR',  80, current_date + 25, 'NEGOCIACION', 'FERIA','Enviar contrato revisado',      current_date + 3),
  ('a1000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Racket Club Lyon 3 canchas',       3, 36000, 'EUR',  60, current_date + 40, 'COTIZADA',    'CAMPANA','Llamada de seguimiento',      current_date - 2),
  ('a1000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','Sportzentrum Munchen piloto',      2, 25000, 'EUR',  30, current_date + 60, 'CALIFICANDO', 'WEB','Agendar visita tecnica',         current_date + 7),
  ('a1000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','Iluminacion LED Madrid',           0,  9500, 'EUR',  70, current_date + 15, 'COTIZADA',    'REFERIDO','Confirmar presupuesto',       current_date + 2),
  ('a1000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Lisboa fase 2',                    3, 36000, 'EUR',  50, current_date + 75, 'REUNION',     'REFERIDO','Preparar propuesta fase 2',    current_date + 10),
  ('a1000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Milano cubierta panoramica',       2, 30000, 'EUR',  40, current_date + 90, 'CALIFICANDO', 'FERIA','Enviar fichas tecnicas',        current_date + 5),
  ('a1000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Lyon mantenimiento anual',         0,  6000, 'EUR',  55, current_date + 30, 'COTIZADA',    'WEB','Ajustar alcance',                current_date + 6),
  ('a1000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','Munchen ampliacion 4 canchas',     4, 50000, 'EUR',  20, current_date + 120,'NUEVA',       'CAMPANA','Primer contacto tecnico',      current_date + 14),
  ('a1000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','Madrid cesped premium',            0, 12000, 'EUR',  65, current_date + 20, 'NEGOCIACION', 'REFERIDO','Cerrar condiciones',           current_date + 1),
  ('a1000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Lisboa accesorios',                0,  4500, 'EUR',  75, current_date + 12, 'COTIZADA',    'WEB','Confirmar stock',                current_date + 4),
  ('a1000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Milano fase 3 (2027)',             8, 96000, 'EUR',  15, current_date + 180,'NUEVA',       'FERIA','Mantener contacto trimestral',  current_date + 45),
  ('a1000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Lyon 2 canchas outdoor',           2, 23000, 'EUR',  35, current_date + 70, 'REUNION',     'CAMPANA','Visita a terreno',             current_date + 9),
  ('a1000000-0000-4000-8000-000000000015','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','Munchen padel corporativo',        0, 15000, 'EUR',  10, current_date + 150,'ARCHIVADA',   'WEB',null, null)
on conflict do nothing;

-- Actividades, reuniones y seguimientos
insert into public.commercial_activities (project_id, client_id, opportunity_id, user_id, activity_type, activity_date, subject, description, result, next_action, next_action_date) values
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','REUNION',   now() - interval '45 days','Reunion tecnica ampliacion','Revision de plano y ubicacion de las 4 canchas.','Positivo, piden cotizacion formal.','Enviar cotizacion', current_date - 40),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','COTIZACION',now() - interval '40 days','Cotizacion 4 canchas','Cotizacion 48.000 EUR incluyendo transporte e instalacion.','Aceptada','Firmar contrato', current_date - 32),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','LLAMADA',   now() - interval '5 days', 'Negociacion condiciones','Discusion de plazo de pago y penalizaciones.','Piden 45 dias','Enviar contrato revisado', current_date + 3),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','EMAIL',     now() - interval '12 days','Envio de cotizacion Lyon','3 canchas modelo Panoramica.','Sin respuesta','Llamar', current_date - 2)
on conflict do nothing;

insert into public.meetings (project_id, client_id, opportunity_id, responsible_user_id, meeting_date, start_time, end_time, meeting_type, status, objective, summary, agreements, next_steps, next_followup_date) values
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002', current_date + 3, '10:00','11:00','VIDEOLLAMADA','CONFIRMADA','Cerrar negociacion 6 canchas',null,null,'Presentar contrato final', current_date + 5),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002', current_date + 7, '15:30','16:30','PRESENCIAL','PLANIFICADA','Visita tecnica Munchen',null,null,'Medicion de terreno', current_date + 10),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002', current_date - 45,'09:00','10:30','PRESENCIAL','REALIZADA','Reunion tecnica','Se acordo la distribucion de canchas.','Ampliacion de 4 canchas','Enviar cotizacion', current_date - 40)
on conflict do nothing;

insert into public.follow_ups (project_id, client_id, opportunity_id, responsible_user_id, title, description, due_date, priority, status) values
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Llamar a Racket Club Lyon','Cotizacion enviada hace 12 dias sin respuesta.', current_date - 2, 'ALTA','PENDIENTE'),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','Preparar visita tecnica Munchen','Coordinar agenda y medicion.', current_date + 4, 'MEDIA','PENDIENTE'),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Enviar contrato revisado Milano','Incluir plazo de 45 dias.', current_date + 1, 'CRITICA','PENDIENTE'),
  ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000002','Propuesta fase 2 Lisboa','Preparar propuesta economica.', current_date - 6, 'ALTA','PENDIENTE')
on conflict do nothing;

-- =====================================================================
-- CASO DE NEGOCIO §101: VENTA DE 4 CANCHAS POR 48.000 EUR
-- =====================================================================
insert into public.sales (id, project_id, client_id, opportunity_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, payment_terms, incoterm, delivery_address, delivery_country, delivery_city)
values ('5a000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
        'EUROPA-2026-0001', current_date - 32, 'COMPROMETIDA','EUR', 0, current_date + 25,
        '30% anticipo / 70% contra entrega','DAP','Calle Alcala 234','ES','Madrid')
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost, sort_order) values
  ('5a000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','CANCHA_NUEVA','Cancha de padel panoramica 20x10','PANORAMICA-PRO', 4, 10500, 6500, 10),
  ('5a000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','TRANSPORTE','Transporte terrestre Espana', null, 1, 2400, 2000, 20),
  ('5a000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','INSTALACION','Instalacion y puesta en marcha', null, 1, 3600, 3000, 30)
on conflict do nothing;
-- subtotal = 42.000 + 2.400 + 3.600 = 48.000 EUR

-- Confirmar la venta ejecutando la funcion real de negocio:
-- crea 4 canchas, el proyecto de fabricacion, los costos estimados y los checklists.
select public.confirm_sale('5a000000-0000-4000-8000-000000000001', true, current_date + 25);

-- Costos reales que llegan durante la ejecucion (§101: real 32.500)
update public.sale_costs set actual_amount = estimated_amount, status = 'DEVENGADO'
 where sale_id = '5a000000-0000-4000-8000-000000000001';

insert into public.sale_costs (project_id, sale_id, cost_category_id, description, estimated_amount, actual_amount, currency, supplier_id, cost_date, status)
select 'a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001',
       (select id from public.cost_categories where code = 'GALVANIZADO' and project_id is null),
       'Sobrecosto de galvanizado (subida de tarifa)', 0, 1500, 'EUR',
       'e0000000-0000-4000-8000-000000000002', current_date - 5, 'DEVENGADO'
on conflict do nothing;
-- estimado 31.000 (26.000 canchas + 2.000 transporte + 3.000 instalacion)
-- + 1.500 de sobrecosto real -> costo real 32.500, margen real 15.500

-- Factura al cliente y cobro parcial (§101)
insert into public.invoices (id, project_id, kind, invoice_number, invoice_date, due_date, status, currency, tax_rate, client_id, sale_id)
values ('11000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','VENTA','FV-EUROPA-2026-0001',
        current_date - 28, current_date + 2, 'EMITIDA','EUR', 0,
        'c0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.invoice_items (project_id, invoice_id, description, quantity, unit_price) values
  ('a0000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','4 canchas panoramicas + transporte + instalacion', 1, 48000)
on conflict do nothing;

insert into public.payments (project_id, direction, payment_date, amount, currency, method, reference, invoice_id, sale_id, client_id, bank_account_id)
values ('a0000000-0000-4000-8000-000000000001','ENTRADA', current_date - 27, 20000, 'EUR','TRANSFERENCIA','ANTICIPO 30%',
        '11000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001')
on conflict do nothing;
-- Saldo por cobrar: 28.000 EUR

insert into public.contracts (project_id, client_id, sale_id, contract_number, title, contract_date, start_date, end_date, amount, currency, payment_terms, warranty_terms, penalty_terms, status, signed_at, signed_by_client)
values ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001',
        'CTR-EUROPA-2026-0001','Suministro e instalacion de 4 canchas de padel',
        current_date - 32, current_date - 32, current_date + 390, 48000,'EUR',
        '30% anticipo / 70% contra entrega','2 anos estructura, 1 ano vidrios','0,5% semanal por retraso, tope 5%',
        'VIGENTE', now() - interval '32 days','Javier Ruiz')
on conflict do nothing;

-- =====================================================================
-- CASO DE NEGOCIO §102: 2 CANCHAS POR 24.000 EUR
-- Una entregada + una en transito -> PARCIALMENTE_ENTREGADA
-- =====================================================================
insert into public.sales (id, project_id, client_id, opportunity_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, payment_terms, delivery_country, delivery_city)
values ('5a000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',
        'EUROPA-2026-0002', current_date - 60, 'COMPROMETIDA','EUR', 0, current_date - 5, '50/50','PT','Lisboa')
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost) values
  ('5a000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','CANCHA_NUEVA','Cancha de padel muro 20x10','MURO-STD', 2, 12000, 7300)
on conflict do nothing;

select public.confirm_sale('5a000000-0000-4000-8000-000000000002', true, current_date - 5);

update public.sale_costs set actual_amount = round(estimated_amount * 1.04, 2), status = 'DEVENGADO'
 where sale_id = '5a000000-0000-4000-8000-000000000002';

-- Una cancha entregada, la otra en transito
with c as (
  select id, row_number() over (order by court_number) as rn
    from public.courts where sale_id = '5a000000-0000-4000-8000-000000000002'
)
update public.courts t
   set status = case when c.rn = 1 then 'ENTREGADA'::court_status else 'EN_TRANSITO'::court_status end
  from c where t.id = c.id;

insert into public.invoices (id, project_id, kind, invoice_number, invoice_date, due_date, status, currency, tax_rate, client_id, sale_id)
values ('11000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','VENTA','FV-EUROPA-2026-0002',
        current_date - 55, current_date - 25, 'EMITIDA','EUR', 0,
        'c0000000-0000-4000-8000-000000000002','5a000000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.invoice_items (project_id, invoice_id, description, quantity, unit_price) values
  ('a0000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','2 canchas modelo muro', 1, 24000)
on conflict do nothing;

insert into public.payments (project_id, direction, payment_date, amount, currency, method, reference, invoice_id, sale_id, client_id, bank_account_id)
values ('a0000000-0000-4000-8000-000000000001','ENTRADA', current_date - 50, 12000,'EUR','TRANSFERENCIA','50% inicial',
        '11000000-0000-4000-8000-000000000002','5a000000-0000-4000-8000-000000000002',
        'c0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001')
on conflict do nothing;
-- Factura vencida con saldo 12.000 -> alimenta la alerta FACTURA_VENCIDA

-- ---------------------------------------------------------------------
-- 3 ventas mas en EUROPA (total 5, §87)
-- ---------------------------------------------------------------------
insert into public.sales (id, project_id, client_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, delivery_country, delivery_city) values
  ('5a000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','EUROPA-2026-0003', current_date - 15,'COTIZACION','EUR',0, current_date + 75,'IT','Milano'),
  ('5a000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','EUROPA-2026-0004', current_date - 90,'COMPROMETIDA','EUR',0, current_date - 20,'FR','Lyon'),
  ('5a000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','EUROPA-2026-0005', current_date - 3, 'BORRADOR','EUR',0, current_date + 120,'ES','Madrid')
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost) values
  ('5a000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','CANCHA_NUEVA','Cancha panoramica 20x10','PANORAMICA-PRO', 6, 12000, 7100),
  ('5a000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','CANCHA_NUEVA','Cancha panoramica 20x10','PANORAMICA-PRO', 3, 11500, 7000),
  ('5a000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','ACCESORIOS','Cesped premium + redes', null, 1, 12000, 8200)
on conflict do nothing;

-- La venta 0004 se confirma y queda ATRASADA (delivery_date pasada) -> alerta
select public.confirm_sale('5a000000-0000-4000-8000-000000000004', true, current_date - 20);
update public.sale_costs set actual_amount = round(estimated_amount * 1.18, 2), status = 'DEVENGADO'
 where sale_id = '5a000000-0000-4000-8000-000000000004';
-- +18% de desviacion -> alerta COSTO_EXCEDIDO y margen bajo

-- ---------------------------------------------------------------------
-- Fabricacion: avance de las canchas de la venta 0001
-- ---------------------------------------------------------------------
with c as (
  select id, row_number() over (order by court_number) as rn
    from public.courts where sale_id = '5a000000-0000-4000-8000-000000000001'
)
update public.courts t
   set status = (array['GALVANIZADO_TERMINADO','EMBALADA','EN_CONSTRUCCION','EN_CONSTRUCCION'])[c.rn]::court_status
  from c where t.id = c.id;

update public.manufacturing_projects
   set status = 'EN_CONSTRUCCION', start_date = current_date - 25
 where sale_id = '5a000000-0000-4000-8000-000000000001';

-- Proyecto de fabricacion atrasado -> alerta FABRICACION_ATRASADA
update public.manufacturing_projects
   set status = 'EN_CONSTRUCCION', estimated_completion_date = current_date - 12
 where sale_id = '5a000000-0000-4000-8000-000000000004';

-- Requerimientos de material (uno con faltante -> alerta MATERIAL_FALTANTE)
insert into public.material_requirements (project_id, manufacturing_project_id, sale_id, material_id, quantity_required, quantity_available, quantity_purchased, needed_by_date, estimated_unit_cost, currency)
select 'a0000000-0000-4000-8000-000000000001', mp.id, mp.sale_id, m.material_id, m.req, m.avail, m.purch, current_date + m.days, m.cost, 'EUR'
from public.manufacturing_projects mp
cross join (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 480, 300, 100, 10, 18.50),
  ('d0000000-0000-4000-8000-000000000003'::uuid,  64,  40,  24, 20, 210.00),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 800, 800,   0, 30, 11.50),
  ('d0000000-0000-4000-8000-000000000006'::uuid,   4,   1,   0,  5, 340.00)
) as m(material_id, req, avail, purch, days, cost)
where mp.sale_id = '5a000000-0000-4000-8000-000000000001'
on conflict do nothing;

-- Ordenes de compra y factura de proveedor
insert into public.purchase_orders (id, project_id, supplier_id, manufacturing_project_id, sale_id, po_number, order_date, expected_delivery_date, status, currency, tax_rate, approved_by, approved_at)
select '90000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001',
       mp.id, mp.sale_id, 'OC-EUROPA-2026-0001', current_date - 20, current_date + 1, 'APROBADA','EUR', 21,
       'b0000000-0000-4000-8000-000000000003', now() - interval '19 days'
from public.manufacturing_projects mp
where mp.sale_id = '5a000000-0000-4000-8000-000000000001'
on conflict do nothing;

insert into public.purchase_order_items (project_id, purchase_order_id, material_id, description, quantity, unit, unit_price) values
  ('a0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Perfil estructural 80x80', 180,'M', 18.50),
  ('a0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','Vidrio templado 12mm', 24,'UN', 205.00)
on conflict do nothing;

insert into public.invoices (id, project_id, kind, invoice_number, external_number, invoice_date, due_date, status, currency, tax_rate, supplier_id, purchase_order_id)
values ('11000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','COMPRA','FC-EUROPA-2026-0001','2026/A/4471',
        current_date - 10, current_date + 20, 'EMITIDA','EUR', 21,
        'e0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.invoice_items (project_id, invoice_id, description, quantity, unit_price) values
  ('a0000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','Suministro de acero estructural y vidrio', 1, 8250.00)
on conflict do nothing;

-- Gastos
insert into public.expenses (project_id, cost_category_id, sale_id, description, expense_date, amount, currency, status, bank_account_id)
select 'a0000000-0000-4000-8000-000000000001',
       (select id from public.cost_categories where code = c.code and project_id is null),
       c.sale_id, c.descr, current_date - c.days, c.amount, 'EUR','PAGADO','f0000000-0000-4000-8000-000000000001'
from (values
  ('VIAJES',     '5a000000-0000-4000-8000-000000000001'::uuid,'Viaje comercial Madrid',            35,  620.00),
  ('MARKETING',  null::uuid,                                   'Stand feria padel Barcelona',       50, 4800.00),
  ('TRASLADOS',  '5a000000-0000-4000-8000-000000000002'::uuid,'Traslados equipo instalacion Lisboa',30, 1150.00),
  ('ALOJAMIENTO','5a000000-0000-4000-8000-000000000002'::uuid,'Alojamiento equipo Lisboa',          30, 1890.00)
) as c(code, sale_id, descr, days, amount)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Logistica: 3 embarques (§87)
-- ---------------------------------------------------------------------
insert into public.shipments (id, project_id, sale_id, client_id, shipment_number, transport_mode, origin, origin_country, destination, destination_country, carrier, forwarder, container_number, booking_number, bl_number, incoterm, departure_date, estimated_arrival, actual_arrival, customs_status, status, freight_cost, insurance_cost, customs_cost, currency) values
  ('70000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','SH-EUROPA-2026-0001','TERRESTRE','Valencia','ES','Lisboa','PT','TransEuro','TransEuro Logistics',null,'BK-77120',null,'DAP', current_date - 12, current_date - 6, null,'NO_APLICA','EN_TRANSITO', 2100, 180, 0,'EUR'),
  ('70000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','SH-EUROPA-2026-0002','TERRESTRE','Valencia','ES','Madrid','ES','TransEuro','TransEuro Logistics',null,'BK-77455',null,'DAP', current_date + 5, current_date + 7, null,'NO_APLICA','PLANIFICADO', 1400, 120, 0,'EUR'),
  ('70000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000004','SH-EUROPA-2026-0003','MARITIMO','Valencia','ES','Marsella','FR','MSC','TransEuro Logistics','MSCU7741208','BK-76001','MSCUBL55120','CIF', current_date - 40, current_date - 30, current_date - 28,'LIBERADO','ENTREGADO', 3200, 410, 890,'EUR')
on conflict do nothing;

insert into public.shipment_items (project_id, shipment_id, court_id, description, packages, gross_weight_kg, volume_m3)
select 'a0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001', c.id, 'Cancha modelo muro', 6, 3200, 22.5
from public.courts c where c.sale_id = '5a000000-0000-4000-8000-000000000002'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Instalaciones: 3 (§87)
-- ---------------------------------------------------------------------
insert into public.installations (id, project_id, sale_id, client_id, shipment_id, installation_number, name, address, city, country, responsible_user_id, crew, planned_start_date, planned_end_date, actual_start_date, actual_end_date, status, received_at, received_by_name) values
  ('80000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','INS-EUROPA-2026-0001','Instalacion Lisboa fase 1','Av. da Liberdade 110','Lisboa','PT','b0000000-0000-4000-8000-000000000003','[{"name":"Equipo A","role":"Montaje"}]', current_date - 4, current_date + 2, current_date - 4, null,'EN_CURSO', null, null),
  ('80000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','INS-EUROPA-2026-0002','Instalacion Madrid ampliacion','Calle Alcala 234','Madrid','ES','b0000000-0000-4000-8000-000000000003','[{"name":"Equipo B","role":"Montaje"}]', current_date + 8, current_date + 14, null, null,'PLANIFICADA', null, null),
  ('80000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000003','INS-EUROPA-2026-0003','Instalacion Lyon','12 Rue de la Republique','Lyon','FR','b0000000-0000-4000-8000-000000000003','[{"name":"Equipo A","role":"Montaje"}]', current_date - 25, current_date - 18, current_date - 25, current_date - 19,'TERMINADA', null, null)
on conflict do nothing;

insert into public.installation_courts (project_id, installation_id, court_id)
select 'a0000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001', c.id
from public.courts c where c.sale_id = '5a000000-0000-4000-8000-000000000002'
on conflict do nothing;

-- Control de calidad
insert into public.quality_checks (project_id, manufacturing_project_id, court_id, check_type, check_date, responsible_user_id, result, score, observations)
select 'a0000000-0000-4000-8000-000000000001', c.manufacturing_project_id, c.id, 'GALVANIZADO', current_date - 6,
       'b0000000-0000-4000-8000-000000000003','APROBADO', 96,'Espesor de recubrimiento conforme a norma.'
from public.courts c
where c.sale_id = '5a000000-0000-4000-8000-000000000001' and c.status = 'GALVANIZADO_TERMINADO'
on conflict do nothing;

-- =====================================================================
-- PROYECTO ATILA (§87: 3 clientes, 5 oportunidades, 2 ventas)
-- =====================================================================
insert into public.clients (id, project_id, company_name, tax_id, country, city, status, source, owner_user_id, preferred_currency) values
  ('c0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002','Atila Padel Buenos Aires','30712345678','AR','Buenos Aires','ACTIVO','REFERIDO','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000002','Rosario Padel Club','30798765432','AR','Rosario','ACTIVO','WEB','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000002','Cordoba Sports SA','30755544433','AR','Cordoba','PROSPECTO','FERIA','b0000000-0000-4000-8000-000000000002','EUR')
on conflict do nothing;

insert into public.opportunities (id, project_id, client_id, owner_user_id, name, estimated_courts, estimated_amount, currency, probability, expected_close_date, status, next_action, next_action_date) values
  ('a1000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000002','Atila BA 3 canchas',      3, 33000,'EUR',100, current_date - 10,'GANADA', null, null),
  ('a1000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000012','b0000000-0000-4000-8000-000000000002','Rosario 2 canchas',       2, 21000,'EUR',100, current_date - 5, 'GANADA', null, null),
  ('a1000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000013','b0000000-0000-4000-8000-000000000002','Cordoba complejo 4 canchas',4,44000,'EUR', 45, current_date + 45,'NEGOCIACION','Enviar propuesta', current_date + 5),
  ('a1000000-0000-4000-8000-000000000024','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000002','Atila BA iluminacion',    0,  7800,'EUR', 65, current_date + 20,'COTIZADA','Confirmar modelo', current_date + 3),
  ('a1000000-0000-4000-8000-000000000025','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000012','b0000000-0000-4000-8000-000000000002','Rosario fase 2',          2, 22000,'EUR', 25, current_date + 100,'NUEVA','Reunion tecnica', current_date + 12)
on conflict do nothing;

insert into public.sales (id, project_id, client_id, opportunity_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, delivery_country, delivery_city) values
  ('5a000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000021','b0000000-0000-4000-8000-000000000002','ATILA-2026-0001', current_date - 10,'COMPROMETIDA','EUR',0, current_date + 50,'AR','Buenos Aires'),
  ('5a000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000022','b0000000-0000-4000-8000-000000000002','ATILA-2026-0002', current_date - 5, 'COMPROMETIDA','EUR',0, current_date + 65,'AR','Rosario')
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost) values
  ('5a000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002','CANCHA_NUEVA','Cancha panoramica','PANORAMICA-PRO', 3, 11000, 6900),
  ('5a000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000002','CANCHA_NUEVA','Cancha muro','MURO-STD', 2, 10500, 6600)
on conflict do nothing;

select public.confirm_sale('5a000000-0000-4000-8000-000000000011', true, current_date + 50);
select public.confirm_sale('5a000000-0000-4000-8000-000000000012', true, current_date + 65);

-- =====================================================================
-- PROYECTO VENTA_USADAS (§87: 10 canchas, 5 clientes, 4 oportunidades, 3 ventas)
-- Incluye el CASO §103
-- =====================================================================
insert into public.clients (id, project_id, company_name, tax_id, country, city, status, source, owner_user_id, preferred_currency) values
  ('c0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000003','Padel Low Cost Sevilla','B91111222','ES','Sevilla','ACTIVO','WEB','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000003','Club Deportivo Malaga','B92222333','ES','Malaga','ACTIVO','REFERIDO','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000003','Padel Mendoza SRL','30733322211','AR','Mendoza','ACTIVO','WEB','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000024','a0000000-0000-4000-8000-000000000003','Gimnasio Atlantico','B93333444','ES','A Coruna','CALIFICADO','LLAMADA_FRIA','b0000000-0000-4000-8000-000000000002','EUR'),
  ('c0000000-0000-4000-8000-000000000025','a0000000-0000-4000-8000-000000000003','Padel Santiago SpA','76555444-3','CL','Santiago','PROSPECTO','WEB','b0000000-0000-4000-8000-000000000002','EUR')
on conflict do nothing;

insert into public.opportunities (id, project_id, client_id, owner_user_id, name, estimated_courts, estimated_amount, currency, probability, expected_close_date, status, next_action, next_action_date) values
  ('a1000000-0000-4000-8000-000000000031','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000021','b0000000-0000-4000-8000-000000000002','Sevilla 1 cancha usada',    1,  8000,'EUR',100, current_date - 12,'GANADA', null, null),
  ('a1000000-0000-4000-8000-000000000032','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000022','b0000000-0000-4000-8000-000000000002','Malaga 2 canchas usadas',   2, 15000,'EUR',100, current_date - 6, 'GANADA', null, null),
  ('a1000000-0000-4000-8000-000000000033','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000023','b0000000-0000-4000-8000-000000000002','Mendoza 2 canchas usadas',  2, 14000,'EUR',100, current_date - 2, 'GANADA', null, null),
  ('a1000000-0000-4000-8000-000000000034','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000024','b0000000-0000-4000-8000-000000000002','A Coruna 3 canchas usadas', 3, 21000,'EUR', 50, current_date + 30,'COTIZADA','Enviar fotos del estado', current_date + 2)
on conflict do nothing;

-- Inventario de 10 canchas usadas
insert into public.courts (id, project_id, court_number, serial_number, model, court_type, year, status, current_location, country, city, purchase_cost, refurbishment_cost, sale_price, currency, physical_condition, has_lighting) values
  ('c1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','US-0001','SN-U-1001','PANORAMICA','USADA',2018,'DISPONIBLE','Almacen Madrid','ES','Madrid', 3000,  500,  8000,'EUR','BUENA',   true),
  ('c1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','US-0002','SN-U-1002','MURO','USADA',      2017,'DISPONIBLE','Almacen Madrid','ES','Madrid', 2600,  400,  7000,'EUR','REGULAR', false),
  ('c1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','US-0003','SN-U-1003','PANORAMICA','USADA',2019,'PREPARADA', 'Almacen Madrid','ES','Madrid', 3200,  900,  8500,'EUR','EXCELENTE',true),
  ('c1000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003','US-0004','SN-U-1004','MURO','USADA',      2016,'EN_REPARACION','Taller Madrid','ES','Madrid', 2200, 1100,  6800,'EUR','REGULAR', false),
  ('c1000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000003','US-0005','SN-U-1005','PANORAMICA','USADA',2020,'DISPONIBLE','Almacen Madrid','ES','Madrid', 3800,  300,  9200,'EUR','EXCELENTE',true),
  ('c1000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000003','US-0006','SN-U-1006','MURO','USADA',      2015,'EN_DESMONTAJE','Club Origen Toledo','ES','Toledo', 1800, 0,  6000,'EUR','REGULAR', false),
  ('c1000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000003','US-0007','SN-U-1007','PANORAMICA','USADA',2019,'DISPONIBLE','Almacen Madrid','ES','Madrid', 3400,  600,  8800,'EUR','BUENA',   true),
  ('c1000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000003','US-0008','SN-U-1008','MURO','USADA',      2018,'RESERVADA', 'Almacen Madrid','ES','Madrid', 2700,  500,  7200,'EUR','BUENA',   false),
  ('c1000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000003','US-0009','SN-U-1009','PANORAMICA','USADA',2021,'DISPONIBLE','Almacen Madrid','ES','Madrid', 4200,  200,  9800,'EUR','EXCELENTE',true),
  ('c1000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000003','US-0010','SN-U-1010','MURO','USADA',      2017,'DISPONIBLE','Almacen Madrid','ES','Madrid', 2500,  700,  7100,'EUR','BUENA',   false)
on conflict do nothing;

-- CASO §103: venta de 1 cancha usada por 8.000 con costos 800+600+900+1000
insert into public.sales (id, project_id, client_id, opportunity_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, delivery_country, delivery_city, confirmed_at)
values ('5a000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000031','b0000000-0000-4000-8000-000000000002',
        'VENTA_USADAS-2026-0001', current_date - 12,'CONFIRMADA','EUR',0, current_date + 10,'ES','Sevilla', now() - interval '12 days')
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost) values
  ('5a000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000003','CANCHA_USADA','Cancha usada panoramica US-0001 (2018)','PANORAMICA', 1, 8000, 3300)
on conflict do nothing;

update public.courts
   set sale_id = '5a000000-0000-4000-8000-000000000021',
       client_id = 'c0000000-0000-4000-8000-000000000021',
       status = 'EN_TRANSPORTE'
 where id = 'c1000000-0000-4000-8000-000000000001';

insert into public.sale_costs (project_id, sale_id, court_id, cost_category_id, description, estimated_amount, actual_amount, currency, cost_date, status)
select 'a0000000-0000-4000-8000-000000000003','5a000000-0000-4000-8000-000000000021','c1000000-0000-4000-8000-000000000001',
       (select id from public.cost_categories where code = x.code and project_id is null),
       x.descr, x.amount, x.amount, 'EUR', current_date - x.days, 'DEVENGADO'
from (values
  ('DESMONTAJE',  'Desmontaje en origen',  800.00, 10),
  ('REPARACION',  'Reparacion y pintura',  600.00,  8),
  ('TRANSPORTE',  'Transporte a Sevilla',  900.00,  5),
  ('INSTALACION', 'Instalacion en destino',1000.00, 3)
) as x(code, descr, amount, days)
on conflict do nothing;
-- Costo total 3.300 -> margen 4.700 (58,75%)

-- 2 ventas mas de usadas
insert into public.sales (id, project_id, client_id, opportunity_id, salesperson_id, sale_number, sale_date, status, currency, tax_rate, delivery_date, delivery_country, delivery_city, confirmed_at) values
  ('5a000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000022','a1000000-0000-4000-8000-000000000032','b0000000-0000-4000-8000-000000000002','VENTA_USADAS-2026-0002', current_date - 6, 'CONFIRMADA','EUR',0, current_date + 20,'ES','Malaga', now() - interval '6 days'),
  ('5a000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000023','a1000000-0000-4000-8000-000000000033','b0000000-0000-4000-8000-000000000002','VENTA_USADAS-2026-0003', current_date - 2, 'COMPROMETIDA','EUR',0, current_date + 40,'AR','Mendoza', null)
on conflict do nothing;

insert into public.sale_items (sale_id, project_id, product_type, description, model, quantity, unit_price, estimated_unit_cost) values
  ('5a000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000003','CANCHA_USADA','2 canchas usadas revisadas','MIXTO', 2, 7500, 3600),
  ('5a000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000003','CANCHA_USADA','2 canchas usadas Mendoza','MIXTO', 2, 7000, 3400)
on conflict do nothing;

update public.courts set sale_id = '5a000000-0000-4000-8000-000000000022', client_id = 'c0000000-0000-4000-8000-000000000022', status = 'RESERVADA'
 where id in ('c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000008');

insert into public.sale_costs (project_id, sale_id, court_id, cost_category_id, description, estimated_amount, actual_amount, currency, cost_date, status)
select 'a0000000-0000-4000-8000-000000000003','5a000000-0000-4000-8000-000000000022', null,
       (select id from public.cost_categories where code = x.code and project_id is null),
       x.descr, x.est, x.act,'EUR', current_date - 3,'DEVENGADO'
from (values
  ('REPARACION','Reparacion 2 canchas', 1800.00, 1950.00),
  ('TRANSPORTE','Transporte Malaga',    1400.00, 1400.00),
  ('INSTALACION','Instalacion Malaga',  2000.00, 0.00)
) as x(code, descr, est, act)
on conflict do nothing;

insert into public.invoices (id, project_id, kind, invoice_number, invoice_date, due_date, status, currency, tax_rate, client_id, sale_id)
values ('11000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000003','VENTA','FV-VENTA_USADAS-2026-0001',
        current_date - 11, current_date + 19,'EMITIDA','EUR',0,
        'c0000000-0000-4000-8000-000000000021','5a000000-0000-4000-8000-000000000021')
on conflict do nothing;

insert into public.invoice_items (project_id, invoice_id, description, quantity, unit_price) values
  ('a0000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000021','Cancha usada panoramica US-0001', 1, 8000)
on conflict do nothing;

insert into public.payments (project_id, direction, payment_date, amount, currency, method, reference, invoice_id, sale_id, client_id, bank_account_id)
values ('a0000000-0000-4000-8000-000000000003','ENTRADA', current_date - 10, 8000,'EUR','TRANSFERENCIA','Pago total',
        '11000000-0000-4000-8000-000000000021','5a000000-0000-4000-8000-000000000021',
        'c0000000-0000-4000-8000-000000000021','f0000000-0000-4000-8000-000000000003')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tareas abiertas
-- ---------------------------------------------------------------------
insert into public.tasks (project_id, title, description, assigned_to, related_entity_type, related_entity_id, due_date, priority, status) values
  ('a0000000-0000-4000-8000-000000000001','Reclamar saldo factura Lisboa','Saldo de 12.000 EUR vencido.','b0000000-0000-4000-8000-000000000004','INVOICE','11000000-0000-4000-8000-000000000002', current_date + 1,'CRITICA','PENDIENTE'),
  ('a0000000-0000-4000-8000-000000000001','Comprar tornilleria faltante','Faltan 3 kits para completar la fabricacion.','b0000000-0000-4000-8000-000000000003','MANUFACTURING_PROJECT', null, current_date + 3,'ALTA','PENDIENTE'),
  ('a0000000-0000-4000-8000-000000000003','Fotografiar inventario usadas','Actualizar fotos de las 6 canchas disponibles.','b0000000-0000-4000-8000-000000000002','COURT', null, current_date + 6,'MEDIA','PENDIENTE')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Ejecutar el motor de alertas para poblar el Control Center
-- ---------------------------------------------------------------------
select app.generate_alerts();

-- Snapshot de margen del caso §101
select public.snapshot_sale_margin('5a000000-0000-4000-8000-000000000001', 'CIERRE_MENSUAL');

commit;
