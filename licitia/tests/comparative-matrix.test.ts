import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildComparativeRows, buildComparativeWorkbook } from "@/core/services/comparative-matrix.service";

/** Supabase mínimo: solo las tablas que toca buildComparativeRows, con datos
 *  para dos documentos — uno con todo completo, otro casi vacío (para
 *  probar que los campos ausentes caen en "—" en vez de romper). */
function fakeSupabase(): SupabaseClient {
  const documents = [
    {
      id: "doc-a",
      title: "Bases SLEP Reloncaví",
      tender_number: "2397-45-LR26",
      contract_duration: "24 meses",
      amount: 185_000_000,
      currency: "CLP",
      clients: { name: "SLEP Reloncaví" },
    },
    {
      id: "doc-b",
      title: "Bases Municipalidad Vacía",
      tender_number: null,
      contract_duration: null,
      amount: null,
      currency: null,
      clients: null,
    },
  ];
  const versions = [{ id: "v-a", document_id: "doc-a" }];
  const summaries = [
    {
      version_id: "v-a",
      implementation_deadline: "90 días corridos desde la firma",
      budget_amount: 185_000_000,
      budget_currency: "CLP",
      budget_period: "total",
      evaluation_criteria: [{ criterio: "Precio", ponderacion: "40%", pauta: "Menor precio, mayor puntaje" }],
      evaluation_methodology: "Se adjudica a la oferta con mayor puntaje total.",
    },
  ];
  const systems = [{ document_id: "doc-a", name: "Sistema de Rentas" }];
  const requirements = [
    { document_id: "doc-a", critical_type: "servidores", title: "Servidores en nube nacional", description: null, deadline_text: null },
    { document_id: "doc-a", critical_type: "multas", title: "5 UTM por día de atraso", description: null, deadline_text: null },
    { document_id: "doc-a", critical_type: "experiencia", title: "3 años de experiencia mínima", description: "en proyectos similares", deadline_text: null },
  ];

  return {
    from: (table: string) => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          if (table === "documents") return Promise.resolve({ data: documents.filter((d) => ids.includes(d.id)) });
          if (table === "document_versions") {
            // encadena .eq() después de .in()
            return { eq: () => Promise.resolve({ data: versions.filter((v) => ids.includes(v.document_id)) }) };
          }
          if (table === "systems") return Promise.resolve({ data: systems.filter((s) => ids.includes(s.document_id)) });
          if (table === "requirements") return Promise.resolve({ data: requirements.filter((r) => ids.includes(r.document_id)) });
          if (table === "document_summaries") return Promise.resolve({ data: summaries.filter((s) => ids.includes(s.version_id)) });
          throw new Error(`tabla no mockeada: ${table}`);
        },
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("buildComparativeRows", () => {
  it("arma una fila por documento con lo ya extraído, sin llamar a la IA", async () => {
    const rows = await buildComparativeRows(fakeSupabase(), ["doc-a", "doc-b"]);
    expect(rows).toHaveLength(2);

    const a = rows.find((r) => r.documento === "Bases SLEP Reloncaví")!;
    expect(a.numeroLicitacion).toBe("2397-45-LR26");
    expect(a.cliente).toBe("SLEP Reloncaví");
    expect(a.softwaresOServicios).toBe("Sistema de Rentas");
    expect(a.caracteristicasServidores).toContain("Servidores en nube nacional");
    expect(a.multas).toContain("5 UTM por día de atraso");
    expect(a.experienciaSolicitada).toContain("3 años de experiencia mínima: en proyectos similares");
    expect(a.plazoImplementacion).toBe("90 días corridos desde la firma");
    expect(a.presupuesto).toMatch(/185.*000.*000/);
    expect(a.pautaEvaluacion).toContain("Precio (40%)");
    expect(a.pautaEvaluacion).toContain("mayor puntaje total");
  });

  it("un documento sin nada procesado cae en '—' en cada campo, sin romper", async () => {
    const rows = await buildComparativeRows(fakeSupabase(), ["doc-a", "doc-b"]);
    const b = rows.find((r) => r.documento === "Bases Municipalidad Vacía")!;
    expect(b.numeroLicitacion).toBe("—");
    expect(b.cliente).toBe("—");
    expect(b.softwaresOServicios).toBe("—");
    expect(b.sla).toBe("—");
  });

  it("preserva el orden en que se pidieron los documentos", async () => {
    const rows = await buildComparativeRows(fakeSupabase(), ["doc-b", "doc-a"]);
    expect(rows.map((r) => r.documento)).toEqual(["Bases Municipalidad Vacía", "Bases SLEP Reloncaví"]);
  });

  it("sin ids, devuelve una lista vacía sin consultar nada", async () => {
    expect(await buildComparativeRows(fakeSupabase(), [])).toEqual([]);
  });
});

describe("buildComparativeWorkbook", () => {
  it("genera un .xlsx válido con el encabezado esperado y una fila por documento", async () => {
    const rows = await buildComparativeRows(fakeSupabase(), ["doc-a", "doc-b"]);
    const buffer = buildComparativeWorkbook(rows);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(aoa[0]).toContain("N° Licitación");
    expect(aoa[0]).toContain("Pauta de Evaluación");
    expect(aoa).toHaveLength(3); // encabezado + 2 documentos
  });
});
