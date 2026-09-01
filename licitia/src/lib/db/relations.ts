import type { Executor } from "./executor";

/**
 * Resolución de relaciones entre tablas.
 *
 * PostgREST adivina el join de un embed —`clients(name)` dentro de un
 * select sobre `documents`— leyendo las claves foráneas del catálogo de
 * PostgreSQL. Aquí se hace lo mismo: se leen una vez al arrancar y se
 * cachean, de modo que el embed sigue escribiéndose igual que antes en las
 * 45 pantallas que ya lo usan.
 */

export interface ForeignKey {
  constraint: string;
  /** Tabla que tiene la columna FK. */
  fromTable: string;
  fromColumn: string;
  /** Tabla referenciada. */
  toTable: string;
  toColumn: string;
}

export type Relation =
  | { kind: "many-to-one"; localColumn: string; foreignColumn: string }
  | { kind: "one-to-many"; localColumn: string; foreignColumn: string };

const FK_SQL = `
  select
    c.conname                                   as constraint,
    src.relname                                 as from_table,
    srcatt.attname                              as from_column,
    tgt.relname                                 as to_table,
    tgtatt.attname                              as to_column
  from pg_constraint c
  join pg_class     src    on src.oid = c.conrelid
  join pg_class     tgt    on tgt.oid = c.confrelid
  join pg_namespace ns     on ns.oid  = src.relnamespace
  join pg_attribute srcatt on srcatt.attrelid = c.conrelid  and srcatt.attnum = c.conkey[1]
  join pg_attribute tgtatt on tgtatt.attrelid = c.confrelid and tgtatt.attnum = c.confkey[1]
  where c.contype = 'f'
    and ns.nspname = 'public'
    and array_length(c.conkey, 1) = 1
`;

let cache: ForeignKey[] | null = null;

export async function loadForeignKeys(executor: Executor): Promise<ForeignKey[]> {
  if (cache) return cache;
  const { rows } = await executor.run<{
    constraint: string;
    from_table: string;
    from_column: string;
    to_table: string;
    to_column: string;
  }>(FK_SQL, [], null);

  cache = rows.map((r) => ({
    constraint: r.constraint,
    fromTable: r.from_table,
    fromColumn: r.from_column,
    toTable: r.to_table,
    toColumn: r.to_column,
  }));
  return cache;
}

/** Solo para las pruebas: olvida las claves foráneas cacheadas. */
export function resetRelationCache(): void {
  cache = null;
}

/**
 * Encuentra cómo se une `baseTable` con `targetTable`.
 *
 * `constraintName` desambigua cuando hay más de una FK entre las mismas dos
 * tablas — el caso de `comparisons`, que apunta dos veces a `documents`
 * (documento origen y documento destino). Sin ese nombre no hay forma de
 * saber cuál de las dos quiere el usuario, así que se falla en vez de
 * elegir una al azar.
 */
export function resolveRelation(
  fks: ForeignKey[],
  baseTable: string,
  targetTable: string,
  constraintName?: string
): Relation {
  if (constraintName) {
    const fk = fks.find((f) => f.constraint === constraintName);
    if (!fk) {
      throw new Error(
        `No existe la clave foránea "${constraintName}" (embed ${baseTable} -> ${targetTable})`
      );
    }
    return fk.fromTable === baseTable
      ? { kind: "many-to-one", localColumn: fk.fromColumn, foreignColumn: fk.toColumn }
      : { kind: "one-to-many", localColumn: fk.toColumn, foreignColumn: fk.fromColumn };
  }

  const manyToOne = fks.filter((f) => f.fromTable === baseTable && f.toTable === targetTable);
  const oneToMany = fks.filter((f) => f.fromTable === targetTable && f.toTable === baseTable);

  if (manyToOne.length + oneToMany.length === 0) {
    throw new Error(`No hay relación entre "${baseTable}" y "${targetTable}"`);
  }
  if (manyToOne.length + oneToMany.length > 1) {
    const names = [...manyToOne, ...oneToMany].map((f) => f.constraint).join(", ");
    throw new Error(
      `Relación ambigua entre "${baseTable}" y "${targetTable}": indica la clave foránea ` +
        `con la sintaxis alias:${targetTable}!nombre_fk(...). Candidatas: ${names}`
    );
  }

  if (manyToOne.length === 1) {
    const fk = manyToOne[0];
    return { kind: "many-to-one", localColumn: fk.fromColumn, foreignColumn: fk.toColumn };
  }
  const fk = oneToMany[0];
  return { kind: "one-to-many", localColumn: fk.toColumn, foreignColumn: fk.fromColumn };
}
