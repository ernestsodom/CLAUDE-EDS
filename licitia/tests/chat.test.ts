import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { splitAnswerAndCitations, streamChatTurn, CITATION_DELIMITER } from "@/core/services/chat.service";

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

describe("motor local del chat (sin IA)", () => {
  /** Supabase mínimo: solo lo que usa localChatAnswer cuando el chat no está
   *  acotado a un documento (search_chunks_text + fetchDocTitles). */
  function fakeSupabase(hits: unknown[]): SupabaseClient {
    return {
      rpc: (name: string) => {
        if (name === "search_chunks_text") return Promise.resolve({ data: hits, error: null });
        throw new Error(`rpc no mockeado en el test: ${name}`);
      },
      from: (table: string) => {
        if (table === "documents") {
          return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "d1", title: "Bases Técnicas" }] }) }) };
        }
        throw new Error(`from no mockeado en el test: ${table}`);
      },
    } as unknown as SupabaseClient;
  }

  async function collect(stream: AsyncIterable<string>): Promise<string> {
    let out = "";
    for await (const part of stream) out += part;
    return out;
  }

  it("responde con los fragmentos encontrados por búsqueda léxica, sin llamar a ningún proveedor de IA", async () => {
    const supabase = fakeSupabase([
      {
        chunk_id: "c1",
        document_id: "d1",
        content: "El oferente deberá presentar boleta de garantía de fiel cumplimiento por el 5% del monto total.",
        page_start: 12,
        page_end: 12,
        section: "Cláusula 8.3",
        rank: 0.9,
      },
    ]);

    const { textStream, engine, model } = await streamChatTurn({
      supabase,
      agent: "analista",
      question: "¿Qué garantía exige?",
      history: [],
      filters: {},
      engine: "local",
    });

    expect(engine).toBe("local");
    expect(model).toBe("motor-local");

    const full = await collect(textStream);
    const { answer, citations, confidence } = splitAnswerAndCitations(full);
    expect(answer).toContain("boleta de garantía");
    expect(answer).toContain("Bases Técnicas");
    expect(citations).toHaveLength(1);
    expect(citations[0].pagina).toBe(12);
    expect(citations[0].seccion).toBe("Cláusula 8.3");
    // No hay IA de por medio: no hay una "confianza" evaluada por un modelo.
    expect(confidence).toBeNull();
  });

  it("avisa cuando no hay coincidencias literales, en vez de inventar una respuesta", async () => {
    const supabase = fakeSupabase([]);
    const { textStream } = await streamChatTurn({
      supabase,
      agent: "analista",
      question: "¿Existe cláusula de fuerza mayor?",
      history: [],
      filters: {},
      engine: "local",
    });
    const full = await collect(textStream);
    const { answer, citations } = splitAnswerAndCitations(full);
    expect(answer).toMatch(/no se encontraron coincidencias/i);
    expect(citations).toEqual([]);
  });
});
