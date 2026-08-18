-- ============================================================================
-- LicitIA — Plazo de implementación y presupuesto en el resumen, plazo por
-- punto crítico (incluida la nueva migración de datos), y motor usado por
-- cada versión del documento.
-- ============================================================================

-- ─── 1. Resumen: plazo de implementación y presupuesto con periodicidad ────
-- Sin la periodicidad, un monto es ambiguo: ¿se paga una vez, cada mes o cada
-- año? El usuario lo pidió explícito.

alter table document_summaries
  add column if not exists implementation_deadline text,
  add column if not exists budget_amount   real,
  add column if not exists budget_currency text,
  add column if not exists budget_period   text,  -- unico | mensual | anual | total
  add column if not exists budget_detail   text;

-- ─── 2. Puntos críticos: plazo por ítem ─────────────────────────────────────
-- Antes solo "plazos" (el tipo) tenía plazo implícito en su propio texto;
-- ahora cualquier punto crítico —incluida la nueva migración de datos— puede
-- traer su propio plazo explícito.

alter table requirements
  add column if not exists deadline_text text;

-- ─── 3. Motor que produjo cada versión del análisis ─────────────────────────
-- Permite reanalizar un documento ya cargado con otro proveedor de IA sin
-- perder el resultado anterior: cada reanálisis crea una versión nueva,
-- etiquetada con el motor usado, visible en la pestaña Versiones.

alter table document_versions
  add column if not exists analysis_engine text;
