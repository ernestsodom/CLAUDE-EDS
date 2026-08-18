import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ============================================================================
// Exportaciones: Word y PDF a partir de datos tabulares o de secciones de
// texto (p.ej. resumen ejecutivo, comparaciones).
//
// Excel, PowerPoint y CSV se retiraron a pedido del usuario — el informe
// ejecutivo y el de cumplimiento se leen y se comparten como documento
// (Word/PDF), no como planilla o presentación. El Excel del comparador de
// checklist (docs/formato-excel.md) es una función distinta y no se toca
// aquí: ese sigue en checklist.service.ts.
// ============================================================================

export type ExportFormat = "docx" | "pdf";

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
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export async function exportAs(format: ExportFormat, payload: ExportPayload): Promise<Buffer> {
  switch (format) {
    case "docx":
      return exportDocx(payload);
    case "pdf":
      return exportPdf(payload);
  }
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
