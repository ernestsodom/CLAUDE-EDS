import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractText, extractZipEntries } from "@/core/services/extraction.service";

describe("extraction.service", () => {
  it("extrae TXT directamente", async () => {
    const result = await extractText({
      buffer: Buffer.from("Contenido del acta de reunión", "utf-8"),
      mimeType: "text/plain",
      fileName: "acta.txt",
    });
    expect(result.isScanned).toBe(false);
    expect(result.pages[0].content).toContain("acta de reunión");
  });

  it("rechaza formatos no soportados", async () => {
    await expect(
      extractText({ buffer: Buffer.from(""), mimeType: "image/png", fileName: "foto.png" })
    ).rejects.toThrow(/no soportado/i);
  });

  it("extrae solo entradas soportadas de un ZIP e ignora __MACOSX", async () => {
    const zip = new JSZip();
    zip.file("contrato.txt", "texto del contrato");
    zip.file("imagen.png", Buffer.from([0x89, 0x50]));
    zip.file("__MACOSX/._contrato.txt", "basura");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const entries = await extractZipEntries(buffer);
    expect(entries).toHaveLength(1);
    expect(entries[0].fileName).toBe("contrato.txt");
    expect(entries[0].mimeType).toBe("text/plain");
  });
});
