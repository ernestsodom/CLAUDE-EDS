import 'server-only';

/**
 * Exportación de reportes a CSV y XLSX (FASE 15, §65).
 *
 * `reports.export` existe como permiso desde la FASE 1 y la tabla de
 * reportes prometía CSV/XLSX/PDF, pero no había ningún generador detrás:
 * el botón "Exportar" de `TableToolbar` no lo usaba ninguna pantalla. Este
 * módulo es el generador; `app/api/export/route.ts` es quien lo sirve
 * detrás de la misma autorización (RLS + permiso) que la pantalla.
 *
 * Ningún formato usa dependencias externas: CSV es texto plano con las
 * reglas de escape estándar, y el XLSX es el ZIP + XML mínimo que Excel
 * necesita para abrir un libro de una hoja — la misma técnica que ya usa
 * el lector de extractos bancarios, en sentido inverso.
 */

export type CellValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, CellValue>;

export interface ExportColumn {
  key: string;
  header: string;
}

// =====================================================================
// CSV
// =====================================================================

function escapeCsvCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? 'si' : 'no') : String(value);
  // Se cita siempre que haga falta: separador, comillas o salto de linea.
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV con `;` como separador: es lo que Excel en español abre bien sin asistente de importación. */
export function buildCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(';');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(';'));
  // BOM UTF-8: sin el, Excel interpreta acentos y "€" como Latin-1.
  return '\ufeff' + [header, ...lines].join('\r\n');
}

// =====================================================================
// XLSX — ZIP + XML minimo, sin dependencias
// =====================================================================

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function sheetXml(columns: ExportColumn[], rows: ExportRow[]): string {
  const cell = (value: CellValue, colIndex: number, rowIndex: number): string => {
    const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
    if (value === null || value === undefined) return `<c r="${ref}"/>`;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    const text = typeof value === 'boolean' ? (value ? 'Si' : 'No') : String(value);
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
  };

  const headerRow = `<row r="1">${columns.map((c, i) => cell(c.header, i, 0)).join('')}</row>`;
  const dataRows = rows
    .map((row, r) => `<row r="${r + 2}">${columns.map((c, i) => cell(row[c.key], i, r + 1)).join('')}</row>`)
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${headerRow}${dataRows}</sheetData>` +
    '</worksheet>'
  );
}

/** CRC-32, necesario para las entradas ZIP sin librerias externas. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Empaqueta ficheros en un ZIP sin comprimir (STORED): valido, simple, y de sobra para un reporte. */
function buildZip(files: { name: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const dataBuf = Buffer.from(file.content, 'utf8');
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(0, 8);           // method: stored
    local.writeUInt16LE(0, 10);          // mod time
    local.writeUInt16LE(0, 12);          // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, dataBuf);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + dataBuf.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '</Relationships>';

function workbookXml(sheetName: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${xmlEscape(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

/** Genera un XLSX de una hoja. Sin estilos, sin formulas: es un reporte, no una plantilla. */
export function buildXlsx(
  columns: ExportColumn[],
  rows: ExportRow[],
  sheetName = 'Reporte',
): Buffer {
  return buildZip([
    { name: '[Content_Types].xml', content: CONTENT_TYPES_XML },
    { name: '_rels/.rels', content: RELS_XML },
    { name: 'xl/workbook.xml', content: workbookXml(sheetName) },
    { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS_XML },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(columns, rows) },
  ]);
}

/** Nombre de fichero seguro para la cabecera Content-Disposition. */
export function exportFileName(base: string, extension: string): string {
  const slug = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${slug || 'reporte'}-${date}.${extension}`;
}
