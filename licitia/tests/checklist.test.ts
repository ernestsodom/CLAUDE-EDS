import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildComparisonExcel,
  buildComparisonPdf,
  buildComparisonWordPayload,
  buildTemplate,
  compareChecklist,
  ExcelFormatError,
  parseControlWorkbook,
  similarity,
  SHEET_NAME,
  type ChecklistSystem,
} from "@/core/services/checklist.service";

// ============================================================================
// El comparador del checklist es determinista: mismos datos ⇒ mismo resultado,
// sin llamar a ningún proveedor de IA. Estas pruebas fijan ese contrato.
// ============================================================================

const SISTEMAS: ChecklistSystem[] = [
  {
    id: "s1",
    name: "Portal de Atención Ciudadana",
    deadlineText: "60 días desde la firma",
    features: [
      { id: "f1", name: "Emitir certificado de residencia en PDF", deadlineText: null, isCompleted: false },
      { id: "f2", name: "Pago en línea con Webpay", deadlineText: null, isCompleted: false },
      { id: "f3", name: "Buscador de trámites por categoría", deadlineText: null, isCompleted: false },
    ],
  },
  {
    id: "s2",
    name: "Módulo de Tesorería",
    deadlineText: null,
    features: [
      { id: "f4", name: "Conciliación bancaria automática", deadlineText: null, isCompleted: false },
    ],
  },
];

function makeWorkbook(rows: string[][], sheetName = SHEET_NAME): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Sistema", "Funcionalidad", "Estado", "Fecha entrega", "Plazo comprometido", "Adicional", "Sin costo", "Observaciones"],
    ...rows,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("similitud de funcionalidades", () => {
  it("empareja redacciones distintas del mismo requisito", () => {
    expect(
      similarity("Emitir certificado de residencia en PDF", "Emisión de certificados de residencia (PDF)")
    ).toBeGreaterThan(0.5);
  });

  it("no empareja funcionalidades distintas", () => {
    expect(similarity("Pago en línea con Webpay", "Conciliación bancaria automática")).toBeLessThan(0.5);
  });
});

describe("lectura del Excel de control", () => {
  it("lee las filas del formato predeterminado", () => {
    const buffer = makeWorkbook([
      ["Portal de Atención Ciudadana", "Emisión de certificados de residencia (PDF)", "Entregado", "2026-03-14", "", "No", "No", ""],
      ["", "Pago en línea con Webpay", "En desarrollo", "", "", "No", "No", "Faltan credenciales"],
    ]);
    const rows = parseControlWorkbook(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0].state).toBe("entregado");
    expect(rows[1].state).toBe("en_desarrollo");
    // El sistema se arrastra: escribirlo una vez por grupo es lo natural.
    expect(rows[1].system).toBe("Portal de Atención Ciudadana");
    expect(rows[1].notes).toBe("Faltan credenciales");
  });

  it("interpreta Sí/No en adicional y sin costo", () => {
    const rows = parseControlWorkbook(
      makeWorkbook([["Extras", "Notificación por WhatsApp", "Entregado", "", "", "Sí", "Sí", "de cortesía"]])
    );
    expect(rows[0].isAdditional).toBe(true);
    expect(rows[0].isFree).toBe(true);
  });

  it("acepta una hoja con otro nombre si es la única", () => {
    const rows = parseControlWorkbook(makeWorkbook([["S", "Una funcionalidad", "", "", "", "", "", ""]], "Hoja1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe("pendiente"); // sin estado ⇒ pendiente
  });

  it("rechaza con un mensaje accionable un archivo sin encabezados", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["cualquier cosa"], ["otra fila"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Datos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseControlWorkbook(buffer)).toThrow(ExcelFormatError);
    expect(() => parseControlWorkbook(buffer)).toThrow(/plantilla/i);
  });
});

describe("comparación del checklist contra el Excel", () => {
  const rows = parseControlWorkbook(
    makeWorkbook([
      ["Portal de Atención Ciudadana", "Emisión de certificados de residencia (PDF)", "Entregado", "2026-03-14", "", "No", "No", ""],
      ["Portal de Atención Ciudadana", "Pago en línea con Webpay", "En desarrollo", "", "", "No", "No", ""],
      ["Portal de Atención Ciudadana", "Notificación por WhatsApp al vecino", "Entregado", "2026-04-02", "", "Sí", "Sí", "sin cobro"],
      ["Módulo de Tesorería", "Conciliación bancaria automática", "Entregado", "", "", "No", "No", ""],
    ])
  );
  const result = compareChecklist(SISTEMAS, rows);

  it("marca como ausente lo comprometido que no aparece en el Excel", () => {
    const portal = result.systems.find((s) => s.name.startsWith("Portal"))!;
    const buscador = portal.features.find((f) => f.name.includes("Buscador"))!;
    expect(buscador.state).toBe("ausente");
    expect(result.totals.missing).toBe(1);
  });

  it("destaca lo entregado de más, distinguiendo lo gratuito", () => {
    expect(result.extras).toHaveLength(1);
    expect(result.extras[0].feature).toContain("WhatsApp");
    expect(result.extras[0].isFree).toBe(true);
    expect(result.totals.freeExtras).toBe(1);
  });

  it("calcula el % sobre lo comprometido, sin que lo adicional lo infle", () => {
    // 4 funcionalidades exigidas, 2 entregadas ⇒ 50 %. El extra no cuenta.
    expect(result.totals.totalFeatures).toBe(4);
    expect(result.totals.completed).toBe(2);
    expect(result.totals.pctCompleted).toBe(50);
  });

  it("no usa dos veces la misma fila del Excel", () => {
    const usedRows = result.systems
      .flatMap((s) => s.features.map((f) => f.excelRow))
      .filter((r): r is number => r != null);
    expect(new Set(usedRows).size).toBe(usedRows.length);
  });

  it("resume el avance por sistema", () => {
    const tesoreria = result.systems.find((s) => s.name.startsWith("Módulo"))!;
    expect(tesoreria.pct).toBe(100);
  });
});

describe("plantilla descargable", () => {
  const buffer = buildTemplate("Bases técnicas de prueba", SISTEMAS);

  it("genera un Excel legible por el propio comparador", () => {
    const rows = parseControlWorkbook(buffer);
    // 4 funcionalidades + la fila de ejemplo de trabajo adicional.
    expect(rows).toHaveLength(5);
    expect(rows[0].system).toBe("Portal de Atención Ciudadana");
  });

  it("incluye una hoja de instrucciones", () => {
    const wb = XLSX.read(buffer, { type: "buffer" });
    expect(wb.SheetNames).toContain(SHEET_NAME);
    expect(wb.SheetNames).toContain("Instrucciones");
  });
});

describe("informe de resultado", () => {
  const rows = parseControlWorkbook(
    makeWorkbook([
      ["Portal de Atención Ciudadana", "Emisión de certificados de residencia (PDF)", "Entregado", "", "", "No", "No", ""],
      ["Módulo de Tesorería", "Conciliación bancaria automática", "Entregado", "", "", "No", "No", ""],
    ])
  );
  const result = compareChecklist(SISTEMAS, rows);

  it("genera un Excel legible, con resumen/detalle/extras", () => {
    const buffer = buildComparisonExcel("Bases técnicas de prueba", result);
    const wb = XLSX.read(buffer, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Resumen", "Detalle", "Entregado de más"]);
  });

  it("arma un payload de Word con una sección por sistema", () => {
    const payload = buildComparisonWordPayload("Bases técnicas de prueba", result);
    const titulos = payload.sections?.map((s) => s.title) ?? [];
    expect(titulos.some((t) => t.startsWith("Portal de Atención Ciudadana"))).toBe(true);
    expect(titulos.some((t) => t.startsWith("Módulo de Tesorería"))).toBe(true);
  });

  it("genera un PDF ejecutivo válido, con gráficos", async () => {
    const buffer = await buildComparisonPdf("Bases técnicas de prueba", result);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("el PDF ejecutivo no revienta con cero funcionalidades", async () => {
    const vacio = compareChecklist([{ id: "s0", name: "Sistema vacío", deadlineText: null, features: [] }], []);
    const buffer = await buildComparisonPdf("Sin funcionalidades", vacio);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
