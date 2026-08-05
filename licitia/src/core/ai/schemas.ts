import { z } from "zod";

// ============================================================================
// Esquemas Zod para salidas estructuradas de OpenAI (Structured Outputs).
// Cada análisis IA devuelve JSON validado contra estos esquemas.
// ============================================================================

export const ClassificationSchema = z.object({
  cliente: z.string().nullable(),
  tipo_cliente: z.enum(["municipio", "empresa", "institucion", "otro"]).nullable(),
  numero_licitacion: z.string().nullable(),
  nombre_licitacion: z.string().nullable(),
  id_mercado_publico: z.string().nullable(),
  tipo_documento: z.enum([
    "licitacion", "bases_administrativas", "bases_tecnicas",
    "propuesta_comercial", "propuesta_tecnica", "carta_gantt",
    "contrato", "anexo", "reclamo", "informe", "acta", "avance",
    "control_entregas", "otro",
  ]),
  fecha: z.string().nullable().describe("ISO 8601 (YYYY-MM-DD)"),
  monto: z.number().nullable(),
  moneda: z.string().nullable(),
  duracion_contrato: z.string().nullable(),
  proveedor: z.string().nullable(),
  area: z.string().nullable(),
  tipo_proyecto: z.string().nullable(),
  pais: z.string().nullable(),
  region: z.string().nullable(),
  ciudad: z.string().nullable(),
  estado_documento: z.string().nullable(),
  version: z.string().nullable(),
  idioma: z.string().nullable(),
  titulo_sugerido: z.string(),
  confianza: z.number().min(0).max(1),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const ItemSchema = z.object({ titulo: z.string(), detalle: z.string() });

export const SummarySchema = z.object({
  resumen_general: z.string(),
  objetivo: z.string(),
  alcance: z.string(),
  problemas_detectados: z.array(ItemSchema),
  requerimientos: z.array(ItemSchema),
  obligaciones: z.array(ItemSchema),
  restricciones: z.array(ItemSchema),
  riesgos: z.array(
    z.object({
      riesgo: z.string(),
      nivel: z.enum(["bajo", "medio", "alto", "critico"]),
      mitigacion: z.string(),
    })
  ),
  aspectos_criticos: z.array(ItemSchema),
  entregables: z.array(ItemSchema),
  cronograma: z.array(z.object({ hito: z.string(), plazo: z.string() })),
  recomendaciones: z.array(z.string()),
});
export type Summary = z.infer<typeof SummarySchema>;

export const TechnicalVariablesSchema = z.object({
  variables: z.array(
    z.object({
      categoria: z.enum([
        "sistema", "modulo", "funcionalidad", "integracion", "api", "reporte",
        "dashboard", "interfaz", "servicio_web", "base_datos", "infraestructura",
        "seguridad", "backup", "migracion", "capacitacion", "implementacion",
        "mesa_ayuda", "soporte", "sla", "hardware", "software", "licencia",
        "multa", "garantia", "certificacion", "personal", "experiencia", "otro",
      ]),
      nombre: z.string(),
      descripcion: z.string().nullable(),
      valor: z.string().nullable(),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable().describe("Cita textual breve del documento"),
      confianza: z.number().min(0).max(1),
    })
  ),
});
export type TechnicalVariables = z.infer<typeof TechnicalVariablesSchema>;

export const RequirementsSchema = z.object({
  requerimientos: z.array(
    z.object({
      codigo: z.string().nullable(),
      titulo: z.string(),
      descripcion: z.string().nullable(),
      categoria: z.string().nullable(),
      obligatorio: z.boolean(),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable(),
      prioridad: z.enum(["bajo", "medio", "alto", "critico"]),
    })
  ),
});
export type Requirements = z.infer<typeof RequirementsSchema>;

export const TimelineSchema = z.object({
  hitos: z.array(
    z.object({
      tipo: z.enum([
        "inicio", "hito", "capacitacion", "implementacion", "marcha_blanca",
        "recepcion", "garantia", "soporte", "termino", "entregable", "otro",
      ]),
      titulo: z.string(),
      descripcion: z.string().nullable(),
      fecha_inicio: z.string().nullable().describe("ISO 8601 si es determinable"),
      fecha_fin: z.string().nullable(),
      plazo_texto: z.string().nullable().describe("'30 días corridos desde la firma', etc."),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable(),
    })
  ),
});
export type Timeline = z.infer<typeof TimelineSchema>;

export const DeliveredItemsSchema = z.object({
  entregas: z.array(
    z.object({
      titulo: z.string(),
      descripcion: z.string().nullable(),
      fecha_entrega: z.string().nullable().describe("ISO 8601 si es determinable"),
      estado: z.enum(["entregado", "en_progreso", "comprometido"]),
      es_adicional: z
        .boolean()
        .describe("true si NO corresponde a ningún requerimiento del acuerdo/licitación"),
      es_gratuito: z
        .boolean()
        .describe("true si se realizó sin costo para el cliente"),
      referencia_requerimiento: z
        .string()
        .nullable()
        .describe("Código o título del requerimiento contractual al que responde, si aplica"),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable(),
      confianza: z.number().min(0).max(1),
    })
  ),
});
export type DeliveredItems = z.infer<typeof DeliveredItemsSchema>;

export const ComplianceItemSchema = z.object({
  requerimiento: z.string(),
  estado: z.enum(["cumplido", "parcial", "pendiente", "no_aplica", "fuera_de_alcance", "adicional"]),
  evidencia_cita: z.string().nullable(),
  evidencia_pagina: z.number().int().nullable(),
  comentario: z.string(),
  riesgo: z.enum(["bajo", "medio", "alto", "critico"]),
  prioridad: z.enum(["bajo", "medio", "alto", "critico"]),
});

export const ComplianceSchema = z.object({
  items: z.array(ComplianceItemSchema),
  resumen: z.string(),
});
export type Compliance = z.infer<typeof ComplianceSchema>;

export const DiffSchema = z.object({
  diferencias: z.array(
    z.object({
      tema: z.string(),
      documento_a: z.string(),
      documento_b: z.string(),
      impacto: z.enum(["bajo", "medio", "alto", "critico"]),
      comentario: z.string(),
    })
  ),
  resumen: z.string(),
});
export type Diff = z.infer<typeof DiffSchema>;

export const ClaimAnalysisSchema = z.object({
  que_reclama: z.string(),
  que_solicita: z.string(),
  contrato_aplicable: z.string().nullable(),
  requerimientos_relacionados: z.array(z.string()),
  ya_entregado: z.array(z.string()),
  pendiente: z.array(z.string()),
  fuera_de_contrato: z.array(z.string()),
  mejoras_adicionales: z.array(z.string()),
  riesgos: z.array(
    z.object({ riesgo: z.string(), nivel: z.enum(["bajo", "medio", "alto", "critico"]) })
  ),
});
export type ClaimAnalysis = z.infer<typeof ClaimAnalysisSchema>;

export const ChatAnswerSchema = z.object({
  respuesta: z.string(),
  citas: z.array(
    z.object({
      chunk_id: z.string(),
      cita_textual: z.string(),
      pagina: z.number().int().nullable(),
      seccion: z.string().nullable(),
    })
  ),
  confianza: z.number().min(0).max(1),
});
export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;
