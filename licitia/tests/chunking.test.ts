import { describe, expect, it } from "vitest";
import { chunkPages } from "@/core/services/chunking.service";
import type { PageText } from "@/core/domain/types";

const page = (n: number, content: string): PageText => ({
  pageNumber: n,
  content,
  ocrUsed: false,
});

describe("chunkPages", () => {
  it("devuelve vacío para páginas vacías", () => {
    expect(chunkPages([])).toEqual([]);
  });

  it("genera un único chunk para texto corto", () => {
    const chunks = chunkPages([page(1, "Hola mundo.\n\nSegundo párrafo.")]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[0].pageEnd).toBe(1);
    expect(chunks[0].content).toContain("Hola mundo");
  });

  it("divide texto largo en múltiples chunks con solape", () => {
    const paragraph = "Este es un párrafo de contenido de licitación pública. ".repeat(30);
    const pages = [page(1, `${paragraph}\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`)];
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    // índices consecutivos
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    // cada chunk respeta aprox el presupuesto de tokens
    for (const c of chunks) expect(c.tokenCount).toBeLessThan(1200);
  });

  it("rastrea páginas de inicio y fin entre páginas", () => {
    const long = "Contenido relevante de las bases técnicas. ".repeat(50);
    const chunks = chunkPages([page(1, long), page(2, long), page(3, long)]);
    const last = chunks[chunks.length - 1];
    expect(last.pageEnd).toBeGreaterThanOrEqual(last.pageStart ?? 0);
    expect(chunks[0].pageStart).toBe(1);
  });

  it("detecta encabezados de sección", () => {
    const pages = [
      page(1, "ARTÍCULO 5 Garantías del contrato\n\nEl proveedor deberá constituir una garantía de fiel cumplimiento."),
    ];
    const chunks = chunkPages(pages);
    expect(chunks[0].section).toMatch(/ART[ÍI]CULO 5/i);
  });
});
