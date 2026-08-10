import { describe, expect, it } from "vitest";
import { sanitizeStorageFileName } from "@/lib/utils";

// ============================================================================
// Bug reproducido en producción: Supabase Storage responde "Invalid key" con
// nombres de archivo que traen tildes, "ñ" o símbolos como "°" — justo lo
// habitual en documentos de licitaciones chilenas ("Bases Técnicas",
// "Anexo N°1"). sanitizeStorageFileName() es lo que evita que la subida
// falle con esos nombres, sin perder el nombre original para mostrarlo.
// ============================================================================

describe("sanitizeStorageFileName", () => {
  it("quita tildes conservando la letra, en vez de reemplazarla", () => {
    expect(sanitizeStorageFileName("Bases_Administrativas_y_Técnicas.docx")).toBe(
      "Bases_Administrativas_y_Tecnicas.docx"
    );
  });

  it("reemplaza símbolos no soportados por Storage (°) sin romper el nombre", () => {
    expect(sanitizeStorageFileName("Anexo_N°1.docx")).toBe("Anexo_N_1.docx");
  });

  it("conserva nombres ya seguros sin cambios", () => {
    expect(sanitizeStorageFileName("contrato-2026.pdf")).toBe("contrato-2026.pdf");
  });

  it("normaliza eñes y otros diacríticos comunes en español", () => {
    expect(sanitizeStorageFileName("Municipalidad_de_Peñalolén.pdf")).toBe(
      "Municipalidad_de_Penalolen.pdf"
    );
  });

  it("no deja la ruta vacía si el nombre es solo símbolos", () => {
    const result = sanitizeStorageFileName("★★★.pdf");
    expect(result).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
    expect(result.length).toBeGreaterThan(4);
  });

  it("preserva la extensión en minúsculas y sin caracteres raros", () => {
    expect(sanitizeStorageFileName("Informe (final).PDF")).toMatch(/\.PDF$/);
  });

  it("recorta nombres extremadamente largos sin perder la extensión", () => {
    const long = "a".repeat(300) + ".docx";
    const result = sanitizeStorageFileName(long);
    expect(result.endsWith(".docx")).toBe(true);
    expect(result.length).toBeLessThan(170);
  });
});
