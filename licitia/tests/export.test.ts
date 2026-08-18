import { describe, expect, it } from "vitest";
import { exportAs } from "@/core/services/export.service";

const payload = {
  title: "Informe de prueba",
  sections: [{ title: "Resumen", paragraphs: ["Contenido de prueba con acentos: ñ, á."] }],
  table: { headers: ["Col A", "Col B"], rows: [["v1", 'valor con "comillas"'], ["v2", "b"]] },
};

describe("export.service", () => {
  it("genera DOCX válido (firma ZIP)", async () => {
    const buffer = await exportAs("docx", payload);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("genera PDF válido (firma %PDF)", async () => {
    const buffer = await exportAs("pdf", payload);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
