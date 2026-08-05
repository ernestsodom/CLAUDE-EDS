import { structuredCompletion } from "@/core/ai/structured";
import {
  ClassificationSchema,
  RequirementsSchema,
  SummarySchema,
  TechnicalVariablesSchema,
  TimelineSchema,
  type Classification,
  type Requirements,
  type Summary,
  type TechnicalVariables,
  type Timeline,
} from "@/core/ai/schemas";
import type { PageText } from "@/core/domain/types";
import { MODELS } from "@/lib/openai";

/**
 * Prepara el texto del documento para análisis, anotando páginas y
 * recortando a un presupuesto de caracteres (los modelos GPT-5.x aceptan
 * contextos muy grandes; se limita por costo, no por capacidad).
 */
export function pagesToAnnotatedText(pages: PageText[], maxChars = 300_000): string {
  let out = "";
  for (const page of pages) {
    const block = `\n\n=== PÁGINA ${page.pageNumber} ===\n${page.content}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}

export async function classifyDocument(pages: PageText[]): Promise<Classification> {
  return structuredCompletion({
    schema: ClassificationSchema,
    schemaName: "clasificacion_documento",
    model: MODELS.fast,
    system:
      "Eres un clasificador experto de documentos de licitaciones públicas chilenas. " +
      "Extrae los metadatos solicitados del documento. Usa null cuando el dato no aparezca. " +
      "El monto debe ser numérico sin separadores. Las fechas en formato ISO YYYY-MM-DD.",
    user: pagesToAnnotatedText(pages, 120_000),
  });
}

export async function summarizeDocument(pages: PageText[]): Promise<Summary> {
  return structuredCompletion({
    schema: SummarySchema,
    schemaName: "resumen_ejecutivo",
    model: MODELS.chat,
    system:
      "Eres un consultor senior de licitaciones. Genera un informe ejecutivo completo del documento: " +
      "resumen general, objetivo, alcance, problemas detectados, requerimientos, obligaciones, " +
      "restricciones, riesgos (con nivel y mitigación), aspectos críticos, entregables, cronograma y " +
      "recomendaciones accionables para el equipo comercial y técnico. Sé específico y fiel al texto.",
    user: pagesToAnnotatedText(pages),
  });
}

export async function extractTechnicalVariables(pages: PageText[]): Promise<TechnicalVariables> {
  return structuredCompletion({
    schema: TechnicalVariablesSchema,
    schemaName: "variables_tecnicas",
    model: MODELS.chat,
    system:
      "Eres un analista técnico de licitaciones TI. Detecta TODAS las variables técnicas del documento: " +
      "sistemas, módulos, funcionalidades, integraciones, APIs, reportes, dashboards, interfaces, " +
      "servicios web, bases de datos, infraestructura, seguridad, backups, migraciones, capacitaciones, " +
      "implementación, mesa de ayuda, soporte, SLA, hardware, software, licencias, multas, garantías, " +
      "certificaciones, personal mínimo y experiencia exigida. " +
      "Cada variable con su página de origen y una cita textual breve. Exhaustivo pero sin duplicados.",
    user: pagesToAnnotatedText(pages),
  });
}

export async function extractRequirements(pages: PageText[]): Promise<Requirements> {
  return structuredCompletion({
    schema: RequirementsSchema,
    schemaName: "requerimientos",
    model: MODELS.chat,
    system:
      "Eres un ingeniero de requerimientos. Extrae cada requerimiento individual del documento " +
      "(funcional, técnico, administrativo o de servicio) como un ítem separado, con código si existe, " +
      "página de origen, cita textual, si es obligatorio u opcional, y prioridad estimada.",
    user: pagesToAnnotatedText(pages),
  });
}

export async function extractTimeline(pages: PageText[]): Promise<Timeline> {
  return structuredCompletion({
    schema: TimelineSchema,
    schemaName: "linea_de_tiempo",
    model: MODELS.fast,
    system:
      "Eres un planificador de proyectos. Construye la línea de tiempo del documento identificando: " +
      "inicio, hitos, capacitaciones, implementación, marcha blanca, recepción, garantía, soporte y término. " +
      "Si hay fechas absolutas úsalas; si solo hay plazos relativos ('30 días desde la firma'), " +
      "regístralos en plazo_texto y deja las fechas en null. Ordena cronológicamente.",
    user: pagesToAnnotatedText(pages, 150_000),
  });
}
