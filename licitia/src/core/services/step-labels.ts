/**
 * Etiquetas legibles de `documents.processing_step`, separadas de
 * ingestion.service.ts a propósito: ese módulo importa la capa de datos
 * (lib/db/hybrid → lib/db/executor → `pg`, el driver de Postgres, que usa
 * APIs de Node como `fs`/`net`/`tls`) y no puede entrar al bundle del
 * navegador. Un componente cliente que solo necesita estas etiquetas para
 * mostrar el estado de carga (dashboard-kpis.tsx, por ejemplo) debe
 * importarlas de aquí, no de ingestion.service.ts — si no, el build falla
 * con "Module not found: Can't resolve 'fs'/'net'/'tls'/'dns'".
 */
export const STEP_LABELS: Record<string, string> = {
  extraccion_texto: "extrayendo texto",
  chunking: "dividiendo el documento",
  clasificacion: "clasificando",
  cargado: "cargado",
  // Se conservan las etiquetas de los pasos que ahora son partes a pedido:
  // documentos procesados con la versión anterior pueden tener cualquiera de
  // estos valores guardados en processing_step.
  embeddings: "generando vectores de búsqueda",
  resumen: "redactando el resumen",
  sistemas: "identificando los sistemas",
  requerimientos: "extrayendo puntos críticos",
  timeline: "construyendo la línea de tiempo",
  completado: "completado",
};
