-- Esquema de la base de datos Neon de TeVendoElAuto.cl
CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE media (id serial PRIMARY KEY, mime text NOT NULL, data text NOT NULL, bytes int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE vehicles (
  id serial PRIMARY KEY, marca text NOT NULL, modelo text NOT NULL, version text NOT NULL DEFAULT '', anio int NOT NULL, km int NOT NULL DEFAULT 0,
  trans text NOT NULL DEFAULT 'Manual', comb text NOT NULL DEFAULT 'Bencina', precio bigint NOT NULL, tipo text NOT NULL DEFAULT 'SUV', trac text NOT NULL DEFAULT '4x2',
  color text NOT NULL DEFAULT '', descripcion text NOT NULL DEFAULT '', equipamiento jsonb NOT NULL DEFAULT '[]', fotos jsonb NOT NULL DEFAULT '[]',
  estado text NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible','reservado','vendido')), destacado boolean NOT NULL DEFAULT false, orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE leads (
  id serial PRIMARY KEY, tipo text NOT NULL, nombre text NOT NULL DEFAULT '', telefono text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  vehicle_id int REFERENCES vehicles(id) ON DELETE SET NULL, vehicle_label text NOT NULL DEFAULT '', mensaje text NOT NULL DEFAULT '', datos jsonb NOT NULL DEFAULT '{}',
  estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','negociando','cerrado','descartado')), notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX leads_created_idx ON leads (created_at DESC);
CREATE TABLE events (
  id bigserial PRIMARY KEY, type text NOT NULL, path text NOT NULL DEFAULT '', vehicle_id int, visitor_id text NOT NULL DEFAULT '', session_id text NOT NULL DEFAULT '',
  referrer text NOT NULL DEFAULT '', device text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX events_created_idx ON events (created_at);
CREATE INDEX events_vehicle_idx ON events (vehicle_id) WHERE vehicle_id IS NOT NULL;
