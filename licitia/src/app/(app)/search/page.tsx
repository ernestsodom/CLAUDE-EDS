"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  snippet: string;
  page_start: number | null;
  section: string | null;
  score: number;
}

const DOC_TYPES = [
  "licitacion", "bases_administrativas", "bases_tecnicas", "propuesta_comercial",
  "propuesta_tecnica", "contrato", "anexo", "informe", "acta", "avance",
];

/** Buscador inteligente: híbrido (semántico + texto completo) con filtros. */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, docType: docType || undefined, limit: 20 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error en la búsqueda");
      setResults(json.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Búsqueda inteligente</h1>
        <p className="text-sm text-muted-foreground">
          Búsqueda híbrida en toda la biblioteca: entiende sinónimos y conceptos, no solo palabras.
          Ej: “licitaciones que exigen firma electrónica”, “integración con Tesorería”.
        </p>
      </div>

      <form onSubmit={search} className="flex flex-wrap gap-2">
        <Input
          className="min-w-64 flex-1"
          placeholder="¿Qué estás buscando?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} resultados</p>
          {results.map((r) => (
            <Card key={r.chunk_id}>
              <CardContent className="p-4">
                <Link
                  href={`/documents/${r.document_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.document_title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.page_start != null && `Página ${r.page_start}`}
                  {r.section && ` · ${r.section}`}
                </p>
                <p className="mt-2 text-sm">{r.snippet}…</p>
              </CardContent>
            </Card>
          ))}
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin resultados para esta consulta.</p>
          )}
        </div>
      )}
    </div>
  );
}
