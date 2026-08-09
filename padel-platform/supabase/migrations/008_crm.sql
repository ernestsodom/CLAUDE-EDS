-- =====================================================================
-- 008_crm.sql
-- Oportunidades, actividades comerciales, reuniones y seguimientos.
-- =====================================================================

create table public.opportunities (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete restrict,
  client_id           uuid not null references public.clients(id) on delete restrict,
  contact_id          uuid references public.contacts(id) on delete set null,
  owner_user_id       uuid references public.profiles(id) on delete set null,
  code                text,
  name                text not null,
  description         text,
  estimated_courts    integer not null default 0,
  estimated_amount    numeric(14,2) not null default 0,
  currency            currency_code not null default 'EUR',
  probability         integer not null default 10,
  expected_close_date date,
  status              opportunity_status not null default 'NUEVA',
  source              lead_source,
  lost_reason         text,
  next_action         text,
  next_action_date    date,
  closed_at           timestamptz,
  notes               text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint opportunities_probability_ck check (probability between 0 and 100),
  constraint opportunities_amount_ck      check (estimated_amount >= 0),
  constraint opportunities_courts_ck      check (estimated_courts >= 0),
  constraint opportunities_lost_ck        check (status <> 'PERDIDA' or lost_reason is not null)
);

comment on column public.opportunities.probability is
  'Probabilidad de cierre 0-100. Pipeline ponderado = estimated_amount * probability / 100.';

create index opportunities_project_idx        on public.opportunities (project_id) where deleted_at is null;
create index opportunities_client_idx         on public.opportunities (client_id) where deleted_at is null;
create index opportunities_project_status_idx on public.opportunities (project_id, status) where deleted_at is null;
create index opportunities_owner_idx          on public.opportunities (owner_user_id) where deleted_at is null;
create index opportunities_next_action_idx    on public.opportunities (next_action_date)
  where deleted_at is null and status not in ('GANADA','PERDIDA','ARCHIVADA');
create index opportunities_close_date_idx     on public.opportunities (project_id, expected_close_date)
  where deleted_at is null;

select app.attach_updated_at('public.opportunities');

-- ---------------------------------------------------------------------
create table public.commercial_activities (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  client_id         uuid references public.clients(id) on delete cascade,
  contact_id        uuid references public.contacts(id) on delete set null,
  opportunity_id    uuid references public.opportunities(id) on delete cascade,
  user_id           uuid references public.profiles(id) on delete set null,
  activity_type     activity_type not null,
  activity_date     timestamptz not null default now(),
  subject           text not null,
  description       text,
  result            text,
  next_action       text,
  next_action_date  date,
  created_at        timestamptz not null default now(),

  constraint commercial_activities_target_ck check (client_id is not null or opportunity_id is not null)
);

create index commercial_activities_project_date_idx on public.commercial_activities (project_id, activity_date desc);
create index commercial_activities_client_idx       on public.commercial_activities (client_id, activity_date desc);
create index commercial_activities_opportunity_idx  on public.commercial_activities (opportunity_id, activity_date desc);

-- ---------------------------------------------------------------------
create table public.meetings (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete restrict,
  client_id            uuid references public.clients(id) on delete cascade,
  opportunity_id       uuid references public.opportunities(id) on delete set null,
  responsible_user_id  uuid references public.profiles(id) on delete set null,
  meeting_date         date not null,
  start_time           time,
  end_time             time,
  location             text,
  meeting_type         meeting_type not null default 'VIDEOLLAMADA',
  status               meeting_status not null default 'PLANIFICADA',
  objective            text,
  summary              text,
  agreements           text,
  next_steps           text,
  next_followup_date   date,
  attendees            jsonb not null default '[]'::jsonb,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  constraint meetings_time_ck check (start_time is null or end_time is null or end_time > start_time)
);

create index meetings_project_date_idx on public.meetings (project_id, meeting_date desc) where deleted_at is null;
create index meetings_client_idx       on public.meetings (client_id) where deleted_at is null;
create index meetings_upcoming_idx     on public.meetings (meeting_date)
  where deleted_at is null and status in ('PLANIFICADA','CONFIRMADA');

select app.attach_updated_at('public.meetings');

-- ---------------------------------------------------------------------
create table public.follow_ups (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete restrict,
  client_id            uuid references public.clients(id) on delete cascade,
  opportunity_id       uuid references public.opportunities(id) on delete cascade,
  responsible_user_id  uuid references public.profiles(id) on delete set null,
  title                text not null,
  description          text,
  due_date             date not null,
  priority             priority_level not null default 'MEDIA',
  status               follow_up_status not null default 'PENDIENTE',
  completed_at         timestamptz,
  completed_by         uuid references public.profiles(id) on delete set null,
  result               text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint follow_ups_completed_ck check (
    (status = 'COMPLETADO' and completed_at is not null) or
    (status <> 'COMPLETADO')
  )
);

create index follow_ups_project_status_idx on public.follow_ups (project_id, status, due_date);
create index follow_ups_responsible_idx    on public.follow_ups (responsible_user_id, due_date)
  where status in ('PENDIENTE','EN_CURSO','VENCIDO');
create index follow_ups_client_idx         on public.follow_ups (client_id);

select app.attach_updated_at('public.follow_ups');

-- Marca VENCIDO al vuelo cuando se toca la fila; el barrido masivo lo hace
-- app.refresh_overdue_follow_ups() (ver 020_functions.sql), invocado por cron.
create or replace function app.tg_follow_up_overdue()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'PENDIENTE' and new.due_date < current_date then
    new.status := 'VENCIDO';
  elsif new.status = 'VENCIDO' and new.due_date >= current_date then
    new.status := 'PENDIENTE';
  end if;

  if new.status = 'COMPLETADO' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger follow_ups_overdue
  before insert or update on public.follow_ups
  for each row execute function app.tg_follow_up_overdue();
