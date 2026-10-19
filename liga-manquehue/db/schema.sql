-- Liga Ex Alumnos y Apoderados Colegio Manquehue
-- Categorías: 'tc' (Todo Competidor) y 'senior'

CREATE TABLE IF NOT EXISTS teams (
  id        SERIAL PRIMARY KEY,
  category  TEXT NOT NULL CHECK (category IN ('tc','senior')),
  name      TEXT NOT NULL,
  -- Arrastre: estadísticas previas a cargar los partidos en el sistema
  base_pj   INT NOT NULL DEFAULT 0,
  base_pg   INT NOT NULL DEFAULT 0,
  base_pe   INT NOT NULL DEFAULT 0,
  base_pp   INT NOT NULL DEFAULT 0,
  base_gf   INT NOT NULL DEFAULT 0,
  base_gc   INT NOT NULL DEFAULT 0,
  UNIQUE (category, name)
);

CREATE TABLE IF NOT EXISTS players (
  id         SERIAL PRIMARY KEY,
  team_id    INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  rut        TEXT,
  number     INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rounds (
  id        SERIAL PRIMARY KEY,
  category  TEXT NOT NULL CHECK (category IN ('tc','senior')),
  number    INT NOT NULL,
  date      DATE,
  UNIQUE (category, number)
);

CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  round_id      INT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  home_team_id  INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id  INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  time          TEXT,
  field         TEXT,
  home_goals    INT,
  away_goals    INT
);

CREATE TABLE IF NOT EXISTS sanctions (
  id                SERIAL PRIMARY KEY,
  category          TEXT NOT NULL CHECK (category IN ('tc','senior')),
  team_id           INT REFERENCES teams(id) ON DELETE CASCADE,
  player_name       TEXT,
  reason            TEXT NOT NULL,
  matches_suspended INT NOT NULL DEFAULT 0,
  points_deducted   INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id         SERIAL PRIMARY KEY,
  category   TEXT CHECK (category IN ('tc','senior')), -- NULL = ambas
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id         SERIAL PRIMARY KEY,
  category   TEXT CHECK (category IN ('tc','senior')), -- NULL = ambas
  caption    TEXT,
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL, -- base64
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_round_idx ON matches(round_id);
CREATE INDEX IF NOT EXISTS players_team_idx ON players(team_id);

-- Goleadores
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_goals INT NOT NULL DEFAULT 0; -- goles previos al sitio

CREATE TABLE IF NOT EXISTS goals (
  id        SERIAL PRIMARY KEY,
  match_id  INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  count     INT NOT NULL DEFAULT 1 CHECK (count > 0)
);
CREATE INDEX IF NOT EXISTS goals_match_idx ON goals(match_id);

-- Fixture flexible: nombre de fecha, texto de días, equipos libres y partidos por definir (play off)
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_category_number_key;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS name TEXT;        -- ej: "Fecha recuperativa", "Fecha 11 (Play off)"
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS date_label TEXT;  -- ej: "Lunes 5 / Jueves 8 oct"
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS notes TEXT;       -- ej: "Libres: Santa Fe, Santos"
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_label TEXT; -- cuando aún no hay equipo: "1° lugar"
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_label TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS note TEXT;       -- ej: "Suspendido", "Semifinal Oro"

-- Escudo, foto, descripción y fair play de cada equipo
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo TEXT;         -- base64
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_mime TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS photo TEXT;        -- base64
ALTER TABLE teams ADD COLUMN IF NOT EXISTS photo_mime TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS info TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fp_ta INT NOT NULL DEFAULT 0;  -- tarjetas amarillas
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fp_tr INT NOT NULL DEFAULT 0;  -- tarjetas rojas
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fp_pts INT NOT NULL DEFAULT 0; -- puntaje fair play (menos es mejor)

-- Documentos PDF (reglamentos, anexos)
CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  section    TEXT NOT NULL DEFAULT 'reglamentos',
  title      TEXT NOT NULL,
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL, -- base64
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Páginas de texto editables: historia, directiva, administracion, contacto
CREATE TABLE IF NOT EXISTS pages (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
