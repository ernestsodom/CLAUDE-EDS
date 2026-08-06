"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UploadCloud, Loader2, FileText, X, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, statusVariant } from "@/components/ui/badge";
import { processDocument } from "@/lib/process-document";

export interface PickedDocument {
  id: string;
  title: string;
  doc_type: string;
  status: string;
}

/**
 * Selector de documento para el comparador: buscar entre los ya subidos
 * o subir uno nuevo desde la misma pantalla. Si el documento recién subido
 * aún se está procesando, muestra el avance y avisa cuando queda listo.
 */
export function DocumentPicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: PickedDocument | null;
  onChange: (doc: PickedDocument | null) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Buscar entre los documentos ya subidos (RLS limita a los autorizados)
  useEffect(() => {
    if (!searching) return;
    const supabase = createClient();
    const t = setTimeout(async () => {
      let q = supabase
        .from("documents")
        .select("id, title, doc_type, status")
        .is("parent_document_id", null)
        .order("created_at", { ascending: false })
        .limit(8);
      if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
      const { data } = await q;
      setResults((data ?? []) as PickedDocument[]);
    }, 250);
    return () => clearTimeout(t);
  }, [query, searching]);

  /** Ejecuta el análisis por etapas y deja el documento listo para comparar. */
  async function runAnalysis(
    documentId: string,
    title: string,
    restart = false,
    mode: "auto" | "local" = "auto"
  ) {
    setProgress("iniciando análisis…");
    setError(null);
    const result = await processDocument(documentId, (label) => setProgress(label), { restart, mode });
    setProgress(null);
    if (result.ok) {
      onChange({ id: documentId, title, doc_type: "otro", status: "procesado" });
    } else {
      setError(result.error ?? "El análisis no pudo completarse");
      onChange({ id: documentId, title, doc_type: "otro", status: "error" });
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al subir");
      onChange({ id: json.documentId, title: file.name, doc_type: "otro", status: "procesando" });
      setSearching(false);
      setUploading(false);
      await runAnalysis(json.documentId, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>

      {value ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{value.title}</span>
          <Badge variant={statusVariant(value.status)}>
            {value.status === "procesando" ? "procesando…" : value.status}
          </Badge>
          <button onClick={() => onChange(null)} aria-label="Quitar documento">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSearching(!searching)}>
            <Search className="h-4 w-4" /> Buscar entre los subidos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Subir nuevo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.txt,.ppt,.pptx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          />
        </div>
      )}

      {searching && !value && (
        <div className="space-y-1 rounded-md border bg-background p-2">
          <Input
            autoFocus
            placeholder="Buscar por título…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="max-h-48 overflow-y-auto">
            {results.map((d) => (
              <li key={d.id}>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(d);
                    setSearching(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {d.doc_type.replace(/_/g, " ")}
                  </span>
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-foreground">Sin resultados.</li>
            )}
          </ul>
        </div>
      )}

      {progress && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {progress}
        </p>
      )}

      {/* Documento elegido que aún no está analizado: se puede lanzar aquí mismo */}
      {value && value.status !== "procesado" && !progress && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Este documento aún no está analizado, por eso no se puede comparar todavía.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runAnalysis(value.id, value.title, value.status === "error")}
            >
              <Play className="h-3.5 w-3.5" />
              {value.status === "error" ? "Reintentar con IA" : "Analizar con IA"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => runAnalysis(value.id, value.title, value.status === "error", "local")}
              title="Extracción por patrones, sin consumir cuota de IA"
            >
              Analizar sin IA
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
