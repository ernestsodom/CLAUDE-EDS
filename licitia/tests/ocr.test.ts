import { describe, expect, it } from "vitest";
import { splitOcrPages } from "@/core/services/ocr.service";

describe("splitOcrPages", () => {
  it("divide la transcripción en páginas numeradas", () => {
    const raw = `=== PÁGINA 1 ===\nTexto de la primera página\n=== PÁGINA 2 ===\nTexto de la segunda`;
    const pages = splitOcrPages(raw);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ pageNumber: 1, ocrUsed: true });
    expect(pages[1].content).toBe("Texto de la segunda");
  });

  it("acepta el separador sin tilde", () => {
    const pages = splitOcrPages("=== PAGINA 3 ===\nContenido");
    expect(pages[0].pageNumber).toBe(3);
  });

  it("sin separadores devuelve página única", () => {
    const pages = splitOcrPages("Texto plano sin separadores");
    expect(pages).toHaveLength(1);
    expect(pages[0].pageNumber).toBe(1);
  });

  it("texto vacío devuelve lista vacía", () => {
    expect(splitOcrPages("")).toEqual([]);
  });
});
