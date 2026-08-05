import { MODELS, openai } from "@/lib/openai";
import type { PageText } from "@/core/domain/types";
import { logger } from "@/lib/logger";

/**
 * OCR de PDFs escaneados usando la capacidad de visión de OpenAI:
 * se sube el PDF a la Files API y se pide la transcripción página a página.
 * Ventaja sobre Tesseract en serverless: sin binarios nativos, mejor con
 * tablas, sellos y documentos públicos chilenos de baja calidad.
 */
export async function ocrPdf(buffer: Buffer): Promise<PageText[]> {
  const client = openai();

  const file = await client.files.create({
    file: new File([new Uint8Array(buffer)], "documento.pdf", { type: "application/pdf" }),
    purpose: "user_data",
  });

  try {
    const response = await client.chat.completions.create({
      model: MODELS.fast,
      messages: [
        {
          role: "system",
          content:
            "Eres un motor OCR. Transcribe fielmente el texto del PDF adjunto. " +
            "No resumas, no corrijas, no traduzcas. Conserva números, fechas y montos exactos. " +
            "Separa cada página con una línea que contenga exactamente: === PÁGINA N ===",
        },
        {
          role: "user",
          content: [
            { type: "file", file: { file_id: file.id } },
            { type: "text", text: "Transcribe el documento completo, página por página." },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message.content ?? "";
    return splitOcrPages(raw);
  } finally {
    // El PDF ya está en Supabase Storage; no lo retenemos en OpenAI.
    await client.files.del(file.id).catch((err: unknown) => {
      logger.warn("ocr_file_cleanup_failed", { error: String(err) });
    });
  }
}

/** Divide la transcripción OCR en páginas usando los separadores === PÁGINA N ===. */
export function splitOcrPages(raw: string): PageText[] {
  const parts = raw.split(/===\s*P[ÁA]GINA\s+(\d+)\s*===/i);
  const pages: PageText[] = [];

  // parts = [preludio, "1", contenido1, "2", contenido2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const pageNumber = parseInt(parts[i], 10);
    const content = (parts[i + 1] ?? "").trim();
    if (content) pages.push({ pageNumber, content, ocrUsed: true });
  }

  // Sin separadores: todo el texto como página única
  if (pages.length === 0 && raw.trim()) {
    pages.push({ pageNumber: 1, content: raw.trim(), ocrUsed: true });
  }
  return pages;
}
