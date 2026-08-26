-- ============================================================================
-- Resumen ejecutivo: criterios de evaluación (con ponderación y pauta de
-- cálculo), metodología general de evaluación, y anexos/formularios
-- solicitados — para verlos junto con el resto del análisis en la pestaña
-- Resumen, sin tener que buscarlos a mano en el documento.
-- ============================================================================

alter table document_summaries
  add column if not exists evaluation_criteria    jsonb,
  add column if not exists evaluation_methodology  text,
  add column if not exists requested_annexes       jsonb;
