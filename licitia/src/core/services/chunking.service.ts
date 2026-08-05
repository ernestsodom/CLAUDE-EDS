import type { Chunk, PageText } from "@/core/domain/types";
import { estimateTokens } from "@/lib/utils";

const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 120;

/** Detecta encabezados de sección típicos de bases/contratos chilenos. */
const SECTION_RE =
  /^\s*(?:(?:[IVXLC]+|\d+(?:\.\d+)*)[.)-]\s+|ART[ÍI]CULO\s+\d+|CAP[ÍI]TULO\s+|ANEXO\s+|T[ÍI]TULO\s+)(.{3,80})$/im;

/**
 * Divide el texto por páginas en chunks de ~800 tokens con solape de ~120,
 * respetando límites de párrafo y rastreando página inicio/fin y sección.
 */
export function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: Array<{ text: string; page: number }> = [];
  let bufferTokens = 0;
  let currentSection: string | null = null;
  let index = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.map((b) => b.text).join("\n\n").trim();
    if (!content) {
      buffer = [];
      bufferTokens = 0;
      return;
    }
    chunks.push({
      index: index++,
      content,
      pageStart: buffer[0].page,
      pageEnd: buffer[buffer.length - 1].page,
      section: currentSection,
      tokenCount: estimateTokens(content),
    });
    // Solape: conserva los últimos párrafos hasta OVERLAP_TOKENS
    const kept: Array<{ text: string; page: number }> = [];
    let keptTokens = 0;
    for (let i = buffer.length - 1; i >= 0 && keptTokens < OVERLAP_TOKENS; i--) {
      kept.unshift(buffer[i]);
      keptTokens += estimateTokens(buffer[i].text);
    }
    buffer = kept;
    bufferTokens = keptTokens;
  };

  for (const page of pages) {
    const paragraphs = page.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const paragraph of paragraphs) {
      const sectionMatch = paragraph.match(SECTION_RE);
      if (sectionMatch) currentSection = sectionMatch[0].trim().slice(0, 120);

      const tokens = estimateTokens(paragraph);

      // Párrafo gigante: se parte por oraciones
      if (tokens > TARGET_TOKENS) {
        flush();
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let piece = "";
        for (const sentence of sentences) {
          if (estimateTokens(piece + sentence) > TARGET_TOKENS && piece) {
            buffer.push({ text: piece.trim(), page: page.pageNumber });
            bufferTokens += estimateTokens(piece);
            flush();
            piece = "";
          }
          piece += sentence + " ";
        }
        if (piece.trim()) {
          buffer.push({ text: piece.trim(), page: page.pageNumber });
          bufferTokens += estimateTokens(piece);
        }
        continue;
      }

      if (bufferTokens + tokens > TARGET_TOKENS) flush();
      buffer.push({ text: paragraph, page: page.pageNumber });
      bufferTokens += tokens;
    }
  }
  flush();
  // El flush final puede dejar solo el solape en buffer; descartarlo si ya fue emitido
  return dedupeTrailing(chunks);
}

function dedupeTrailing(chunks: Chunk[]): Chunk[] {
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (prev.content.endsWith(last.content)) chunks.pop();
  }
  return chunks;
}
