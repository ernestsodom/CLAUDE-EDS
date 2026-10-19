-- Tabla Todo Competidor, Clausura 2026 (arrastre al momento de crear el sitio)
INSERT INTO teams (category, name, base_pj, base_pg, base_pe, base_pp, base_gf, base_gc) VALUES
  ('tc','CONDORES',    6,5,0,1,22,11),
  ('tc','MATTA JR',    6,4,0,2,23,16),
  ('tc','PUMAS',       6,3,2,1,15, 9),
  ('tc','SAN ESTEBAN', 6,3,2,1,16,11),
  ('tc','IMPOSIBLES',  6,3,1,2,19,15),
  ('tc','PUMANQUE',    8,3,1,4,22,28),
  ('tc','AMARELLO',    7,3,0,4,13,15),
  ('tc','SANTA FE',    7,2,1,4,20,19),
  ('tc','SANTOS',      6,2,1,3,11,18),
  ('tc','H DE NEGRO',  6,0,0,6, 8,27)
ON CONFLICT (category, name) DO NOTHING;
