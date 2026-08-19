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

/** Periodicidad del presupuesto: sin esto, un monto es ambiguo — ¿es lo que
 *  se paga una vez, cada mes o cada año? */
export const BUDGET_PERIODS = ["unico", "mensual", "anual", "total"] as const;
export const BUDGET_PERIOD_LABELS: Record<(typeof BUDGET_PERIODS)[number], string> = {
  unico: "Pago único",
  mensual: "Mensual",
  anual: "Anual",
  total: "Total del contrato",
};

export const SummarySchema = z.object({
  resumen_general: z.string(),
  objetivo: z.string(),
  alcance: z.string(),
  plazo_implementacion: z
    .string()
    .nullable()
    .describe("Plazo para implementar/poner en marcha la solución, tal como lo indica el documento (p.ej. '90 días corridos desde la firma')"),
  presupuesto: z
    .object({
      monto: z.number().nullable(),
      moneda: z.string().nullable(),
      periodicidad: z
        .enum(BUDGET_PERIODS)
        .nullable()
        .describe("unico=pago único, mensual, anual, o total=suma de todo el contrato"),
      detalle: z.string().nullable().describe("Aclaración breve si el documento distingue varios montos (p.ej. 'implementación única + soporte mensual')"),
    })
    .nullable(),
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

/**
 * Requerimientos CRÍTICOS: solo las condiciones que hay que cumplir sí o sí
 * para poder participar o para no exponerse a una sanción. Todo lo demás
 * (funcionalidades del software) vive en SystemsSchema.
 */
export const CRITICAL_TYPES = [
  "boleta_garantia",
  "servidores",
  "sla",
  "plazos",
  "multas",
  "certificados",
  "migracion_datos",
] as const;

export const CRITICAL_TYPE_LABELS: Record<(typeof CRITICAL_TYPES)[number], string> = {
  boleta_garantia: "Boleta de garantía",
  servidores: "Condiciones de servidores",
  sla: "SLA / niveles de servicio",
  plazos: "Plazos",
  multas: "Multas",
  certificados: "Certificados",
  migracion_datos: "Migración de datos",
};

export const RequirementsSchema = z.object({
  requerimientos: z.array(
    z.object({
      tipo_critico: z.enum(CRITICAL_TYPES),
      codigo: z.string().nullable(),
      titulo: z.string(),
      descripcion: z.string().nullable(),
      obligatorio: z.boolean(),
      plazo: z.string().nullable().describe("Plazo asociado a este punto crítico, tal como lo indica el documento, si existe"),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable(),
      prioridad: z.enum(["bajo", "medio", "alto", "critico"]),
    })
  ),
});
export type Requirements = z.infer<typeof RequirementsSchema>;

/**
 * Sistemas (software) exigidos por el documento técnico y, colgando de cada
 * uno, sus funcionalidades concretas. Es la estructura sobre la que se
 * construye el checklist de cumplimiento y la comparación contra el Excel.
 */
export const SystemsSchema = z.object({
  sistemas: z.array(
    z.object({
      nombre: z.string().describe("Nombre del sistema/software tal como lo llama el documento"),
      descripcion: z.string().nullable(),
      plazo: z.string().nullable().describe("Plazo de entrega del sistema, si el documento lo indica"),
      pagina: z.number().int().nullable(),
      cita: z.string().nullable(),
      funcionalidades: z.array(
        z.object({
          nombre: z.string().describe("Funcionalidad concreta y específica, en una línea"),
          descripcion: z.string().nullable(),
          plazo: z.string().nullable(),
          obligatoria: z.boolean(),
          pagina: z.number().int().nullable(),
          cita: z.string().nullable(),
        })
      ),
    })
  ),
});
export type Systems = z.infer<typeof SystemsSchema>;

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
  resumen: z
    .string()
    .describe(
      "Resumen ejecutivo en prosa (3-6 líneas) de las diferencias más importantes a nivel macro entre ambos documentos."
    ),
  resumen_puntos: z
    .array(z.string())
    .describe(
      "Entre 3 y 8 viñetas cortas (una línea cada una) con los cambios macro más relevantes: qué cambió y su impacto general — la vista rápida antes del detalle punto por punto."
    ),
  diferencias: z.array(
    z.object({
      tema: z.string(),
      documento_a: z
        .string()
        .describe("Qué dice o cómo trata este tema el Documento A; si el tema no aparece en A, indícalo explícitamente ('No aparece en este documento')."),
      pagina_a: z.number().int().nullable().describe("Página del Documento A donde aparece este contenido; null si no aparece en A."),
      documento_b: z
        .string()
        .describe("Qué dice o cómo trata este tema el Documento B; si el tema no aparece en B, indícalo explícitamente ('No aparece en este documento')."),
      pagina_b: z.number().int().nullable().describe("Página del Documento B donde aparece este contenido; null si no aparece en B."),
      impacto: z.enum(["bajo", "medio", "alto", "critico"]),
      comentario: z.string(),
    })
  ),
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
