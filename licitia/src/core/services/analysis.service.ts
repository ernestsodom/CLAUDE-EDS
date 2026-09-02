import { structuredCompletion } from "@/core/ai/structured";
import {
  ClassificationSchema,
  DeliveredItemsSchema,
  EvaluationSchema,
  RequirementsSchema,
  SummarySchema,
  SystemsSchema,
  TimelineSchema,
  type Classification,
  type DeliveredItems,
  type Evaluation,
  type Requirements,
  type Summary,
  type Systems,
  type Timeline,
} from "@/core/ai/schemas";
import type { PageText } from "@/core/domain/types";
import type { ProviderId } from "@/lib/ai-providers";
import type { UsageEvent } from "@/core/services/ai-usage.service";

/** Registra los tokens reales que devolvió el proveedor en esta llamada
 *  (ver ai-usage.service.ts) — opcional, quien no lo pase no pierde nada. */
type OnUsage = (u: UsageEvent) => void;

/**
 * Prepara el texto del documento para análisis, anotando páginas y
 * recortando a un presupuesto de caracteres (los modelos aceptan contextos
 * muy grandes; se limita por costo, no por capacidad).
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

// Groq aplica un límite de tokens POR MINUTO (TPM) al modelo openai/gpt-oss-120b
// en el tier gratuito ("on_demand") mucho más estricto que su ventana de
// contexto — confirmado en producción: "413 ... Limit 8000, Requested 39091
// ... tokens per minute (TPM)". Ese límite cubre entrada + salida de la MISMA
// llamada, así que para Groq se recorta el documento a un presupuesto muy por
// debajo de lo que usan Gemini o Claude, y además se topa la respuesta — sin
// esto, cualquier documento de más de ~15-20 páginas falla siempre con Groq,
// sin importar cuánto se optimice el resto del pipeline.
const GROQ_MAX_INPUT_CHARS = 16_000;
const GROQ_MAX_OUTPUT_TOKENS = 3_000;

/** Presupuesto de caracteres de entrada a usar según el proveedor: el mismo
 *  `defaultMax` para Gemini/Claude, recortado para Groq. */
function charBudgetFor(provider: ProviderId, defaultMax: number): number {
  return provider === "groq" ? Math.min(defaultMax, GROQ_MAX_INPUT_CHARS) : defaultMax;
}

/** Tope de tokens de salida a pasar a structuredCompletion, solo cuando el
 *  proveedor lo necesita (Groq); Gemini y Claude usan sus valores por defecto. */
function outputCapFor(provider: ProviderId): number | undefined {
  return provider === "groq" ? GROQ_MAX_OUTPUT_TOKENS : undefined;
}

export async function classifyDocument(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Classification> {
  return structuredCompletion({
    schema: ClassificationSchema,
    schemaName: "clasificacion_documento",
    provider,
    speed: "fast",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un clasificador experto de documentos de licitaciones públicas chilenas. " +
      "Extrae los metadatos solicitados del documento. Usa null cuando el dato no aparezca. " +
      "El monto debe ser numérico sin separadores. Las fechas en formato ISO YYYY-MM-DD.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 120_000)),
  });
}

export async function summarizeDocument(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Summary> {
  return structuredCompletion({
    schema: SummarySchema,
    schemaName: "resumen_ejecutivo",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un consultor senior de licitaciones. Genera el resumen del documento con SOLO estas " +
      "variables fundamentales — no agregues nada más:\n" +
      "- resumen_general: de qué se trata la licitación, en un párrafo.\n" +
      "- objetivo y alcance: qué se busca lograr y qué comprende (y qué deja fuera).\n" +
      "- plazo_implementacion: el plazo para implementar/poner en marcha la solución completa " +
      "(no un hito parcial), tal como lo indica el documento.\n" +
      "- presupuesto: el monto y, sobre todo, su periodicidad — indica explícitamente si es un pago " +
      "único (unico), un monto mensual (mensual, p.ej. arriendo de licencias o soporte), un monto " +
      "anual (anual), o el total acumulado del contrato completo (total). Si el documento menciona " +
      "varios montos con distinta periodicidad (p.ej. implementación única + soporte mensual), usa el " +
      "monto más relevante (normalmente el total del contrato) y aclara los demás en 'detalle'. " +
      "Nunca dejes un monto sin periodicidad si el documento la menciona.\n" +
      "- obligaciones y restricciones: lo que el proveedor queda obligado a hacer y lo que tiene " +
      "prohibido o limitado.\n" +
      "- certificaciones: si el documento exige que el oferente esté certificado en ISO 9001 (calidad) " +
      "y/o ISO 27001 (seguridad de la información). Responde cada norma por separado: exigida=true " +
      "solo si el documento la pide, false si dice expresamente que no hace falta, y null si " +
      "sencillamente no la menciona. En 'detalle' aclara a quién se le exige, con qué vigencia, si " +
      "admite certificaciones equivalentes o si en vez de ser requisito solo suma puntaje en la " +
      "evaluación. Cita el texto donde lo exige.\n" +
      "- migracion_datos: si hay que migrar datos desde el/los sistema(s) actual(es). Necesito tres " +
      "cosas claras: si se exige (exigida), el TIEMPO que dan para hacerla (plazo, con el texto tal " +
      "cual: '30 días corridos antes de la marcha blanca') y CUÁNTA información hay que migrar " +
      "(volumen: años de historia, número de registros, GB, cantidad de tablas o sistemas de origen, " +
      "lo que el documento cuantifique). Si el documento no cuantifica el volumen, deja volumen en " +
      "null en vez de estimarlo tú.\n" +
      "Sé específico y fiel al texto. No inventes ni completes con supuestos: lo que el documento no " +
      "diga va en null.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Criterios de evaluación y anexos exigidos — el análisis que se consulta al
 * armar la oferta, separado del resumen para que cada uno quepa holgado en
 * el límite de tiempo de una etapa.
 */
export async function extractEvaluation(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Evaluation> {
  return structuredCompletion({
    schema: EvaluationSchema,
    schemaName: "evaluacion_y_anexos",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un experto en presentación de ofertas a licitaciones públicas chilenas. Extrae SOLO cómo " +
      "se evalúa la oferta y qué anexos hay que presentar:\n" +
      "- criterios_evaluacion: cada criterio con el que se evaluará y adjudicará la oferta (p.ej. " +
      "Precio, Experiencia, Presentación técnica, Soporte), con su ponderación exacta (porcentaje o " +
      "puntaje) y, en 'pauta', CÓMO se calcula o asigna el puntaje de ese criterio — fórmula, tabla de " +
      "puntajes por tramo, umbrales mínimos, etc., tal como lo describe el documento. Si el documento " +
      "trae una tabla de evaluación, cada fila es un criterio separado — no la resumas en un solo ítem.\n" +
      "- metodologia_evaluacion: las reglas generales que no son de un criterio puntual — cómo se suma " +
      "el puntaje total, desempates, causales de inadmisibilidad u ofertas fuera de bases.\n" +
      "- anexos_solicitados: cada anexo, formulario o documento adjunto que el documento exige presentar " +
      "(identificado por su número o nombre tal como aparece, p.ej. 'Anexo N°3 — Declaración Jurada'), " +
      "con qué debe contener o acreditar y si es obligatorio. Sé exhaustivo: lista TODOS los anexos " +
      "mencionados, no solo los primeros.\n" +
      "Fiel al texto: lo que el documento no defina va en null o en lista vacía.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Requerimientos CRÍTICOS únicamente: las condiciones que condicionan la
 * participación o exponen a sanción. Las funcionalidades del software NO van
 * aquí — se extraen como sistemas (extractSystems).
 */
export async function extractRequirements(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Requirements> {
  return structuredCompletion({
    schema: RequirementsSchema,
    schemaName: "requerimientos_criticos",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un experto en participación en licitaciones públicas chilenas. Extrae ÚNICAMENTE los " +
      "puntos críticos y obligatorios para poder participar o que exponen a sanción, clasificados en " +
      "estos tipos:\n" +
      "- boleta_garantia: garantías de seriedad de la oferta y de fiel cumplimiento (montos, vigencia, glosa).\n" +
      "- servidores: condiciones de servidores, hosting, nube, disponibilidad de infraestructura.\n" +
      "- sla: niveles de servicio, tiempos de respuesta y de resolución, disponibilidad comprometida.\n" +
      "- plazos: plazos de entrega, de implementación, de presentación de ofertas y fechas límite.\n" +
      "- multas: multas, sanciones, descuentos y causales de término anticipado.\n" +
      "- certificados: certificados, acreditaciones e inscripciones exigidas (ISO, ChileProveedores, etc.).\n" +
      "- migracion_datos: migración de datos desde el/los sistema(s) actual(es) al nuevo — alcance de " +
      "los datos a migrar, responsable, validación y, sobre todo, su plazo.\n" +
      "- experiencia: experiencia mínima exigida al oferente para poder participar o para puntuar en la " +
      "evaluación — años de experiencia en el rubro, número o monto de contratos similares ya " +
      "ejecutados, cantidad de usuarios/registros de esos contratos, certificados de conformidad " +
      "exigidos para acreditarla, etc. Un ítem por cada exigencia de experiencia distinta.\n" +
      "NO incluyas funcionalidades del software ni requisitos funcionales: esos se extraen aparte. " +
      "Para cada ítem, extrae también su plazo cuando el documento lo indique (p.ej. 'la migración de " +
      "datos deberá completarse en 30 días corridos previos a la marcha blanca'), con el texto tal cual " +
      "aparece; si no hay plazo explícito, null. Cada ítem con su cita textual y página. Si un tipo no " +
      "aparece en el documento, simplemente no lo incluyas. Sé breve y concreto: mejor pocos ítems bien " +
      "definidos que una lista larga.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Extrae los sistemas (software) que el documento exige y las funcionalidades
 * concretas de cada uno. Es la base del checklist de cumplimiento.
 */
export async function extractSystems(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Systems> {
  return structuredCompletion({
    schema: SystemsSchema,
    schemaName: "sistemas_y_funcionalidades",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un analista funcional de licitaciones TI. Identifica ÚNICAMENTE los SISTEMAS o módulos de " +
      "software que el documento exige desarrollar, implementar o proveer. Es un listado: NO detalles " +
      "las funcionalidades de cada sistema.\n" +
      "Reglas:\n" +
      "- Un sistema es una pieza de software con nombre propio en el documento (p. ej. 'Sistema de " +
      "  Gestión de Permisos de Circulación', 'Portal de Atención Ciudadana', 'Módulo de Tesorería').\n" +
      "- La descripción es de una o dos líneas: qué hace ese sistema. No enumeres ahí sus " +
      "  funcionalidades una por una.\n" +
      "- Indica el plazo de entrega cuando el documento lo señale, con el texto tal cual aparece " +
      "  ('60 días corridos desde la firma del contrato'); si no aparece, null.\n" +
      "- Si el documento describe requisitos sueltos sin agrupar, agrúpalos tú por sistema/módulo.\n" +
      "- No inventes: cada sistema debe poder respaldarse con una cita del documento.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Extrae del documento de control (o informe de avance/acta) cada entrega
 * realizada como ítem individual, distinguiendo lo contractual de los
 * trabajos adicionales fuera de acuerdo y los realizados sin costo.
 */
export async function extractDeliveredItems(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<DeliveredItems> {
  return structuredCompletion({
    schema: DeliveredItemsSchema,
    schemaName: "entregas_realizadas",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un auditor de entregas de proyectos TI. El documento es un registro de control de lo " +
      "realmente entregado (informe de avance, acta o control interno del proveedor). " +
      "Extrae CADA entrega, desarrollo o trabajo realizado como un ítem separado, con su estado " +
      "(entregado, en_progreso o comprometido), fecha si existe, página y cita textual. " +
      "Marca es_adicional=true cuando el trabajo NO responde a un requerimiento del acuerdo " +
      "(el documento suele indicarlo como 'adicional', 'fuera de alcance', 'mejora', 'cortesía' o " +
      "similar), y es_gratuito=true cuando se hizo sin costo para el cliente. " +
      "Si el ítem responde a un requerimiento contractual, indica su código o título en " +
      "referencia_requerimiento. Sé exhaustivo, sin duplicados.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

export async function extractTimeline(
  pages: PageText[],
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<Timeline> {
  return structuredCompletion({
    schema: TimelineSchema,
    schemaName: "linea_de_tiempo",
    provider,
    speed: "fast",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      "Eres un planificador de proyectos. Construye la línea de tiempo del documento identificando: " +
      "inicio, hitos, capacitaciones, implementación, marcha blanca, recepción, garantía, soporte y término. " +
      "Si el documento da una fecha calendario explícita para un hito, úsala en fecha_inicio/fecha_fin. " +
      "Si solo da un plazo relativo ('30 días corridos desde la firma del contrato'), NO calcules tú una " +
      "fecha: deja fecha_inicio en null y registra el plazo en plazo_texto (tal cual aparece), " +
      "plazo_dias (el número de días, convertido: semanas ×7, meses ×30) y ancla — 'documento' si se " +
      "cuenta desde un evento único de referencia (firma del contrato, adjudicación, publicación), o " +
      "'hito_anterior' si se cuenta desde que se completó el hito anterior de esta misma línea de " +
      "tiempo. El cálculo de la fecha real lo hace el sistema, no tú — tu trabajo es extraer el plazo " +
      "y su punto de partida con precisión. Ordena cronológicamente.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}
