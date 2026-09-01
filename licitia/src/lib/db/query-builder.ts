import type { Executor } from "./executor";
import { loadForeignKeys, resolveRelation, type ForeignKey } from "./relations";
import { parseSelect, type EmbedNode } from "./select-parser";

/**
 * Constructor de consultas compatible con el de supabase-js.
 *
 * Existe para que las 45 pantallas y servicios que ya consultan con
 * `.from(...).select(...).eq(...)` sigan funcionando palabra por palabra
 * contra Neon, que es PostgreSQL puro y no tiene PostgREST. Reescribir esos
 * 45 archivos a SQL a mano habría sido el mismo trabajo repetido 45 veces,
 * con 45 ocasiones de equivocarse; aquí la traducción ocurre una vez y se
 * prueba una vez.
 *
 * Cubre deliberadamente solo lo que la aplicación usa hoy (medido sobre el
 * código): select con embeds de un nivel, insert, update, delete, upsert,
 * los filtros eq/neq/gt/gte/lt/lte/like/ilike/is/in, order, limit, range,
 * single, maybeSingle y count exacto. Cualquier otra cosa lanza un error
 * claro en vez de devolver datos a medias.
 */

export interface PostgrestError {
  message: string;
  code?: string;
  details?: string;
}

export interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
  count: number | null;
}

type Filter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike"; column: string; value: unknown }
  | { op: "is"; column: string; value: null | boolean }
  | { op: "in"; column: string; value: unknown[] };

interface SelectOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Los identificadores nunca se interpolan sin comprobar que lo son. */
function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Identificador inválido: "${name}"`);
  return `"${name}"`;
}

export class QueryBuilder<T = Record<string, unknown>> implements PromiseLike<Result<T>> {
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectExpr = "*";
  private selectOptions: SelectOptions = {};
  private returning = false;
  private payload: Record<string, unknown>[] = [];
  private onConflict?: string;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private wantSingle = false;
  private wantMaybeSingle = false;

  constructor(
    private readonly executor: Executor,
    private readonly userId: string | null,
    private readonly table: string
  ) {}

  // ---------------------------------------------------------------- lectura
  select(expr = "*", options: SelectOptions = {}): this {
    this.selectExpr = expr;
    this.selectOptions = options;
    if (this.mode !== "select") this.returning = true;
    return this;
  }

  // -------------------------------------------------------------- escritura
  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string } = {}
  ): this {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = options.onConflict;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.mode = "update";
    this.payload = [values];
    return this;
  }

  delete(options: SelectOptions = {}): this {
    this.mode = "delete";
    this.selectOptions = options;
    return this;
  }

  // --------------------------------------------------------------- filtros
  eq(column: string, value: unknown): this { return this.push({ op: "eq", column, value }); }
  neq(column: string, value: unknown): this { return this.push({ op: "neq", column, value }); }
  gt(column: string, value: unknown): this { return this.push({ op: "gt", column, value }); }
  gte(column: string, value: unknown): this { return this.push({ op: "gte", column, value }); }
  lt(column: string, value: unknown): this { return this.push({ op: "lt", column, value }); }
  lte(column: string, value: unknown): this { return this.push({ op: "lte", column, value }); }
  like(column: string, value: string): this { return this.push({ op: "like", column, value }); }
  ilike(column: string, value: string): this { return this.push({ op: "ilike", column, value }); }
  is(column: string, value: null | boolean): this { return this.push({ op: "is", column, value }); }
  in(column: string, value: unknown[]): this { return this.push({ op: "in", column, value }); }

  private push(f: Filter): this {
    this.filters.push(f);
    return this;
  }

  // -------------------------------------------------------------- ordenado
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    });
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  /** Exactamente una fila; si no la hay, error con el código de PostgREST. */
  single(): this {
    this.wantSingle = true;
    return this;
  }

  /** Cero o una fila; cero devuelve `data: null` sin error. */
  maybeSingle(): this {
    this.wantMaybeSingle = true;
    return this;
  }

  // ------------------------------------------------------------- ejecución
  async then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : (result as unknown as R1);
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }

  private async execute(): Promise<Result<T>> {
    try {
      const fks = await loadForeignKeys(this.executor);
      const { sql, params } = this.compile(fks);
      const { rows, rowCount } = await this.executor.run<Record<string, unknown>>(
        sql,
        params,
        this.userId
      );

      let count: number | null = null;
      if (this.selectOptions.count === "exact") {
        count = this.mode === "delete" ? rowCount : await this.exactCount(fks);
      }

      if (this.selectOptions.head) return { data: [] as unknown as T, error: null, count };

      if (this.wantSingle || this.wantMaybeSingle) {
        if (rows.length === 0) {
          if (this.wantMaybeSingle) return { data: null, error: null, count };
          return {
            data: null,
            // Mismo código que devuelve PostgREST: hay código que lo compara.
            error: { message: "No se encontró ninguna fila", code: "PGRST116" },
            count,
          };
        }
        if (rows.length > 1 && this.wantSingle) {
          return {
            data: null,
            error: { message: "Se esperaba una sola fila", code: "PGRST116" },
            count,
          };
        }
        return { data: rows[0] as unknown as T, error: null, count };
      }

      return { data: rows as unknown as T, error: null, count };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { data: null, error: { message }, count: null };
    }
  }

  private async exactCount(fks: ForeignKey[]): Promise<number> {
    const params: unknown[] = [];
    const where = this.compileWhere(params, "base");
    const sql = `select count(*)::int as n from ${ident(this.table)} base ${where}`;
    const { rows } = await this.executor.run<{ n: number }>(sql, params, this.userId);
    return rows[0]?.n ?? 0;
  }

  // -------------------------------------------------------------- SQL
  private compile(fks: ForeignKey[]): { sql: string; params: unknown[] } {
    const params: unknown[] = [];

    if (this.mode === "select") {
      const projection = this.compileProjection(fks);
      const where = this.compileWhere(params, "base");
      const order = this.compileOrder();
      const paging = this.compilePaging(params);
      return {
        sql: `select ${projection} from ${ident(this.table)} base ${where} ${order} ${paging}`.trim(),
        params,
      };
    }

    if (this.mode === "insert" || this.mode === "upsert") {
      const columns = Object.keys(this.payload[0] ?? {});
      if (columns.length === 0) throw new Error("insert sin columnas");

      const tuples = this.payload.map((row) => {
        const values = columns.map((c) => {
          params.push(row[c] ?? null);
          return `$${params.length}`;
        });
        return `(${values.join(", ")})`;
      });

      let conflict = "";
      if (this.mode === "upsert") {
        const target = (this.onConflict ?? "id").split(",").map((c) => ident(c.trim())).join(", ");
        const updates = columns
          .filter((c) => !(this.onConflict ?? "id").split(",").map((x) => x.trim()).includes(c))
          .map((c) => `${ident(c)} = excluded.${ident(c)}`);
        conflict = updates.length
          ? ` on conflict (${target}) do update set ${updates.join(", ")}`
          : ` on conflict (${target}) do nothing`;
      }

      return {
        sql:
          `insert into ${ident(this.table)} (${columns.map(ident).join(", ")}) ` +
          `values ${tuples.join(", ")}${conflict}` +
          (this.returning ? " returning *" : ""),
        params,
      };
    }

    if (this.mode === "update") {
      const row = this.payload[0] ?? {};
      const sets = Object.keys(row).map((c) => {
        params.push(row[c] ?? null);
        return `${ident(c)} = $${params.length}`;
      });
      if (sets.length === 0) throw new Error("update sin columnas");
      const where = this.compileWhere(params, null);
      if (!where) throw new Error("update sin filtros: se niega a tocar la tabla entera");
      return {
        sql:
          `update ${ident(this.table)} set ${sets.join(", ")} ${where}` +
          (this.returning ? " returning *" : ""),
        params,
      };
    }

    // delete
    const where = this.compileWhere(params, null);
    if (!where) throw new Error("delete sin filtros: se niega a vaciar la tabla");
    return {
      sql: `delete from ${ident(this.table)} ${where}` + (this.returning ? " returning *" : ""),
      params,
    };
  }

  private compileProjection(fks: ForeignKey[]): string {
    const { columns, embeds } = parseSelect(this.selectExpr);
    const pieces: string[] = [];

    for (const column of columns) {
      pieces.push(column === "*" ? "base.*" : `base.${ident(column)}`);
    }
    if (pieces.length === 0) pieces.push("base.*");

    for (const embed of embeds) {
      pieces.push(this.compileEmbed(fks, embed));
    }
    return pieces.join(", ");
  }

  private compileEmbed(fks: ForeignKey[], embed: EmbedNode): string {
    const relation = resolveRelation(fks, this.table, embed.table, embed.constraint);
    const target = ident(embed.table);
    const join =
      relation.kind === "many-to-one"
        ? `${target}.${ident(relation.foreignColumn)} = base.${ident(relation.localColumn)}`
        : `${target}.${ident(relation.foreignColumn)} = base.${ident(relation.localColumn)}`;

    if (embed.isCount) {
      // PostgREST devuelve [{ count: n }] para `tabla(count)`.
      return (
        `(select jsonb_build_array(jsonb_build_object('count', count(*))) ` +
        `from ${target} where ${join}) as ${ident(embed.alias)}`
      );
    }

    const inner =
      embed.columns.length === 0 || embed.columns.includes("*")
        ? `${target}.*`
        : embed.columns.map((c) => `${target}.${ident(c)}`).join(", ");

    if (relation.kind === "many-to-one") {
      return (
        `(select to_jsonb(e) from (select ${inner} from ${target} where ${join} limit 1) e) ` +
        `as ${ident(embed.alias)}`
      );
    }

    return (
      `coalesce((select jsonb_agg(to_jsonb(e)) from (select ${inner} from ${target} ` +
      `where ${join}) e), '[]'::jsonb) as ${ident(embed.alias)}`
    );
  }

  private compileWhere(params: unknown[], prefix: string | null): string {
    if (this.filters.length === 0) return "";
    const q = (column: string) => (prefix ? `${prefix}.${ident(column)}` : ident(column));

    const clauses = this.filters.map((f) => {
      if (f.op === "is") {
        if (f.value === null) return `${q(f.column)} is null`;
        return `${q(f.column)} is ${f.value ? "true" : "false"}`;
      }
      if (f.op === "in") {
        params.push(f.value);
        return `${q(f.column)} = any($${params.length})`;
      }
      const operator = {
        eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=",
        like: "like", ilike: "ilike",
      }[f.op];
      params.push(f.value);
      return `${q(f.column)} ${operator} $${params.length}`;
    });

    return `where ${clauses.join(" and ")}`;
  }

  private compileOrder(): string {
    if (this.orders.length === 0) return "";
    const parts = this.orders.map((o) => {
      const nulls = o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last";
      return `base.${ident(o.column)} ${o.ascending ? "asc" : "desc"}${nulls}`;
    });
    return `order by ${parts.join(", ")}`;
  }

  private compilePaging(params: unknown[]): string {
    let sql = "";
    if (this.limitValue !== undefined) {
      params.push(this.limitValue);
      sql += ` limit $${params.length}`;
    }
    if (this.offsetValue !== undefined) {
      params.push(this.offsetValue);
      sql += ` offset $${params.length}`;
    }
    return sql;
  }
}
