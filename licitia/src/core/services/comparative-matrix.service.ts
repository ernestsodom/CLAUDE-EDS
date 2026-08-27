import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUDGET_PERIOD_LABELS, type CRITICAL_TYPES } from "@/core/ai/schemas";
import { norm } from "@/lib/text-match";

// ============================================================================
// Cuadro comparativo múltiple: una fila por licitación con los campos que
// normalmente se comparan a mano entre varias bases — número, cliente,
// software solicitado, plazos, presupuesto, ubicación de servidores,
// experiencia, migración, certificado ISO 9001 y ponderación de cada
// criterio de evaluación. Arma el cuadro con lo que YA quedó extraído al
// procesar cada documento (resumen, puntos críticos, sistemas) — no hace
// una llamada nueva a la IA: es ensamblaje de datos, instantáneo y sin
// costo de IA adicional.
//
// Cada celda debe ser precisa y corta, no un párrafo — así lo pidió el
// usuario, con una planilla de ejemplo mostrando el formato exacto. Los
// campos que antes eran texto libre extenso (servidores, certificaciones,
// pauta de evaluación completa) ahora se reducen a un valor corto mediante
// heurísticas de palabras clave sobre lo ya extraído — nunca se inventa un
// dato que no esté en el documento; cuando no se puede reducir con
// confianza, se deja "—" en vez de adivinar.
// ============================================================================

type CriticalType = (typeof CRITICAL_TYPES)[number];

export interface ComparativeRow {
  documento: string;
  numeroLicitacion: string;
  cliente: string;
  softwaresOServicios: string;
  plazoContrato: string;
  plazoImplementacion: string;
  presupuesto: string;
  ubicacionServidor: string;
  experienciaSolicitada: string;
  migracionSolicitada: string;
  certificadoIso9001: string;
  /** 0–1 cuando se pudo convertir la ponderación a fracción; el texto tal
   *  cual del documento cuando no se pudo (p.ej. "30 puntos" sin escala
   *  clara); "—" cuando el documento no definió ese criterio. */
  evaluacionPrecio: number | string;
  evaluacionExperiencia: number | string;
  evaluacionTecnica: number | string;
  evaluacionPlanIntegridad: number | string;
}

const DASH = "—";

/** Corta un texto a un largo razonable para una celda — el objetivo es una
 *  respuesta precisa, no un párrafo completo. */
function concise(text: string, maxChars = 140): string {
  const clean = text.trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1).trimEnd()}…` : clean;
}

/** Une varios ítems en una sola celda corta: como máximo `maxItems`, y el
 *  resto se resume en "+N más" en vez de seguir alargando la celda. */
function joinConcise(items: string[], maxItems = 2, maxChars = 160): string {
  if (items.length === 0) return DASH;
  const shown = items.slice(0, maxItems).map((i) => concise(i, 80));
  const extra = items.length - shown.length;
  const text = shown.join("; ") + (extra > 0 ? ` (+${extra} más)` : "");
  return concise(text, maxChars);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CL")} ${currency}`;
  }
}

interface RequirementLite {
  title: string;
  description: string | null;
}

/** Ubicación de los servidores en una palabra: mandante/municipalidad,
 *  proveedor, nube o datacenter — lo que de verdad se compara de un
 *  vistazo entre licitaciones. Si no calza con ningún patrón conocido, se
 *  corta el propio título del requerimiento en vez de forzar una
 *  categoría que el texto no confirma. */
function deriveServerLocation(items: RequirementLite[]): string {
  if (items.length === 0) return DASH;
  const text = items.map((i) => `${i.title} ${i.description ?? ""}`).join(" ");
  const t = norm(text);
  if (/municipalidad|mandante|dependencias del (?:cliente|servicio|mandante)/.test(t)) return "Municipalidad";
  if (/nube (?:publica|nacional|privada)|cloud/.test(t)) return "Nube";
  if (/datacenter|centro de datos/.test(t)) return "Datacenter";
  if (/on[\s-]?premise|instalaciones propias/.test(t)) return "On premise";
  if (/proveedor|oferente|adjudicatario|contratista/.test(t)) return "Proveedor";
  return concise(items[0].title, 60);
}

/** Exigencia de certificación ISO 9001, reducida a una respuesta corta.
 *  Distingue "no se menciona" (— ) de "se menciona pero no es
 *  obligatoria" (Opcional) de "se exige" (Sí exige) — nunca asume que
 *  "hay certificados" implica ISO 9001 específicamente. */
function deriveIso9001(items: RequirementLite[]): string {
  if (items.length === 0) return DASH;
  const text = items.map((i) => `${i.title} ${i.description ?? ""}`).join(" ");
  const t = norm(text);
  if (!/iso\s*9001/.test(t)) return "No exige ISO 9001";
  if (/deseable|opcional|preferente|no excluyente/.test(t)) return "Opcional";
  return "Sí exige";
}

type EvalBucket = "precio" | "experiencia" | "tecnica" | "integridad";

/** A qué columna de evaluación pertenece un criterio, por palabras clave —
 *  las cuatro categorías más comunes en licitaciones públicas chilenas.
 *  Un criterio que no calza con ninguna (p.ej. "Plazo de entrega") no se
 *  muestra: el cuadro solo tiene estas cuatro columnas fijas. */
function bucketForCriterio(criterio: string): EvalBucket | null {
  const t = norm(criterio);
  if (/precio|econ[oó]mic|oferta economica/.test(t)) return "precio";
  if (/experiencia/.test(t)) return "experiencia";
  if (/t[eé]cnic/.test(criterio) || /tecnic/.test(t)) return "tecnica";
  if (/integridad|probidad|compliance|cumplimiento normativo|[eé]tic/.test(t)) return "integridad";
  return null;
}

/** "25%" → 0.25 (número real en la celda); "30 puntos" → se muestra tal
 *  cual, porque sin conocer la escala total no hay forma honesta de
 *  convertirlo a fracción. */
function ponderacionToCell(ponderacion: string | null): number | string {
  if (!ponderacion) return DASH;
  const pct = ponderacion.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) return Math.round((parseFloat(pct[1].replace(",", ".")) / 100) * 1000) / 1000;
  return ponderacion;
}

/**
 * Arma las filas del cuadro comparativo para los documentos indicados,
 * consultando lo ya procesado (resumen ejecutivo de la versión actual,
 * puntos críticos y sistemas) en el mínimo de idas y vueltas a la base.
 */
export async function buildComparativeRows(
  supabase: SupabaseClient,
  documentIds: string[]
): Promise<ComparativeRow[]> {
  if (documentIds.length === 0) return [];

  const [{ data: docs }, { data: versions }, { data: systems }, { data: requirements }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, tender_number, contract_duration, amount, currency, clients(name)")
      .in("id", documentIds),
    supabase
      .from("document_versions")
      .select("id, document_id")
      .in("document_id", documentIds)
      .eq("is_current", true),
    supabase.from("systems").select("document_id, name").in("document_id", documentIds),
    supabase
      .from("requirements")
      .select("document_id, critical_type, title, description, deadline_text")
      .in("document_id", documentIds),
  ]);

  const versionIds = (versions ?? []).map((v) => v.id as string);
  const { data: summaries } =
    versionIds.length > 0
      ? await supabase
          .from("document_summaries")
          .select(
            "version_id, implementation_deadline, budget_amount, budget_currency, budget_period, evaluation_criteria, evaluation_methodology"
          )
          .in("version_id", versionIds)
      : { data: [] as never[] };

  const versionByDoc = new Map((versions ?? []).map((v) => [v.document_id as string, v.id as string]));
  const summaryByVersion = new Map((summaries ?? []).map((s) => [s.version_id as string, s]));

  const systemsByDoc = new Map<string, string[]>();
  for (const s of systems ?? []) {
    const list = systemsByDoc.get(s.document_id as string) ?? [];
    list.push(s.name as string);
    systemsByDoc.set(s.document_id as string, list);
  }

  const requirementsByDoc = new Map<string, Array<Record<string, unknown>>>();
  for (const r of requirements ?? []) {
    const list = requirementsByDoc.get(r.document_id as string) ?? [];
    list.push(r);
    requirementsByDoc.set(r.document_id as string, list);
  }

  const byType = (docId: string, type: CriticalType): RequirementLite[] =>
    (requirementsByDoc.get(docId) ?? [])
      .filter((r) => r.critical_type === type)
      .map((r) => ({ title: r.title as string, description: r.description as string | null }));

  const joinByType = (docId: string, type: CriticalType): string =>
    joinConcise(
      byType(docId, type).map((r) => (r.description ? `${r.title}: ${r.description}` : r.title))
    );

  // Se preserva el orden en que se pidieron los documentos — normalmente el
  // orden en que el usuario los seleccionó o los subió.
  const docsById = new Map((docs ?? []).map((d) => [d.id as string, d]));

  return documentIds
    .map((id) => docsById.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((doc) => {
      const versionId = versionByDoc.get(doc.id as string);
      const summary = versionId ? summaryByVersion.get(versionId) : null;
      const cliente = (doc.clients as unknown as { name: string } | null)?.name;

      const presupuestoAmount = summary?.budget_amount ?? doc.amount;
      const presupuestoCurrency = summary?.budget_currency ?? doc.currency ?? "CLP";
      const presupuestoPeriod = summary?.budget_period
        ? (BUDGET_PERIOD_LABELS[summary.budget_period as keyof typeof BUDGET_PERIOD_LABELS] ?? summary.budget_period)
        : null;
      const presupuesto =
        presupuestoAmount != null
          ? `${formatMoney(presupuestoAmount, presupuestoCurrency)}${presupuestoPeriod ? ` (${presupuestoPeriod})` : ""}`
          : DASH;

      const criterios = (summary?.evaluation_criteria ?? []) as Array<{
        criterio: string;
        ponderacion: string | null;
        pauta: string | null;
      }>;
      const evalByBucket: Record<EvalBucket, number | string> = {
        precio: DASH,
        experiencia: DASH,
        tecnica: DASH,
        integridad: DASH,
      };
      for (const c of criterios) {
        const bucket = bucketForCriterio(c.criterio);
        if (bucket) evalByBucket[bucket] = ponderacionToCell(c.ponderacion);
      }

      const row: ComparativeRow = {
        documento: doc.title as string,
        numeroLicitacion: (doc.tender_number as string | null) ?? DASH,
        cliente: cliente ?? DASH,
        softwaresOServicios: joinConcise(systemsByDoc.get(doc.id as string) ?? [], 3, 120),
        plazoContrato: (doc.contract_duration as string | null) ?? DASH,
        plazoImplementacion: summary?.implementation_deadline ? concise(summary.implementation_deadline, 80) : DASH,
        presupuesto,
        ubicacionServidor: deriveServerLocation(byType(doc.id as string, "servidores")),
        experienciaSolicitada: joinByType(doc.id as string, "experiencia"),
        migracionSolicitada: joinByType(doc.id as string, "migracion_datos"),
        certificadoIso9001: deriveIso9001(byType(doc.id as string, "certificados")),
        evaluacionPrecio: evalByBucket.precio,
        evaluacionExperiencia: evalByBucket.experiencia,
        evaluacionTecnica: evalByBucket.tecnica,
        evaluacionPlanIntegridad: evalByBucket.integridad,
      };
      return row;
    });
}

const COLUMNS: Array<{ header: string; key: keyof ComparativeRow; width: number; numFmt?: string }> = [
  { header: "Documento", key: "documento", width: 28 },
  { header: "N° Licitación", key: "numeroLicitacion", width: 16 },
  { header: "Cliente (Municipalidad)", key: "cliente", width: 22 },
  { header: "Softwares o Servicios Solicitados", key: "softwaresOServicios", width: 26 },
  { header: "Plazo del Contrato", key: "plazoContrato", width: 16 },
  { header: "Plazo de Implementación", key: "plazoImplementacion", width: 20 },
  { header: "Presupuesto", key: "presupuesto", width: 20 },
  { header: "Ubicación Servidor", key: "ubicacionServidor", width: 16 },
  { header: "Experiencia Solicitada", key: "experienciaSolicitada", width: 28 },
  { header: "Migración Solicitada", key: "migracionSolicitada", width: 28 },
  { header: "Certificado ISO 9001", key: "certificadoIso9001", width: 18 },
  { header: "Evaluación Precio", key: "evaluacionPrecio", width: 14, numFmt: "0%" },
  { header: "Evaluación Experiencia", key: "evaluacionExperiencia", width: 14, numFmt: "0%" },
  { header: "Evaluación Técnica", key: "evaluacionTecnica", width: 14, numFmt: "0%" },
  { header: "Evaluación Plan Integridad", key: "evaluacionPlanIntegridad", width: 16, numFmt: "0%" },
];

/** Alto de fila estimado a partir del texto más largo de esa fila, para que
 *  el ajuste de texto (wrapText) se vea bien apenas se abre el archivo, sin
 *  que el usuario tenga que estirar la fila a mano. */
function estimateRowHeight(row: ComparativeRow): number {
  let maxLines = 1;
  for (const col of COLUMNS) {
    const value = row[col.key];
    const text = typeof value === "number" ? String(value) : value;
    const charsPerLine = Math.max(8, col.width - 2);
    const lines = Math.ceil(text.length / charsPerLine) || 1;
    if (lines > maxLines) maxLines = lines;
  }
  return Math.min(15 * maxLines, 90);
}

/** Arma el .xlsx del cuadro comparativo: una fila por licitación, con texto
 *  ajustado (wrap) dentro de columnas de ancho fijo y moderado — para que
 *  una respuesta más larga crezca hacia abajo, no haga el archivo
 *  interminable hacia el lado. */
export async function buildComparativeWorkbook(rows: ComparativeRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cuadro comparativo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };

  for (const row of rows) {
    const added = sheet.addRow(row);
    added.alignment = { vertical: "top", wrapText: true };
    added.height = estimateRowHeight(row);
    for (const col of COLUMNS) {
      if (col.numFmt) added.getCell(col.key).numFmt = col.numFmt;
    }
  }

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
