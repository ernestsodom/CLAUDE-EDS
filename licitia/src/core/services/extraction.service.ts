import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { ExtractedText, PageText } from "@/core/domain/types";
import { ocrPdf } from "./ocr.service";
import { logger } from "@/lib/logger";

/** Umbral: menos de 100 caracteres promedio por página ⇒ PDF escaneado ⇒ OCR. */
const SCANNED_CHARS_PER_PAGE = 100;

export interface ExtractInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/**
 * Extrae texto de PDF, DOCX, XLSX, PPTX y TXT.
 * Para PDF escaneado deriva automáticamente a OCR.
 * ZIP se maneja aparte en ingestion.service (genera documentos hijos).
 */
export async function extractText(input: ExtractInput): Promise<ExtractedText> {
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";

  if (input.mimeType === "application/pdf" || ext === "pdf") {
    return extractPdf(input.buffer);
  }
  if (ext === "docx" || input.mimeType.includes("wordprocessingml")) {
    return extractDocx(input.buffer);
  }
  if (ext === "xlsx" || input.mimeType.includes("spreadsheetml")) {
    return extractXlsx(input.buffer);
  }
  if (ext === "pptx" || ext === "ppt" || input.mimeType.includes("presentation")) {
    return extractPptx(input.buffer);
  }
  if (ext === "txt" || input.mimeType === "text/plain") {
    return {
      pages: [{ pageNumber: 1, content: input.buffer.toString("utf-8"), ocrUsed: false }],
      isScanned: false,
    };
  }
  throw new Error(`Formato no soportado: ${input.fileName} (${input.mimeType})`);
}

async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
  const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await unpdfExtract(pdf, { mergePages: false });

  const pages: PageText[] = (text as string[]).map((content, i) => ({
    pageNumber: i + 1,
    content: content.trim(),
    ocrUsed: false,
  }));

  const avgChars =
    pages.length > 0 ? pages.reduce((s, p) => s + p.content.length, 0) / pages.length : 0;

  if (avgChars < SCANNED_CHARS_PER_PAGE) {
    logger.info("pdf_scanned_detected", { pages: pages.length, avgChars });
    const ocrPages = await ocrPdf(buffer);
    return { pages: ocrPages, isScanned: true };
  }
  return { pages, isScanned: false };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedText> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    pages: [{ pageNumber: 1, content: result.value.trim(), ocrUsed: false }],
    isScanned: false,
  };
}

function extractXlsx(buffer: Buffer): ExtractedText {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const pages: PageText[] = workbook.SheetNames.map((name, i) => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return { pageNumber: i + 1, content: `[Hoja: ${name}]\n${csv}`.trim(), ocrUsed: false };
  });
  return { pages, isScanned: false };
}

async function extractPptx(buffer: Buffer): Promise<ExtractedText> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: true });
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const num = (s: string) => parseInt(s.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return num(a) - num(b);
    });

  const pages: PageText[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const parsed = parser.parse(xml);
    const texts: string[] = [];
    collectTextNodes(parsed, texts);
    pages.push({ pageNumber: i + 1, content: texts.join("\n").trim(), ocrUsed: false });
  }
  return { pages, isScanned: false };
}

/** Recolecta recursivamente los nodos de texto `a:t` del XML de PowerPoint. */
function collectTextNodes(node: unknown, out: string[]) {
  if (node == null) return;
  if (typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTextNodes(item, out);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "a:t") {
        if (typeof value === "string" && value.trim()) out.push(value.trim());
        else if (Array.isArray(value))
          for (const v of value) if (typeof v === "string" && v.trim()) out.push(v.trim());
      } else {
        collectTextNodes(value, out);
      }
    }
  }
}

/** Extrae entradas soportadas de un ZIP: [{fileName, buffer, mimeType}]. */
export async function extractZipEntries(
  buffer: Buffer
): Promise<Array<{ fileName: string; buffer: Buffer; mimeType: string }>> {
  const zip = await JSZip.loadAsync(buffer);
  const MIME: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  const entries: Array<{ fileName: string; buffer: Buffer; mimeType: string }> = [];
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || path.startsWith("__MACOSX")) continue;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!(ext in MIME)) continue;
    const content = await file.async("nodebuffer");
    entries.push({ fileName: path.split("/").pop()!, buffer: content, mimeType: MIME[ext] });
  }
  return entries;
}
