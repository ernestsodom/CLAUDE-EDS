-- =====================================================================
-- 017_operations.sql
-- Timeline de eventos, checklists, control de calidad, tareas,
-- alertas y notificaciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Timeline generico del negocio
-- ---------------------------------------------------------------------
create table public.project_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  entity_type   entity_type not null,
  entity_id     uuid not null,
  event_type    text not null,           -- SALE_CONFIRMED | COURT_STATUS_CHANGED | ...
  title         text not null,
  description   text,
  event_date    timestamptz not null default now(),
  user_id       uuid references public.profiles(id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.project_events is
  'Timeline unificado: alimenta las fichas de venta, cancha, cliente, fabricacion e instalacion.';

create index project_events_entity_idx  on public.project_events (entity_type, entity_id, event_date desc);
create index project_events_project_idx on public.project_events (project_id, event_date desc);
create index project_events_type_idx    on public.project_events (project_id, event_type, event_date desc);

-- ---------------------------------------------------------------------
-- Checklists (venta, fabricacion, instalacion)
-- ---------------------------------------------------------------------
create table public.checklist_templates (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,  -- null = global
  code          text not null,
  name          text not null,
  scope         entity_type not null,     -- SALE | MANUFACTURING_PROJECT | INSTALLATION
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index checklist_templates_code_uk
  on public.checklist_templates (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table public.checklist_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.checklist_templates(id) on delete cascade,
  title         text not null,
  description   text,
  sort_order    integer not null default 100,
  is_required   boolean not null default true,
  created_at    timestamptz not null default now()
);

create index checklist_template_items_template_idx on public.checklist_template_items (template_id, sort_order);

create table public.project_checklists (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  template_id   uuid references public.checklist_templates(id) on delete set null,
  entity_type   entity_type not null,
  entity_id     uuid not null,
  name          text not null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint project_checklists_uk unique (entity_type, entity_id, name)
);

create index project_checklists_entity_idx on public.project_checklists (entity_type, entity_id);

select app.attach_updated_at('public.project_checklists');

create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  checklist_id  uuid not null references public.project_checklists(id) on delete cascade,
  title         text not null,
  description   text,
  sort_order    integer not null default 100,
  is_required   boolean not null default true,
  completed     boolean not null default false,
  completed_at  timestamptz,
  completed_by  uuid references public.profiles(id) on delete set null,
  due_date      date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index checklist_items_checklist_idx on public.checklist_items (checklist_id, sort_order);
create index checklist_items_pending_idx   on public.checklist_items (project_id, due_date) where not completed;

select app.attach_updated_at('public.checklist_items');

create or replace function app.tg_checklist_item_completion()
returns trigger
language plpgsql
as $$
begin
  if new.completed and not coalesce(old.completed, false) then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  elsif not new.completed then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

create trigger checklist_items_completion
  before insert or update on public.checklist_items
  for each row execute function app.tg_checklist_item_completion();

-- ---------------------------------------------------------------------
-- Control de calidad
-- ---------------------------------------------------------------------
create table public.quality_checks (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete restrict,
  manufacturing_project_id  uuid references public.manufacturing_projects(id) on delete cascade,
  court_id                  uuid references public.courts(id) on delete cascade,
  installation_id           uuid references public.installations(id) on delete cascade,
  check_type                text not null default 'FABRICACION',  -- FABRICACION | GALVANIZADO | EMBALAJE | INSTALACION
  check_date                date not null default current_date,
  responsible_user_id       uuid references public.profiles(id) on delete set null,
  result                    quality_result not null default 'PENDIENTE',
  score                     integer,
  observations              text,
  corrective_actions        text,
  approved_by               uuid references public.profiles(id) on delete set null,
  approved_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint quality_checks_score_ck  check (score is null or score between 0 and 100),
  constraint quality_checks_target_ck check (
    manufacturing_project_id is not null or court_id is not null or installation_id is not null
  )
);

create index quality_checks_project_idx on public.quality_checks (project_id, check_date desc);
create index quality_checks_court_idx   on public.quality_checks (court_id);
create index quality_checks_mp_idx      on public.quality_checks (manufacturing_project_id);

select app.attach_updated_at('public.quality_checks');

-- ---------------------------------------------------------------------
-- Tareas (convierten alertas en acciones)
-- ---------------------------------------------------------------------
create table public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  title                 text not null,
  description           text,
  assigned_to           uuid references public.profiles(id) on delete set null,
  related_entity_type   entity_type,
  related_entity_id     uuid,
  alert_id              uuid,             -- FK diferida a alerts (mas abajo)
  due_date              date,
  priority              priority_level not null default 'MEDIA',
  status                task_status not null default 'PENDIENTE',
  completed_at          timestamptz,
  completed_by          uuid references public.profiles(id) on delete set null,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index tasks_project_status_idx on public.tasks (project_id, status, due_date);
create index tasks_assigned_idx       on public.tasks (assigned_to, due_date)
  where status in ('PENDIENTE','EN_CURSO','BLOQUEADA');
create index tasks_entity_idx         on public.tasks (related_entity_type, related_entity_id);

select app.attach_updated_at('public.tasks');

create or replace function app.tg_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'COMPLETADA' and coalesce(old.status, 'PENDIENTE'::task_status) <> 'COMPLETADA' then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  elsif new.status <> 'COMPLETADA' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completion
  before insert or update on public.tasks
  for each row execute function app.tg_task_completion();

-- ---------------------------------------------------------------------
-- Alertas (motor en 020_functions.sql)
-- ---------------------------------------------------------------------
create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  alert_type      alert_type not null,
  priority        priority_level not null default 'MEDIA',
  status          alert_status not null default 'ABIERTA',
  title           text not null,
  message         text,
  entity_type     entity_type not null,
  entity_id       uuid not null,
  -- Clave de deduplicacion: evita alertas repetidas del mismo problema
  dedupe_key      text not null,
  metadata        jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at  timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint alerts_dedupe_uk unique (project_id, dedupe_key)
);

create index alerts_project_status_idx on public.alerts (project_id, status, priority);
create index alerts_entity_idx         on public.alerts (entity_type, entity_id);
create index alerts_open_idx           on public.alerts (project_id, priority, last_detected_at desc)
  where status in ('ABIERTA','RECONOCIDA','EN_GESTION');

select app.attach_updated_at('public.alerts');

alter table public.tasks
  add constraint tasks_alert_fk foreign key (alert_id) references public.alerts(id) on delete set null;

-- ---------------------------------------------------------------------
-- Notificaciones por usuario
-- ---------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  body          text,
  category      text not null default 'GENERAL',
  entity_type   entity_type,
  entity_id     uuid,
  alert_id      uuid references public.alerts(id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
