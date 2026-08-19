-- ============================================================================
-- LicitIA — Comparador de dos documentos: resumen macro en viñetas y página
-- de origen de cada diferencia (en cada uno de los dos documentos).
-- ============================================================================

-- El resumen en prosa ya vivía en comparisons.summary; se agrega la versión
-- en viñetas para la lectura rápida "a nivel macro" antes del detalle.
-- Las páginas de cada diferencia no necesitan columna propia: van dentro de
-- comparisons.differences (jsonb), que ya guarda el detalle completo — solo
-- se agregan las claves pagina_a/pagina_b a cada objeto desde la aplicación.

alter table comparisons
  add column if not exists summary_points jsonb;
