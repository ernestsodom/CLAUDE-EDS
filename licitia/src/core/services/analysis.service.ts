import { structuredCompletion } from "@/core/ai/structured";
import {
  ClassificationSchema,
  DeliveredItemsSchema,
  RequirementsSchema,
  SummarySchema,
  SystemsSchema,
  TimelineSchema,
  type Classification,
  type DeliveredItems,
  type Requirements,
  type Summary,
  type Systems,
  type Timeline,
} from "@/core/ai/schemas";
import type { PageText } from "@/core/domain/types";
import type { ProviderId } from "@/lib/ai-providers";

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

export async function classifyDocument(pages: PageText[], provider: ProviderId): Promise<Classification> {
  return structuredCompletion({
    schema: ClassificationSchema,
    schemaName: "clasificacion_documento",
    provider,
    speed: "fast",
    system:
      "Eres un clasificador experto de documentos de licitaciones públicas chilenas. " +
      "Extrae los metadatos solicitados del documento. Usa null cuando el dato no aparezca. " +
      "El monto debe ser numérico sin separadores. Las fechas en formato ISO YYYY-MM-DD.",
    user: pagesToAnnotatedText(pages, 120_000),
  });
}

export async function summarizeDocument(pages: PageText[], provider: ProviderId): Promise<Summary> {
  return structuredCompletion({
    schema: SummarySchema,
    schemaName: "resumen_ejecutivo",
    provider,
    speed: "chat",
    system:
      "Eres un consultor senior de licitaciones. Genera un informe ejecutivo completo del documento: " +
      "resumen general, objetivo, alcance, plazo de implementación, presupuesto, problemas detectados, " +
      "requerimientos, obligaciones, restricciones, riesgos (con nivel y mitigación), aspectos críticos, " +
      "entregables, cronograma y recomendaciones accionables para el equipo comercial y técnico.\n" +
      "Presta especial atención a estos dos campos, que el usuario necesita ver siempre claros:\n" +
      "- plazo_implementacion: el plazo para implementar/poner en marcha la solución completa " +
      "(no un hito parcial), tal como lo indica el documento.\n" +
      "- presupuesto: el monto y, sobre todo, su periodicidad — indica explícitamente si es un pago " +
      "único (unico), un monto mensual (mensual, p.ej. arriendo de licencias o soporte), un monto " +
      "anual (anual), o el total acumulado del contrato completo (total). Si el documento menciona " +
      "varios montos con distinta periodicidad (p.ej. implementación única + soporte mensual), usa el " +
      "monto más relevante (normalmente el total del contrato) y aclara los demás en 'detalle'. " +
      "Nunca dejes un monto sin periodicidad si el documento la menciona.\n" +
      "Sé específico y fiel al texto.",
    user: pagesToAnnotatedText(pages),
  });
}

/**
 * Requerimientos CRÍTICOS únicamente: las condiciones que condicionan la
 * participación o exponen a sanción. Las funcionalidades del software NO van
 * aquí — se extraen como sistemas (extractSystems).
 */
export async function extractRequirements(pages: PageText[], provider: ProviderId): Promise<Requirements> {
  return structuredCompletion({
    schema: RequirementsSchema,
    schemaName: "requerimientos_criticos",
    provider,
    speed: "chat",
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
      "NO incluyas funcionalidades del software ni requisitos funcionales: esos se extraen aparte. " +
      "Para cada ítem, extrae también su plazo cuando el documento lo indique (p.ej. 'la migración de " +
      "datos deberá completarse en 30 días corridos previos a la marcha blanca'), con el texto tal cual " +
      "aparece; si no hay plazo explícito, null. Cada ítem con su cita textual y página. Si un tipo no " +
      "aparece en el documento, simplemente no lo incluyas. Sé breve y concreto: mejor pocos ítems bien " +
      "definidos que una lista larga.",
    user: pagesToAnnotatedText(pages),
  });
}

/**
 * Extrae los sistemas (software) que el documento exige y las funcionalidades
 * concretas de cada uno. Es la base del checklist de cumplimiento.
 */
export async function extractSystems(pages: PageText[], provider: ProviderId): Promise<Systems> {
  return structuredCompletion({
    schema: SystemsSchema,
    schemaName: "sistemas_y_funcionalidades",
    provider,
    speed: "chat",
    system:
      "Eres un analista funcional de licitaciones TI. Identifica los SISTEMAS o módulos de software " +
      "que el documento exige desarrollar, implementar o proveer, y para cada uno lista sus " +
      "FUNCIONALIDADES concretas y específicas.\n" +
      "Reglas:\n" +
      "- Un sistema es una pieza de software con nombre propio en el documento (p. ej. 'Sistema de " +
      "  Gestión de Permisos de Circulación', 'Portal de Atención Ciudadana', 'Módulo de Tesorería').\n" +
      "- Una funcionalidad es algo que el sistema debe permitir hacer, redactado en una línea y en " +
      "  términos verificables ('emitir certificado en PDF con firma electrónica'), nunca una " +
      "  generalidad ('debe ser moderno' o 'buena usabilidad').\n" +
      "- Indica el plazo de entrega cuando el documento lo señale, con el texto tal cual aparece " +
      "  ('60 días corridos desde la firma del contrato'); si no aparece, null.\n" +
      "- Si el documento describe un único sistema, devuelve un solo sistema con todas sus " +
      "  funcionalidades. Si describe requisitos sueltos sin agrupar, agrúpalos tú por sistema/módulo.\n" +
      "- No inventes: cada funcionalidad debe poder respaldarse con una cita del documento.",
    user: pagesToAnnotatedText(pages),
  });
}

/**
 * Extrae del documento de control (o informe de avance/acta) cada entrega
 * realizada como ítem individual, distinguiendo lo contractual de los
 * trabajos adicionales fuera de acuerdo y los realizados sin costo.
 */
export async function extractDeliveredItems(
  pages: PageText[],
  provider: ProviderId
): Promise<DeliveredItems> {
  return structuredCompletion({
    schema: DeliveredItemsSchema,
    schemaName: "entregas_realizadas",
    provider,
    speed: "chat",
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
    user: pagesToAnnotatedText(pages),
  });
}

export async function extractTimeline(pages: PageText[], provider: ProviderId): Promise<Timeline> {
  return structuredCompletion({
    schema: TimelineSchema,
    schemaName: "linea_de_tiempo",
    provider,
    speed: "fast",
    system:
      "Eres un planificador de proyectos. Construye la línea de tiempo del documento identificando: " +
      "inicio, hitos, capacitaciones, implementación, marcha blanca, recepción, garantía, soporte y término. " +
      "Si hay fechas absolutas úsalas; si solo hay plazos relativos ('30 días desde la firma'), " +
      "regístralos en plazo_texto y deja las fechas en null. Ordena cronológicamente.",
    user: pagesToAnnotatedText(pages, 150_000),
  });
}
