import { structuredCompletion } from "@/core/ai/structured";
import {
  ClassificationSchema,
  DeliveredItemsSchema,
  EvaluationSchema,
  RequirementsSchema,
  SummarySchema,
  SystemFeaturesSchema,
  SystemsSchema,
  TimelineSchema,
  type Classification,
  type DeliveredItems,
  type Evaluation,
  type Requirements,
  type Summary,
  type SystemFeatures,
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

/**
 * Instrucción de profundidad compartida por todos los prompts de extracción.
 *
 * Dividir el análisis en partes (una llamada por resumen/sistemas/timeline/etc.
 * en vez de todo junto) bajó el tiempo de respuesta, pero en un momento
 * también se le pidió a la IA ser breve dentro de cada parte — eso fue el
 * error: la parte correcta a reducir es el ALCANCE de cada llamada, no la
 * PROFUNDIDAD del contenido que devuelve. Este bloque se repite en cada
 * prompt para que ninguno vuelva a quedar corto por su cuenta.
 */
const DEPTH_INSTRUCTIONS =
  "Sé exhaustivo, no resumas de más: si el documento trae 15 ítems de un mismo tipo, devuelve los 15, " +
  "no una muestra de los más obvios. Prioriza la letra chica sobre la generalidad. Usa contexto más " +
  "allá de la frase aislada cuando el significado de un requisito dependa de otra cláusula del mismo " +
  "documento (p.ej. una exigencia técnica condicionada por una regla administrativa). Distingue tres " +
  "situaciones que NO son lo mismo: (1) el documento dice explícitamente que algo no aplica/no se " +
  "exige — usa false o indícalo en el texto; (2) el documento simplemente no menciona el tema — usa " +
  "null; (3) el documento lo menciona pero de forma ambigua o contradictoria entre dos secciones — en " +
  "ese caso indícalo explícitamente en el campo de texto correspondiente en vez de elegir una lectura " +
  "por tu cuenta. Nunca completes con supuestos lo que el documento no dice.";

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
      "sencillamente no la menciona. Completa a_quien (a quién exactamente: el oferente, el " +
      "fabricante del software, un subcontratista) y obligatoria_o_deseable (obligatoria = elimina la " +
      "oferta si falta; deseable = solo suma puntaje). En 'detalle' aclara con qué vigencia, si admite " +
      "certificaciones equivalentes y cómo se acredita. Cita el texto donde lo exige.\n" +
      "- migracion_datos: si hay que migrar datos desde el/los sistema(s) actual(es). Necesito cuatro " +
      "cosas claras: si se exige (exigida), QUÉ hay que migrar (informacion_a_migrar: qué datos, " +
      "entidades o módulos — no el volumen, el contenido), CUÁNTA información hay que migrar (volumen: " +
      "años de historia, número de registros, GB, cantidad de tablas o sistemas de origen, lo que el " +
      "documento cuantifique — null si no lo cuantifica) y el TIEMPO que dan para hacerla (plazo, con " +
      "el texto tal cual: '30 días corridos antes de la marcha blanca'). Indica también quién es " +
      "responsable de ejecutarla y de validarla si el documento lo dice (responsable).\n" +
      DEPTH_INSTRUCTIONS,
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
      "puntajes por tramo, umbrales mínimos, etc., tal como lo describe el documento, más página y " +
      "cita. Si el documento trae una tabla de evaluación, cada fila es un criterio separado — no la " +
      "resumas en un solo ítem. Al final, considera si el documento permite ver la ponderación total " +
      "consolidada (debería sumar 100% o el puntaje máximo indicado) y, si no cuadra, indícalo en " +
      "metodologia_evaluacion en vez de ajustar los números tú mismo.\n" +
      "- metodologia_evaluacion: las reglas generales que no son de un criterio puntual — cómo se suma " +
      "el puntaje total, desempates, causales de inadmisibilidad u ofertas fuera de bases.\n" +
      "- anexos_solicitados: cada anexo, formulario o documento adjunto que el documento exige presentar " +
      "(identificado por su número o nombre tal como aparece, p.ej. 'Anexo N°3 — Declaración Jurada'), " +
      "con su tipo (formulario, declaración jurada, certificado, boleta de garantía, antecedente legal, " +
      "propuesta técnica, otro), qué debe contener o acreditar, qué acción concreta debe hacer el " +
      "oferente con él (completarlo, firmarlo ante notario, adjuntar un respaldo, etc.), si es " +
      "obligatorio, página y cita. Sé exhaustivo: lista TODOS los anexos mencionados en el documento, " +
      "no solo los primeros o los más destacados — revisa también anexos mencionados de pasada dentro " +
      "de otras cláusulas, no solo los que traen su propia sección.\n" +
      "Fiel al texto: lo que el documento no defina va en null o en lista vacía. " +
      DEPTH_INSTRUCTIONS,
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
      "- multas: CADA multa, sanción, descuento o causal de término anticipado como un ítem SEPARADO — " +
      "si el documento trae una tabla de multas con varias filas, extrae cada fila individualmente, " +
      "nunca las resumas en un solo ítem genérico de 'multas'. Para cada una: qué incumplimiento la " +
      "gatilla (condicion), el monto o porcentaje exacto (valor), y sobre qué se calcula y su tope " +
      "máximo si el documento lo define (base_calculo, p.ej. 'por cada día de atraso, sobre el monto " +
      "mensual del contrato; tope 20% del contrato').\n" +
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
      "aparece; si no hay plazo explícito, null. Usa valor/base_calculo/condicion en cualquier tipo " +
      "donde apliquen (p.ej. el % de disponibilidad de un sla, el monto y vigencia de una " +
      "boleta_garantia), no solo en multas. Cada ítem con su cita textual y página. Si un tipo no " +
      "aparece en el documento, simplemente no lo incluyas. " +
      DEPTH_INSTRUCTIONS,
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Extrae ÚNICAMENTE el listado de sistemas (software) que el documento
 * exige — sin sus funcionalidades (ver SystemsSchema para el porqué: eso se
 * pide aparte, por sistema, cuando el usuario lo solicita).
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
      "- No inventes: cada sistema debe poder respaldarse con una cita del documento.\n" +
      "- Sé exhaustivo: lista TODOS los sistemas/módulos exigidos, aunque el documento los mencione " +
      "  dispersos en distintas secciones (bases técnicas, anexos, alcance) y no en un listado único.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}

/**
 * Extrae las funcionalidades de UN sistema concreto (ver SystemFeaturesSchema
 * para el porqué de pedirlas sistema por sistema y no en lote: es la etapa
 * que antes agotaba el tiempo y la cuota, precisamente por no acotarse).
 */
export async function extractSystemFeatures(
  pages: PageText[],
  systemName: string,
  provider: ProviderId,
  onUsage?: OnUsage
): Promise<SystemFeatures> {
  return structuredCompletion({
    schema: SystemFeaturesSchema,
    schemaName: "funcionalidades_del_sistema",
    provider,
    speed: "chat",
    onUsage,
    maxTokens: outputCapFor(provider),
    system:
      `Eres un analista funcional de licitaciones TI. El documento exige un sistema llamado ` +
      `"${systemName}" (u otro nombre equivalente para el mismo sistema, si el documento lo redactó ` +
      `distinto en otra sección). Extrae EXCLUSIVAMENTE las funcionalidades exigidas para ESE sistema — ` +
      `ignora por completo las exigencias de cualquier otro sistema mencionado en el documento.\n` +
      "Reglas:\n" +
      "- Cada funcionalidad es una exigencia concreta y verificable (p.ej. 'Emitir certificado de " +
      "  residencia en formato PDF firmado electrónicamente'), no una categoría genérica ('gestión de " +
      "  trámites'). Si el documento describe una funcionalidad con varios pasos o condiciones, decide " +
      "  si es una sola exigencia verificable o si en realidad son varias — sepáralas si lo son.\n" +
      "- obligatoria=false SOLO si el documento la marca explícitamente como deseable, opcional o " +
      "  adicional (deseable en la evaluación, no de admisibilidad). Por defecto, obligatoria=true.\n" +
      "- tipo_evidencia: 'explicito' cuando el documento lo pide con esas palabras; 'implicito' cuando " +
      "  se desprende necesariamente de una exigencia más general de este mismo sistema (p.ej. si exige " +
      "  'generar reportes' y en otra parte dice qué reportes, cada reporte es implícito de esa " +
      "  exigencia general); 'interpretacion' cuando es una lectura razonable pero no está dicho ni se " +
      "  desprende de forma directa — úsalo con moderación, nunca para rellenar la lista.\n" +
      "- Indica el plazo si el documento lo asocia a esta funcionalidad en particular (no el plazo " +
      "  general del sistema, salvo que sea lo único disponible).\n" +
      "- Cada funcionalidad con su página y cita textual — sin evidencia, no la incluyas.\n" +
      DEPTH_INSTRUCTIONS,
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
    // "chat" (el modelo grande) y no "fast": convertir plazos relativos a
    // días, elegir el ancla correcta (documento vs hito anterior) y no
    // perder hitos mencionados fuera del cronograma principal es más
    // razonamiento del que el modelo rápido resuelve bien.
    speed: "chat",
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
      "y su punto de partida con precisión. La descripción de cada hito debe explicar qué implica " +
      "concretamente (no solo repetir el título) y, cuando el documento lo diga, quién es responsable " +
      "de cumplirlo. Revisa todo el documento, no solo la sección de cronograma: hitos como la " +
      "migración de datos, la capacitación o el soporte suelen definirse en otras secciones (bases " +
      "técnicas, anexos) con su propio plazo, y deben incluirse igual. Ordena cronológicamente.",
    user: pagesToAnnotatedText(pages, charBudgetFor(provider, 150_000)),
  });
}
