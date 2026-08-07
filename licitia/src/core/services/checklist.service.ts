import * as XLSX from "xlsx";

// ============================================================================
// Checklist de sistemas y comparación contra el Excel de control.
//
// El comparador ya no enfrenta dos documentos analizados por IA: enfrenta el
// CHECKLIST extraído del documento técnico (sistemas → funcionalidades) contra
// un ÚNICO archivo Excel con formato predeterminado, que es donde el equipo
// lleva el control real de lo entregado. Esto hace la comparación
// determinista, instantánea y sin consumo de cuota de IA.
//
// El formato del Excel está documentado en docs/formato-excel.md y se puede
// descargar ya pre-llenado con el checklist del documento base desde la propia
// pantalla del comparador (buildTemplate).
// ============================================================================

/** Columnas del formato predeterminado, en orden. */
export const EXCEL_COLUMNS = [
  "Sistema",
  "Funcionalidad",
  "Estado",
  "Fecha entrega",
  "Plazo comprometido",
  "Adicional",
  "Sin costo",
  "Observaciones",
] as const;

export const SHEET_NAME = "Control de entregas";

export type DeliveryState = "entregado" | "en_desarrollo" | "pendiente";

export interface ControlRow {
  system: string;
  feature: string;
  state: DeliveryState;
  deliveredOn: string | null;
  deadline: string | null;
  isAdditional: boolean;
  isFree: boolean;
  notes: string | null;
  row: number;
}

export interface ChecklistFeature {
  id: string;
  name: string;
  deadlineText: string | null;
  isCompleted: boolean;
}

export interface ChecklistSystem {
  id: string;
  name: string;
  deadlineText: string | null;
  features: ChecklistFeature[];
}

export interface ComparedFeature {
  name: string;
  deadlineText: string | null;
  /** 'ausente' = el documento lo exige y el Excel no lo menciona. */
  state: DeliveryState | "ausente";
  deliveredOn: string | null;
  notes: string | null;
  excelRow: number | null;
}

export interface ComparedSystem {
  name: string;
  deadlineText: string | null;
  total: number;
  completed: number;
  pct: number;
  features: ComparedFeature[];
}

export interface ExtraItem {
  system: string;
  feature: string;
  state: DeliveryState;
  isAdditional: boolean;
  isFree: boolean;
  notes: string | null;
  row: number;
}

export interface ChecklistComparison {
  systems: ComparedSystem[];
  /** Lo que aparece en el Excel y NO exige el documento base: el hallazgo. */
  extras: ExtraItem[];
  totals: {
    totalFeatures: number;
    matched: number;
    completed: number;
    missing: number;
    extra: number;
    pctCompleted: number;
    freeExtras: number;
  };
}

// ─── Lectura del Excel ──────────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Palabras sin valor discriminante al emparejar funcionalidades. */
const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "y", "e", "o", "u", "a",
  "en", "por", "para", "con", "sin", "que", "se", "su", "sus", "al", "lo",
  "debe", "debera", "permitir", "sistema", "modulo",
]);

/**
 * Palabras significativas reducidas a su raíz aproximada (primeros 5
 * caracteres). Es un "stemmer" pobre pero eficaz para el español de las bases
 * técnicas, donde la misma exigencia se escribe en singular o plural y en
 * forma verbal o sustantivada: certificado/certificados, emitir/emisión,
 * conciliación/conciliar. Sin esta reducción, el emparejamiento exigiría una
 * redacción casi idéntica entre el documento y el Excel.
 */
const tokens = (s: string) =>
  norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => t.slice(0, 5));

/**
 * Similitud entre dos textos: coeficiente de Jaccard sobre esas raíces, con un
 * atajo para inclusión literal. Suficiente para emparejar "Emitir certificado
 * de residencia en PDF" con "Emisión de certificados de residencia (PDF)" sin
 * depender de una redacción idéntica.
 */
export function similarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

const MATCH_THRESHOLD = 0.5;

function parseState(raw: string): DeliveryState {
  const v = norm(raw);
  if (!v) return "pendiente";
  if (/(entregad|complet|listo|termin|finaliz|implementad|ok|si)/.test(v)) return "entregado";
  if (/(desarrollo|progreso|curso|parcial|avance)/.test(v)) return "en_desarrollo";
  return "pendiente";
}

const isYes = (raw: string) => /^(si|sí|s|x|true|1|verdadero)$/i.test(raw.trim());

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export class ExcelFormatError extends Error {}

/**
 * Lee el Excel de control. Exige las dos primeras columnas del formato
 * (Sistema y Funcionalidad); el resto son opcionales, así se puede empezar a
 * usar con una planilla mínima.
 */
export function parseControlWorkbook(buffer: Buffer): ControlRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new ExcelFormatError("No se pudo leer el archivo: ¿es un Excel (.xlsx) válido?");
  }

  const sheetName =
    workbook.SheetNames.find((n) => norm(n) === norm(SHEET_NAME)) ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new ExcelFormatError("El archivo no tiene ninguna hoja con datos.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (matrix.length < 2) {
    throw new ExcelFormatError(
      "La hoja está vacía. Descarga la plantilla desde el comparador y complétala."
    );
  }

  // Cabecera: se localiza la fila que contiene "Sistema" y "Funcionalidad",
  // así el archivo puede traer un título o un logo encima de la tabla.
  const headerIndex = matrix.findIndex((row) => {
    const cells = row.map((c) => norm(cellText(c)));
    return cells.includes("sistema") && cells.some((c) => c.startsWith("funcionalidad"));
  });
  if (headerIndex === -1) {
    throw new ExcelFormatError(
      `Formato no reconocido: falta la fila de encabezados con las columnas ${EXCEL_COLUMNS.join(
        ", "
      )}. Descarga la plantilla desde el comparador.`
    );
  }

  const header = matrix[headerIndex].map((c) => norm(cellText(c)));
  const col = (name: string) => header.findIndex((h) => h.startsWith(norm(name)));
  const idx = {
    system: col("sistema"),
    feature: col("funcionalidad"),
    state: col("estado"),
    deliveredOn: col("fecha entrega"),
    deadline: col("plazo comprometido"),
    additional: col("adicional"),
    free: col("sin costo"),
    notes: col("observaciones"),
  };

  const at = (row: unknown[], i: number) => (i >= 0 ? cellText(row[i]) : "");
  const rows: ControlRow[] = [];
  let currentSystem = "";

  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r];
    if (!raw || raw.length === 0) continue;
    // El Sistema puede escribirse una sola vez y dejarse en blanco en las
    // filas siguientes (así se llena a mano de forma natural).
    const system = at(raw, idx.system) || currentSystem;
    const feature = at(raw, idx.feature);
    if (!feature) continue;
    currentSystem = system;

    rows.push({
      system: system || "(sin sistema)",
      feature,
      state: parseState(at(raw, idx.state)),
      deliveredOn: at(raw, idx.deliveredOn) || null,
      deadline: at(raw, idx.deadline) || null,
      isAdditional: isYes(at(raw, idx.additional)),
      isFree: isYes(at(raw, idx.free)),
      notes: at(raw, idx.notes) || null,
      row: r + 1, // 1-indexado, como lo muestra Excel
    });
  }

  if (rows.length === 0) {
    throw new ExcelFormatError(
      "No se encontró ninguna fila con funcionalidad. Completa al menos la columna “Funcionalidad”."
    );
  }
  return rows;
}

// ─── Comparación ────────────────────────────────────────────────────────────

/**
 * Enfrenta el checklist del documento base contra las filas del Excel.
 *
 * Cada funcionalidad del documento busca su mejor coincidencia en el Excel;
 * las filas del Excel que no llegan a emparejarse con ninguna funcionalidad
 * exigida quedan como EXTRA: es el hallazgo que el usuario quiere ver
 * destacado (trabajo entregado fuera de lo comprometido, muchas veces gratis).
 */
export function compareChecklist(
  systems: ChecklistSystem[],
  rows: ControlRow[]
): ChecklistComparison {
  const usedRows = new Set<number>();
  const compared: ComparedSystem[] = [];
  let matched = 0;
  let completed = 0;
  let missing = 0;

  for (const system of systems) {
    const features: ComparedFeature[] = system.features.map((feature) => {
      let best: { row: ControlRow; score: number } | null = null;
      for (const row of rows) {
        if (usedRows.has(row.row)) continue;
        // El nombre del sistema aporta contexto, pero no manda: el Excel puede
        // agrupar distinto. Pesa poco frente al nombre de la funcionalidad.
        const score =
          similarity(feature.name, row.feature) * 0.85 +
          similarity(system.name, row.system) * 0.15;
        if (score > (best?.score ?? 0)) best = { row, score };
      }

      if (!best || best.score < MATCH_THRESHOLD) {
        missing++;
        return {
          name: feature.name,
          deadlineText: feature.deadlineText,
          state: "ausente",
          deliveredOn: null,
          notes: null,
          excelRow: null,
        };
      }

      usedRows.add(best.row.row);
      matched++;
      if (best.row.state === "entregado") completed++;
      return {
        name: feature.name,
        deadlineText: feature.deadlineText ?? best.row.deadline,
        state: best.row.state,
        deliveredOn: best.row.deliveredOn,
        notes: best.row.notes,
        excelRow: best.row.row,
      };
    });

    const done = features.filter((f) => f.state === "entregado").length;
    compared.push({
      name: system.name,
      deadlineText: system.deadlineText,
      total: features.length,
      completed: done,
      pct: features.length === 0 ? 0 : Math.round((done / features.length) * 100),
      features,
    });
  }

  const extras: ExtraItem[] = rows
    .filter((r) => !usedRows.has(r.row))
    .map((r) => ({
      system: r.system,
      feature: r.feature,
      state: r.state,
      isAdditional: r.isAdditional,
      isFree: r.isFree,
      notes: r.notes,
      row: r.row,
    }));

  const totalFeatures = systems.reduce((n, s) => n + s.features.length, 0);

  return {
    systems: compared,
    extras,
    totals: {
      totalFeatures,
      matched,
      completed,
      missing,
      extra: extras.length,
      pctCompleted: totalFeatures === 0 ? 0 : Math.round((completed / totalFeatures) * 100),
      freeExtras: extras.filter((e) => e.isFree).length,
    },
  };
}

// ─── Plantilla descargable ──────────────────────────────────────────────────

/**
 * Genera el Excel con el formato predeterminado, pre-llenado con el checklist
 * del documento base: el usuario solo completa las columnas de la derecha y
 * agrega al final las filas de lo que entregó de más.
 */
export function buildTemplate(documentTitle: string, systems: ChecklistSystem[]): Buffer {
  const rows: string[][] = [[...EXCEL_COLUMNS]];

  for (const system of systems) {
    for (const feature of system.features) {
      rows.push([
        system.name,
        feature.name,
        feature.isCompleted ? "Entregado" : "Pendiente",
        "",
        feature.deadlineText ?? system.deadlineText ?? "",
        "No",
        "No",
        "",
      ]);
    }
  }
  // Ejemplo de fila adicional: enseña el formato de lo entregado de más, que
  // es justo lo que el comparador destaca.
  rows.push([
    "(Ejemplo — bórralo) Trabajos adicionales",
    "Describe aquí un desarrollo entregado que no estaba comprometido",
    "Entregado",
    "",
    "",
    "Sí",
    "Sí",
    "Realizado sin costo para el cliente",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 32 }, { wch: 60 }, { wch: 14 }, { wch: 14 },
    { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 40 },
  ];

  const info = XLSX.utils.aoa_to_sheet([
    ["Formato de control de entregas — LicitIA"],
    [],
    ["Documento base", documentTitle],
    ["Generado", new Date().toISOString().slice(0, 10)],
    [],
    ["Cómo completarlo"],
    ["1", "Completa la hoja “Control de entregas”. No cambies la fila de encabezados."],
    ["2", "Estado: Entregado / En desarrollo / Pendiente."],
    ["3", "Fecha entrega: formato AAAA-MM-DD (opcional)."],
    ["4", "Adicional: Sí cuando el trabajo NO estaba comprometido en el documento base."],
    ["5", "Sin costo: Sí cuando se entregó sin cobro al cliente."],
    ["6", "Agrega al final tantas filas como quieras: lo que no exija el documento base se"],
    ["", "destacará como trabajo adicional en el resultado de la comparación."],
  ]);
  info["!cols"] = [{ wch: 16 }, { wch: 80 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, info, "Instrucciones");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
