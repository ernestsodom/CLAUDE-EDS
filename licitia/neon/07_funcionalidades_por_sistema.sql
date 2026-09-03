-- =====================================================================
-- 07_funcionalidades_por_sistema.sql — reactiva Funcionalidades, a pedido
-- y por sistema, no en lote.
--
-- Contexto: al pedido original de esta sesión ("Sistemas: sin sus
-- funcionalidades") se le sacó por completo la extracción de
-- funcionalidades — pero el Checklist vs Excel (el comparador principal,
-- ver checklist.service.ts) SIEMPRE dependió de `system_features` para
-- saber qué comparar contra el Excel de control. Sin funcionalidades, el
-- comparador queda con 0 ítems por sistema para cualquier documento
-- procesado con el pipeline nuevo — es la causa raíz de por qué el
-- comparador dejó de servir.
--
-- La solución no es volver a extraerlas todas juntas (eso fue lo que
-- agotaba tiempo y cuota): se piden por sistema, cuando el usuario elige
-- "Analizar funcionalidades" sobre uno puntual. `system_features` no
-- cambia de forma — solo se le agrega una columna para distinguir qué tan
-- directa es la evidencia de cada funcionalidad (explícita/implícita/
-- interpretación), que no existía antes.
--
-- Aplicar TAL CUAL en Neon y en Supabase.
-- =====================================================================

alter table public.system_features
  add column if not exists evidence_type text
    check (evidence_type is null or evidence_type in ('explicito', 'implicito', 'interpretacion'));

comment on column public.system_features.evidence_type is
  'Qué tan directa es la evidencia de esta funcionalidad en el documento: explicito (lo pide con esas palabras), implicito (se desprende de una exigencia más general del mismo sistema), interpretacion (lectura razonable, no dicho ni desprendido de forma directa). Null en funcionalidades marcadas a mano por el usuario.';
