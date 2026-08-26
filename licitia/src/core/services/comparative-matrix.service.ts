import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUDGET_PERIOD_LABELS, type CRITICAL_TYPES } from "@/core/ai/schemas";

// ============================================================================
// Cuadro comparativo múltiple: una fila por licitación con los campos que
// normalmente se comparan a mano entre varias bases — número, cliente,
// software solicitado, plazos, presupuesto, servidores, multas, SLA,
// experiencia, migración, certificaciones y pauta de evaluación. Arma el
// cuadro con lo que YA quedó extraído al procesar cada documento (resumen,
// puntos críticos, sistemas) — no hace una llamada nueva a la IA: es
// ensamblaje de datos, instantáneo y sin costo de IA adicional.
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
  caracteristicasServidores: string;
  multas: string;
  sla: string;
  experienciaSolicitada: string;
  migracionSolicitada: string;
  certificacionesSolicitadas: string;
  pautaEvaluacion: string;
}

const DASH = "—";

function joinOrDash(items: string[]): string {
  return items.length > 0 ? items.join("; ") : DASH;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CL")} ${currency}`;
  }
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

  const byType = (docId: string, type: CriticalType): string => {
    const items = (requirementsByDoc.get(docId) ?? []).filter((r) => r.critical_type === type);
    return joinOrDash(
      items.map((r) => {
        let text = r.title as string;
        if (r.description) text += `: ${r.description}`;
        if (r.deadline_text) text += ` (plazo: ${r.deadline_text})`;
        return text;
      })
    );
  };

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
      const pautaEvaluacion = joinOrDash([
        ...criterios.map(
          (c) => `${c.criterio}${c.ponderacion ? ` (${c.ponderacion})` : ""}${c.pauta ? `: ${c.pauta}` : ""}`
        ),
        ...(summary?.evaluation_methodology ? [summary.evaluation_methodology] : []),
      ]);

      const row: ComparativeRow = {
        documento: doc.title as string,
        numeroLicitacion: (doc.tender_number as string | null) ?? DASH,
        cliente: cliente ?? DASH,
        softwaresOServicios: joinOrDash(systemsByDoc.get(doc.id as string) ?? []),
        plazoContrato: (doc.contract_duration as string | null) ?? DASH,
        plazoImplementacion: summary?.implementation_deadline ?? DASH,
        presupuesto,
        caracteristicasServidores: byType(doc.id as string, "servidores"),
        multas: byType(doc.id as string, "multas"),
        sla: byType(doc.id as string, "sla"),
        experienciaSolicitada: byType(doc.id as string, "experiencia"),
        migracionSolicitada: byType(doc.id as string, "migracion_datos"),
        certificacionesSolicitadas: byType(doc.id as string, "certificados"),
        pautaEvaluacion,
      };
      return row;
    });
}

const HEADERS = [
  "Documento",
  "N° Licitación",
  "Cliente (Municipalidad)",
  "Softwares o Servicios Solicitados",
  "Plazo del Contrato",
  "Plazo de Implementación",
  "Presupuesto",
  "Características Servidores",
  "Multas",
  "SLA",
  "Experiencia Solicitada",
  "Migración Solicitada",
  "Certificaciones Solicitadas",
  "Pauta de Evaluación",
];

/** Arma el .xlsx del cuadro comparativo: una fila por licitación, columnas
 *  anchas para que el texto libre sea legible sin tener que ajustar nada. */
export function buildComparativeWorkbook(rows: ComparativeRow[]): Buffer {
  const aoa = [
    HEADERS,
    ...rows.map((r) => [
      r.documento,
      r.numeroLicitacion,
      r.cliente,
      r.softwaresOServicios,
      r.plazoContrato,
      r.plazoImplementacion,
      r.presupuesto,
      r.caracteristicasServidores,
      r.multas,
      r.sla,
      r.experienciaSolicitada,
      r.migracionSolicitada,
      r.certificacionesSolicitadas,
      r.pautaEvaluacion,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [
    { wch: 32 }, { wch: 16 }, { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 22 },
    { wch: 24 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 50 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Cuadro comparativo");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
