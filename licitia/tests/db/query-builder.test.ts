import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedExecutor, type Executor } from "@/lib/db/executor";
import { resetRelationCache } from "@/lib/db/relations";
import { parseSelect } from "@/lib/db/select-parser";
import { QueryBuilder } from "@/lib/db/query-builder";

/**
 * Pruebas del cliente de datos contra un PostgreSQL de verdad.
 *
 * No se simula la base: se levanta el esquema real de LicitIA (el mismo
 * `neon/01_schema.sql` que se aplicará en Neon) y se comprueba que las
 * consultas que hoy escriben las pantallas devuelven lo mismo que devolvía
 * PostgREST. Un test con la base simulada aquí no probaría nada: lo que hay
 * que verificar es justamente el SQL generado.
 *
 * Se salta solo si no hay base de pruebas configurada:
 *   TEST_DATABASE_URL=postgres://... npx vitest run tests/db
 */

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

let executor: Executor;

// Identificadores fijos para no depender del orden de ejecución.
const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-0000000000aa";
const CLIENT_A = "00000000-0000-4000-8000-000000000010";
const DOC_1 = "00000000-0000-4000-8000-000000000100";
const DOC_2 = "00000000-0000-4000-8000-000000000101";

suite("cliente de datos sobre Neon", () => {
  beforeAll(async () => {
    resetRelationCache();
    executor = createIsolatedExecutor(URL!);

    // Datos mínimos. Se insertan sin identidad (como el pipeline de ingesta)
    // para no depender todavía de las políticas.
    await executor.transaction(null, async (c) => {
      await c.query("delete from documents where organization_id = $1", [ORG]);
      await c.query("delete from clients where organization_id = $1", [ORG]);
      await c.query("delete from profiles where organization_id = $1", [ORG]);
      await c.query("delete from organizations where id = $1", [ORG]);
      await c.query("delete from auth.users where id = $1", [USER]);

      await c.query(
        "insert into organizations (id, name, slug) values ($1, 'Org de prueba', 'org-de-prueba')",
        [ORG]
      );
      await c.query("insert into auth.users (id, email) values ($1, 'prueba@licitia.test')", [USER]);
      await c.query(
        "insert into profiles (id, organization_id, email, full_name) values ($1, $2, 'prueba@licitia.test', 'Prueba')",
        [USER, ORG]
      );
      await c.query(
        "insert into clients (id, organization_id, name) values ($1, $2, 'Municipalidad de Prueba')",
        [CLIENT_A, ORG]
      );
      await c.query(
        "insert into documents (id, organization_id, client_id, title) values ($1, $2, $3, 'Licitación A')",
        [DOC_1, ORG, CLIENT_A]
      );
      await c.query(
        "insert into documents (id, organization_id, client_id, title) values ($1, $2, $3, 'Licitación B')",
        [DOC_2, ORG, CLIENT_A]
      );
    });
  });

  afterAll(async () => {
    if (executor) await executor.end();
  });

  const q = (table: string, userId: string | null = null) =>
    new QueryBuilder(executor, userId, table);

  it("select con filtro devuelve la fila pedida", async () => {
    const { data, error } = await q("documents").select("id, title").eq("id", DOC_1);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: DOC_1, title: "Licitación A" }]);
  });

  it("single() sin resultados devuelve el código PGRST116 que la app ya comprueba", async () => {
    const { data, error } = await q("documents")
      .select("*")
      .eq("id", "00000000-0000-4000-8000-0000000000ff")
      .single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("maybeSingle() sin resultados devuelve null y ningún error", async () => {
    const { data, error } = await q("documents")
      .select("*")
      .eq("id", "00000000-0000-4000-8000-0000000000ff")
      .maybeSingle();
    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it("embed hacia el padre devuelve un objeto, no un array", async () => {
    const { data, error } = await q("documents")
      .select("id, title, clients(name)")
      .eq("id", DOC_1)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      title: "Licitación A",
      clients: { name: "Municipalidad de Prueba" },
    });
  });

  it("embed hacia los hijos devuelve un array, vacío si no hay", async () => {
    const { data, error } = await q("clients")
      .select("id, name, documents(*)")
      .eq("id", CLIENT_A)
      .single();
    expect(error).toBeNull();
    const row = data as unknown as { documents: unknown[] };
    expect(Array.isArray(row.documents)).toBe(true);
    expect(row.documents).toHaveLength(2);
  });

  it("tabla(count) devuelve [{count}], como PostgREST", async () => {
    const { data, error } = await q("clients")
      .select("id, documents(count)")
      .eq("id", CLIENT_A)
      .single();
    expect(error).toBeNull();
    expect((data as unknown as { documents: { count: number }[] }).documents).toEqual([
      { count: 2 },
    ]);
  });

  it("order y limit se aplican en la base, no en memoria", async () => {
    const { data } = await q("documents")
      .select("title")
      .eq("organization_id", ORG)
      .order("title", { ascending: false })
      .limit(1);
    expect(data).toEqual([{ title: "Licitación B" }]);
  });

  it("in() filtra por lista", async () => {
    const { data } = await q("documents").select("id").in("id", [DOC_1, DOC_2]);
    expect(data).toHaveLength(2);
  });

  it("is() distingue null de false", async () => {
    const { data } = await q("documents")
      .select("id")
      .eq("organization_id", ORG)
      .is("processing_error", null);
    expect(data).toHaveLength(2);
  });

  it("count exact devuelve el total, no el de la página", async () => {
    const { data, count } = await q("documents")
      .select("id", { count: "exact" })
      .eq("organization_id", ORG)
      .limit(1);
    expect(data).toHaveLength(1);
    expect(count).toBe(2);
  });

  it("insert ... select() devuelve la fila creada", async () => {
    const id = "00000000-0000-4000-8000-000000000200";
    await executor.run("delete from clients where id = $1", [id], null);
    const { data, error } = await q("clients")
      .insert({ id, organization_id: ORG, name: "Cliente nuevo" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id, name: "Cliente nuevo" });
    await executor.run("delete from clients where id = $1", [id], null);
  });

  it("update exige filtros: nunca toca la tabla entera", async () => {
    const { error } = await q("documents").update({ title: "no debería pasar" });
    expect(error?.message).toContain("sin filtros");
  });

  it("delete exige filtros: nunca vacía la tabla", async () => {
    const { error } = await q("documents").delete();
    expect(error?.message).toContain("sin filtros");
  });

  it("un identificador que no lo es no llega a la base", async () => {
    const { error } = await q("documents").select("id").eq("id; drop table documents", 1);
    expect(error?.message).toContain("Identificador inválido");
    const { data } = await q("documents").select("id").eq("organization_id", ORG);
    expect(data).toHaveLength(2);
  });

  it("la identidad de la sesión llega a auth.uid() y muere con la transacción", async () => {
    const dentro = await executor.run<{ uid: string | null }>(
      "select auth.uid()::text as uid",
      [],
      USER
    );
    expect(dentro.rows[0].uid).toBe(USER);

    const fuera = await executor.run<{ uid: string | null }>(
      "select auth.uid()::text as uid",
      [],
      null
    );
    expect(fuera.rows[0].uid).toBeNull();
  });
});

describe("lectura del select de PostgREST", () => {
  it("separa columnas de embeds", () => {
    expect(parseSelect("*, clients(name)")).toEqual({
      columns: ["*"],
      embeds: [
        { alias: "clients", table: "clients", constraint: undefined, columns: ["name"], isCount: false },
      ],
    });
  });

  it("entiende alias y clave foránea explícita", () => {
    const { embeds } = parseSelect(
      "id, source:documents!comparisons_source_document_id_fkey(title)"
    );
    expect(embeds[0]).toEqual({
      alias: "source",
      table: "documents",
      constraint: "comparisons_source_document_id_fkey",
      columns: ["title"],
      isCount: false,
    });
  });

  it("reconoce tabla(count)", () => {
    expect(parseSelect("id, documents(count)").embeds[0].isCount).toBe(true);
  });

  it("rechaza un embed anidado en vez de generar SQL a medias", () => {
    expect(() => parseSelect("id, a(b(c))")).toThrow(/anidado/);
  });
});
