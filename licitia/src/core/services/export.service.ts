import * as XLSX from "xlsx";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import PptxGenJS from "pptxgenjs";

// ============================================================================
// Exportaciones: CSV, Excel, Word, PDF y PowerPoint a partir de datos
// tabulares o de secciones de texto (p.ej. resumen ejecutivo, comparaciones).
// Devuelven Buffer listo para responder con el content-type adecuado.
// ============================================================================

export type ExportFormat = "csv" | "xlsx" | "docx" | "pdf" | "pptx";

export interface ExportSection {
  title: string;
  paragraphs: string[];
}

export interface ExportPayload {
  title: string;
  sections?: ExportSection[];
  table?: { headers: string[]; rows: string[][] };
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function exportAs(format: ExportFormat, payload: ExportPayload): Promise<Buffer> {
  switch (format) {
    case "csv":
      return exportCsv(payload);
    case "xlsx":
      return exportXlsx(payload);
    case "docx":
      return exportDocx(payload);
    case "pdf":
      return exportPdf(payload);
    case "pptx":
      return exportPptx(payload);
  }
}

function exportCsv(payload: ExportPayload): Buffer {
  const table = payload.table ?? { headers: ["Sección", "Contenido"], rows: flatten(payload) };
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [table.headers.map(escape).join(","), ...table.rows.map((r) => r.map(escape).join(","))];
  return Buffer.from("﻿" + lines.join("\n"), "utf-8");
}

function exportXlsx(payload: ExportPayload): Buffer {
  const table = payload.table ?? { headers: ["Sección", "Contenido"], rows: flatten(payload) };
  const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, payload.title.slice(0, 31) || "Datos");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function exportDocx(payload: ExportPayload): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: payload.title, heading: HeadingLevel.TITLE }),
  ];
  for (const section of payload.sections ?? []) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    for (const p of section.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(p)] }));
    }
  }
  if (payload.table) {
    children.push(new Paragraph({ text: "Datos", heading: HeadingLevel.HEADING_1 }));
    for (const row of payload.table.rows) {
      children.push(new Paragraph({ children: [new TextRun(row.join(" — "))] }));
    }
  }
  const doc = new DocxDocument({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

async function exportPdf(payload: ExportPayload): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const write = (text: string, size: number, useBold = false) => {
    const f = useBold ? bold : font;
    for (const line of wrapText(text, f, size, maxWidth)) {
      if (y < margin + size) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size, font: f });
      y -= size * 1.4;
    }
    y -= size * 0.5;
  };

  write(payload.title, 18, true);
  for (const section of payload.sections ?? []) {
    write(section.title, 14, true);
    for (const p of section.paragraphs) write(p, 10);
  }
  if (payload.table) {
    write("Datos", 14, true);
    write(payload.table.headers.join(" | "), 10, true);
    for (const row of payload.table.rows) write(row.join(" | "), 9);
  }
  return Buffer.from(await pdf.save());
}

async function exportPptx(payload: ExportPayload): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const cover = pptx.addSlide();
  cover.addText(payload.title, { x: 0.5, y: 2.2, w: 9, h: 1.5, fontSize: 30, bold: true });

  for (const section of payload.sections ?? []) {
    const slide = pptx.addSlide();
    slide.addText(section.title, { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 22, bold: true });
    slide.addText(section.paragraphs.join("\n\n").slice(0, 2500), {
      x: 0.5, y: 1.3, w: 9, h: 4.5, fontSize: 12, valign: "top",
    });
  }
  if (payload.table) {
    const slide = pptx.addSlide();
    slide.addText("Datos", { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 22, bold: true });
    const toCells = (row: string[]) => row.map((text) => ({ text }));
    slide.addTable(
      [toCells(payload.table.headers), ...payload.table.rows.slice(0, 15).map(toCells)],
      { x: 0.5, y: 1.3, w: 9, fontSize: 9 }
    );
  }
  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}

function flatten(payload: ExportPayload): string[][] {
  return (payload.sections ?? []).flatMap((s) => s.paragraphs.map((p) => [s.title, p]));
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize(t: string, s: number): number },
  size: number,
  maxWidth: number
): string[] {
  const clean = text.replace(/[\r\n]+/g, " ");
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
