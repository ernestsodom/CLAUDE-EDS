import { describe, expect, it } from "vitest";
import { splitAnswerAndCitations, CITATION_DELIMITER } from "@/core/services/chat.service";

describe("splitAnswerAndCitations", () => {
  it("separa respuesta y bloque de citas", () => {
    const full = `La licitación exige firma electrónica avanzada.\n${CITATION_DELIMITER}\n{"citas":[{"chunk_id":"abc","cita_textual":"deberá firmarse con FEA","pagina":18,"seccion":"Art. 12"}],"confianza":0.92}`;
    const { answer, citations, confidence } = splitAnswerAndCitations(full);
    expect(answer).toBe("La licitación exige firma electrónica avanzada.");
    expect(citations).toHaveLength(1);
    expect(citations[0].pagina).toBe(18);
    expect(confidence).toBeCloseTo(0.92);
  });

  it("tolera respuesta sin bloque de citas", () => {
    const { answer, citations, confidence } = splitAnswerAndCitations("Solo texto");
    expect(answer).toBe("Solo texto");
    expect(citations).toEqual([]);
    expect(confidence).toBeNull();
  });

  it("tolera JSON de citas malformado sin romper", () => {
    const { answer, citations } = splitAnswerAndCitations(
      `Respuesta\n${CITATION_DELIMITER}\n{json invalido`
    );
    expect(answer).toBe("Respuesta");
    expect(citations).toEqual([]);
  });

  it("tolera bloque de citas envuelto en fence markdown", () => {
    const full = `R\n${CITATION_DELIMITER}\n\`\`\`json\n{"citas":[],"confianza":0.5}\n\`\`\``;
    const { confidence } = splitAnswerAndCitations(full);
    expect(confidence).toBe(0.5);
  });
});
