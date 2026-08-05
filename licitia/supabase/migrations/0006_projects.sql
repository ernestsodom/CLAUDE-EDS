-- ============================================================================
-- LicitIA — Carpetas de proyecto
-- Cada carpeta agrupa todo lo relacionado a un proyecto de un cliente
-- (licitación, bases, contrato, control de entregas, actas, reclamos…).
-- ============================================================================

create table projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  name            text not null,
  description     text,
  status          text not null default 'activo',  -- activo | cerrado | archivado
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index idx_projects_org on projects(organization_id);
create index idx_projects_client on projects(client_id);

create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

alter table documents add column project_id uuid references projects(id) on delete set null;
create index idx_documents_project on documents(project_id);

-- RLS: las carpetas son visibles para toda la organización; cualquier usuario
-- de la organización puede crear carpetas (necesario para archivar al subir).
alter table projects enable row level security;

create policy projects_select on projects for select
  using (organization_id = current_org_id());

create policy projects_insert on projects for insert
  with check (organization_id = current_org_id());

create policy projects_update on projects for update
  using (organization_id = current_org_id()
         and (current_role_of() in ('admin','supervisor') or created_by = auth.uid()));

create policy projects_delete on projects for delete
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- Cualquier usuario de la organización puede registrar un cliente al crear
-- una carpeta (la política existente de escritura completa sigue reservada
-- a admin/supervisor; las políticas se combinan con OR).
create policy clients_insert_any on clients for insert
  with check (organization_id = current_org_id());
