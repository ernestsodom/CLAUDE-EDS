-- ============================================================================
-- LicitIA — Control interno de entregas
-- Nuevo tipo de documento 'control_entregas' (registro propio de lo realmente
-- entregado) y tabla delivered_items: cada entrega extraída individualmente
-- por la IA, incluyendo trabajos adicionales fuera de acuerdo y gratuitos.
-- ============================================================================

alter type document_type add value if not exists 'control_entregas';

create table delivered_items (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  title         text not null,
  description   text,
  delivered_on  date,
  delivery_state text not null default 'entregado', -- entregado | en_progreso | comprometido
  is_additional boolean not null default false,     -- no exigido en licitación/bases/contrato
  is_free       boolean not null default false,     -- realizado sin costo para el cliente
  requirement_ref text,                             -- código/título del requerimiento si aplica
  page          int,
  quote         text,                               -- cita textual del documento de control
  confidence    real,
  created_at    timestamptz not null default now()
);

create index idx_delivered_items_doc on delivered_items(document_id);
create index idx_delivered_items_additional on delivered_items(is_additional) where is_additional;

alter table delivered_items enable row level security;

create policy delivered_items_select on delivered_items for select
  using (can_read_document(document_id));
