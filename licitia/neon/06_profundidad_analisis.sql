-- =====================================================================
-- 06_profundidad_analisis.sql — recuperar profundidad en los módulos
-- existentes (Resumen, Evaluación y Anexos, Puntos críticos).
--
-- Contexto: dividir el análisis en partes (05_analisis_a_pedido.sql) bajó
-- el tiempo de respuesta, pero de paso también se le pidió a la IA ser
-- breve dentro de cada parte — eso fue el error, no la división en sí.
-- Este archivo NO agrega módulos nuevos: solo suma las columnas que
-- necesitan los campos más profundos de `requirements` (valor cuantitativo,
-- base de cálculo y condición de gatillo — sobre todo para multas). Los
-- demás campos nuevos (certificaciones, migración de datos, evaluación,
-- anexos) viven en columnas jsonb ya existentes en `document_summaries`
-- (iso_9001, iso_27001, data_migration, evaluation_criteria,
-- requested_annexes) y no requieren ningún cambio de esquema.
--
-- Aplicar TAL CUAL en Neon y en Supabase.
-- =====================================================================

alter table public.requirements
  add column if not exists value_text text,
  add column if not exists calc_base text,
  add column if not exists condition_text text;

comment on column public.requirements.value_text is
  'Dato cuantitativo del ítem tal como lo indica el documento: monto o % de una multa, monto/vigencia de una garantía, % de disponibilidad de un SLA, años de experiencia, etc.';
comment on column public.requirements.calc_base is
  'Solo para multas/sanciones: sobre qué se calcula (p.ej. "por cada día de atraso, sobre el monto mensual") y su tope, si el documento lo define.';
comment on column public.requirements.condition_text is
  'Bajo qué condición o incumplimiento específico se gatilla este ítem.';
