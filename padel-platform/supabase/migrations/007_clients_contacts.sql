-- =====================================================================
-- 007_clients_contacts.sql
-- CRM: clientes y contactos.
-- =====================================================================

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete restrict,
  company_name    text not null,
  legal_name      text,
  tax_id          text,
  country         text,
  city            text,
  address         text,
  postal_code     text,
  website         text,
  industry        text,
  status          client_status not null default 'PROSPECTO',
  source          lead_source,
  owner_user_id   uuid references public.profiles(id) on delete set null,
  preferred_currency currency_code,
  payment_terms   text,
  credit_limit    numeric(14,2),
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint clients_company_name_ck check (length(btrim(company_name)) > 0),
  constraint clients_credit_limit_ck check (credit_limit is null or credit_limit >= 0)
);

comment on table public.clients is 'Prospectos y clientes. Aislados por project_id via RLS.';

-- tax_id unico dentro del proyecto (ignorando borrados logicos)
create unique index clients_project_tax_id_uk
  on public.clients (project_id, lower(tax_id))
  where tax_id is not null and deleted_at is null;

create index clients_project_idx        on public.clients (project_id) where deleted_at is null;
create index clients_project_status_idx on public.clients (project_id, status) where deleted_at is null;
create index clients_owner_idx          on public.clients (owner_user_id) where deleted_at is null;
create index clients_country_idx        on public.clients (project_id, country) where deleted_at is null;
create index clients_name_trgm_idx      on public.clients using gin (company_name gin_trgm_ops);

select app.attach_updated_at('public.clients');

-- ---------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete restrict,
  client_id     uuid not null references public.clients(id) on delete cascade,
  first_name    text not null,
  last_name     text,
  position      text,
  email         citext,
  phone         text,
  whatsapp      text,
  language      text default 'es',
  is_primary    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint contacts_first_name_ck check (length(btrim(first_name)) > 0)
);

create index contacts_client_idx  on public.contacts (client_id) where deleted_at is null;
create index contacts_project_idx on public.contacts (project_id) where deleted_at is null;
create unique index contacts_one_primary_idx
  on public.contacts (client_id) where is_primary and deleted_at is null;

select app.attach_updated_at('public.contacts');

-- Coherencia de tenant: el contacto pertenece al mismo proyecto que el cliente.
create or replace function app.tg_contacts_project_consistency()
returns trigger
language plpgsql
as $$
begin
  if (select project_id from public.clients where id = new.client_id) is distinct from new.project_id then
    raise exception 'El contacto y el cliente deben pertenecer al mismo proyecto (project_id)';
  end if;
  return new;
end;
$$;

create trigger contacts_project_consistency
  before insert or update of client_id, project_id on public.contacts
  for each row execute function app.tg_contacts_project_consistency();
