import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

/**
 * Lectura de extractos bancarios (FASE 9b).
 *
 * Modulo puro: entra un fichero, salen filas normalizadas. No toca la
 * base ni la sesion, asi que puede probarse sin levantar nada.
 *
 * CSV y XLSX se leen aqui sin dependencias externas. El XLSX es un ZIP
 * con XML dentro; leerlo son doscientas lineas y evita arrastrar una
 * libreria de varios megabytes al servidor para algo que ocurre cuando
 * alguien sube un extracto.
 */

// =====================================================================
// CSV
// =====================================================================

/**
 * Delimitador probable.
 *
 * Los bancos espanoles y argentinos exportan con ';' porque la coma es su
 * separador decimal; los anglosajones, con ','. Se cuenta fuera de
 * comillas en las primeras lineas en lugar de preguntarselo al usuario.
 */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const candidates = [';', ',', '\t', '|'];
  let best = ',';
  let bestCount = -1;

  for (const candidate of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const char of sample) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count += 1;
    }
    if (count > bestCount) { bestCount = count; best = candidate; }
  }
  return best;
}

/** CSV a matriz de celdas. Respeta comillas, dobles comillas y saltos dentro del campo. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^\ufeff/, '');
  const sep = delimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') { inQuotes = true; continue; }
    if (char === sep) { row.push(field); field = ''; continue; }
    if (char === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }

  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// =====================================================================
// XLSX (ZIP + XML, sin dependencias)
// =====================================================================

interface ZipEntry { name: string; offset: number; method: number; compressedSize: number }

function readZipEntries(buffer: Buffer): ZipEntry[] {
  // Directorio central: se busca su firma desde el final del fichero.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66_000; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un XLSX valido.');

  const count = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const offset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);

    entries.push({ name, offset, method, compressedSize });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipFile(buffer: Buffer, entry: ZipEntry): string {
  // La cabecera local repite longitudes propias: hay que saltarlas para
  // llegar a los datos.
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw.toString('utf8');
  if (entry.method === 8) return inflateRawSync(raw).toString('utf8');
  throw new Error('Compresion XLSX no soportada.');
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/[0-9]/g, '');
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/** Primera hoja de un XLSX a matriz de celdas. */
export function parseXlsx(data: Uint8Array): string[][] {
  const buffer = Buffer.from(data);
  const entries = readZipEntries(buffer);

  const sharedEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedEntry) {
    const xml = readZipFile(buffer, sharedEntry);
    for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      const text = (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
        .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')))
        .join('');
      shared.push(text);
    }
  }

  const sheetEntry =
    entries.find((e) => e.name === 'xl/worksheets/sheet1.xml') ??
    entries.find((e) => e.name.startsWith('xl/worksheets/sheet'));
  if (!sheetEntry) throw new Error('El XLSX no contiene ninguna hoja.');

  const sheetXml = readZipFile(buffer, sheetEntry);
  const rows: string[][] = [];

  for (const rowXml of sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];

    for (const cellXml of rowXml.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const reference = cellXml.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = cellXml.match(/t="([^"]+)"/)?.[1];
      let value = '';

      if (type === 'inlineStr') {
        value = (cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
          .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, ''))).join('');
      } else {
        const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (raw !== undefined) {
          value = type === 's'
            ? (shared[Number(raw)] ?? '')
            : decodeXmlEntities(raw);
        }
      }

      const index = reference ? columnIndex(reference) : cells.length;
      while (cells.length < index) cells.push('');
      cells[index] = value;
    }

    if (cells.some((c) => c.trim() !== '')) rows.push(cells);
  }

  return rows;
}

// =====================================================================
// Normalizacion de valores
// =====================================================================

/**
 * Importe a numero.
 *
 * Un extracto puede traer "1.234,56", "1,234.56", "(120,00)" o "120,00-".
 * Todos significan algo distinto y ninguno es un `Number` de JavaScript.
 */
export function parseAmount(raw: string, decimal: 'COMMA' | 'DOT'): number | null {
  let text = String(raw ?? '').trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  if (/-\s*$/.test(text)) { negative = true; text = text.replace(/-\s*$/, ''); }

  text = text.replace(/[^\d,.\-+]/g, '');
  if (text.startsWith('-')) { negative = true; text = text.slice(1); }
  if (text.startsWith('+')) text = text.slice(1);

  text = decimal === 'COMMA'
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '');

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Epoch de las fechas de Excel: 1899-12-30 por el ano bisiesto ficticio de 1900. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Fecha a ISO (YYYY-MM-DD).
 *
 * Acepta ISO, los tres ordenes habituales con cualquier separador, y el
 * numero de serie que produce Excel cuando la celda es de tipo fecha.
 * `08/03/2026` es ambiguo entre paises: por eso el orden es un parametro
 * del formulario de importacion y no una adivinanza.
 */
export function parseDate(raw: string, order: 'DMY' | 'MDY' | 'YMD'): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20_000 && serial < 80_000) {
      return new Date(EXCEL_EPOCH + Math.floor(serial) * 86_400_000)
        .toISOString().slice(0, 10);
    }
  }

  const parts = text.split(/[\/\-.\s]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let day: number, month: number, year: number;
  if (order === 'YMD') [year, month, day] = parts.map(Number);
  else if (order === 'MDY') [month, day, year] = parts.map(Number);
  else [day, month, year] = parts.map(Number);

  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (!day || !month || !year || month > 12 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

// =====================================================================
// Filas normalizadas
// =====================================================================

export interface ParsedTransaction {
  transaction_date: string;
  value_date: string | null;
  amount: number;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  balance_after: number | null;
  import_hash: string;
}

export interface ParseIssue { row: number; reason: string }

export interface ParseResult {
  headers: string[];
  transactions: ParsedTransaction[];
  issues: ParseIssue[];
  rowCount: number;
}

export interface ColumnMapping {
  date: string;
  amount: string;
  credit?: string;
  debit?: string;
  description?: string;
  counterparty?: string;
  reference?: string;
  value_date?: string;
  balance_after?: string;
}

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Huella de un movimiento, unica por cuenta.
 *
 * Es lo que hace idempotente la importacion: volver a subir el mismo
 * extracto no duplica nada. Incluye el ordinal de repeticion para no
 * perder dos movimientos legitimamente identicos el mismo dia —dos cafes
 * de 3,50 son dos apuntes, no uno.
 */
export function transactionHash(input: {
  date: string; amount: number; description: string; reference: string; occurrence: number;
}): string {
  return createHash('sha256')
    .update([
      input.date,
      input.amount.toFixed(2),
      normalizeHeader(input.description).slice(0, 120),
      normalizeHeader(input.reference).slice(0, 60),
      String(input.occurrence),
    ].join('|'))
    .digest('hex');
}

/**
 * Matriz de celdas -> movimientos listos para insertar.
 *
 * Las filas que no se entienden no rompen la importacion: se acumulan en
 * `issues` y se muestran al usuario. Un extracto con una linea de totales
 * al final debe poder importarse igual.
 */
export function normalizeStatement(
  rows: string[][],
  mapping: ColumnMapping,
  options: { decimal: 'COMMA' | 'DOT'; dateOrder: 'DMY' | 'MDY' | 'YMD'; invertSign: boolean },
): ParseResult {
  const issues: ParseIssue[] = [];
  if (rows.length === 0) {
    return { headers: [], transactions: [], issues: [{ row: 0, reason: 'El archivo esta vacio.' }], rowCount: 0 };
  }

  const headers = rows[0].map((h) => h.trim());
  const index = new Map<string, number>();
  headers.forEach((header, i) => index.set(normalizeHeader(header), i));

  const columnOf = (name?: string): number => {
    if (!name) return -1;
    const found = index.get(normalizeHeader(name));
    return found === undefined ? -1 : found;
  };

  const cols = {
    date: columnOf(mapping.date),
    amount: columnOf(mapping.amount),
    credit: columnOf(mapping.credit),
    debit: columnOf(mapping.debit),
    description: columnOf(mapping.description),
    counterparty: columnOf(mapping.counterparty),
    reference: columnOf(mapping.reference),
    valueDate: columnOf(mapping.value_date),
    balance: columnOf(mapping.balance_after),
  };

  if (cols.date < 0) {
    return { headers, transactions: [], rowCount: rows.length - 1,
      issues: [{ row: 0, reason: `No encuentro la columna de fecha "${mapping.date}".` }] };
  }
  if (cols.amount < 0 && cols.credit < 0 && cols.debit < 0) {
    return { headers, transactions: [], rowCount: rows.length - 1,
      issues: [{ row: 0, reason: `No encuentro la columna de importe "${mapping.amount}".` }] };
  }

  const transactions: ParsedTransaction[] = [];
  const seen = new Map<string, number>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const cell = (position: number) => (position >= 0 ? (row[position] ?? '').trim() : '');

    const date = parseDate(cell(cols.date), options.dateOrder);
    if (!date) {
      issues.push({ row: i + 1, reason: `Fecha ilegible: "${cell(cols.date)}"` });
      continue;
    }

    // Debe y haber en columnas separadas, o una unica columna con signo.
    let amount: number | null = null;
    if (cols.credit >= 0 || cols.debit >= 0) {
      const credit = parseAmount(cell(cols.credit), options.decimal) ?? 0;
      const debit = parseAmount(cell(cols.debit), options.decimal) ?? 0;
      amount = credit - Math.abs(debit);
    } else {
      amount = parseAmount(cell(cols.amount), options.decimal);
    }

    if (amount === null || Number.isNaN(amount)) {
      issues.push({ row: i + 1, reason: `Importe ilegible: "${cell(cols.amount)}"` });
      continue;
    }
    if (options.invertSign) amount = -amount;
    if (amount === 0) {
      issues.push({ row: i + 1, reason: 'Importe cero: la base no admite movimientos sin importe.' });
      continue;
    }

    const description = cell(cols.description) || null;
    const reference = cell(cols.reference) || null;

    const key = `${date}|${amount.toFixed(2)}|${description ?? ''}|${reference ?? ''}`;
    const occurrence = (seen.get(key) ?? 0);
    seen.set(key, occurrence + 1);

    transactions.push({
      transaction_date: date,
      value_date: cols.valueDate >= 0 ? parseDate(cell(cols.valueDate), options.dateOrder) : null,
      amount: Math.round(amount * 100) / 100,
      description,
      counterparty: cell(cols.counterparty) || null,
      reference,
      balance_after: cols.balance >= 0 ? parseAmount(cell(cols.balance), options.decimal) : null,
      import_hash: transactionHash({
        date, amount, description: description ?? '', reference: reference ?? '', occurrence,
      }),
    });
  }

  return { headers, transactions, issues, rowCount: rows.length - 1 };
}

/** Lee el fichero segun su extension y devuelve la matriz de celdas. */
export function readStatementFile(fileName: string, data: Uint8Array): string[][] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return parseXlsx(data);
  if (lower.endsWith('.xls')) {
    throw new Error('El formato .xls antiguo no esta soportado. Guarda el extracto como .xlsx o .csv.');
  }
  return parseCsv(Buffer.from(data).toString('utf8'));
}

/**
 * Cabeceras probables para cada campo.
 *
 * Sirve para preseleccionar el mapeo en el formulario. Es una ayuda, no
 * una regla: el usuario siempre puede corregirla antes de importar.
 */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const find = (...needles: string[]) =>
    headers.find((h) => {
      const normalized = normalizeHeader(h);
      return needles.some((n) => normalized.includes(n));
    });

  return {
    date: find('fecha operacion', 'fecha oper', 'fecha contable', 'fecha', 'date'),
    value_date: find('fecha valor', 'valor', 'value date'),
    amount: find('importe', 'monto', 'amount'),
    credit: find('haber', 'abono', 'credit', 'ingreso'),
    debit: find('debe', 'cargo', 'debit'),
    description: find('concepto', 'descripcion', 'detalle', 'description', 'memo'),
    counterparty: find('beneficiario', 'ordenante', 'contrapartida', 'payee'),
    reference: find('referencia', 'reference', 'documento'),
    balance_after: find('saldo', 'balance'),
  };
}
