/**
 * Lector del `select` de PostgREST.
 *
 * Traduce la cadena que ya escriben las pantallas —`"*, clients(name)"`,
 * `"source:documents!comparisons_source_document_id_fkey(title)"`— a algo
 * que el compilador de SQL pueda usar. Se soporta exactamente lo que la
 * aplicación usa hoy: columnas sueltas y embeds de un nivel, con alias y
 * clave foránea explícita opcionales. Un embed anidado (un embed dentro de
 * otro) lanza error en vez de generar SQL a medias.
 */

export interface EmbedNode {
  /** Nombre con el que sale en el resultado (alias o tabla). */
  alias: string;
  table: string;
  /** Nombre de la FK cuando se escribió `tabla!fk(...)`. */
  constraint?: string;
  /** Columnas pedidas dentro del embed; `["*"]` para todas. */
  columns: string[];
  /** `tabla(count)`: en vez de filas, el número de filas relacionadas. */
  isCount: boolean;
}

export interface ParsedSelect {
  columns: string[];
  embeds: EmbedNode[];
}

export function parseSelect(select: string): ParsedSelect {
  const columns: string[] = [];
  const embeds: EmbedNode[] = [];

  for (const part of splitTopLevel(select)) {
    const token = part.trim();
    if (!token) continue;

    const open = token.indexOf("(");
    if (open === -1) {
      columns.push(token);
      continue;
    }

    if (!token.endsWith(")")) {
      throw new Error(`Embed mal formado en el select: "${token}"`);
    }

    const head = token.slice(0, open).trim();
    const body = token.slice(open + 1, -1).trim();

    if (body.includes("(")) {
      throw new Error(
        `Embed anidado no soportado: "${token}". Haz una segunda consulta en su lugar.`
      );
    }

    // head admite  alias:tabla!clave_foranea
    let alias: string | undefined;
    let rest = head;
    const colon = rest.indexOf(":");
    if (colon !== -1) {
      alias = rest.slice(0, colon).trim();
      rest = rest.slice(colon + 1).trim();
    }

    let constraint: string | undefined;
    const bang = rest.indexOf("!");
    if (bang !== -1) {
      constraint = rest.slice(bang + 1).trim();
      rest = rest.slice(0, bang).trim();
    }

    const table = rest;
    const inner = splitTopLevel(body).map((c) => c.trim()).filter(Boolean);
    const isCount = inner.length === 1 && inner[0] === "count";

    embeds.push({
      alias: alias ?? table,
      table,
      constraint,
      columns: isCount ? [] : inner,
      isCount,
    });
  }

  return { columns, embeds };
}

/** Separa por comas ignorando las que van dentro de paréntesis. */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}
