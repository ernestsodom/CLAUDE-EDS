"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineSelector } from "@/components/engine-selector";
import { processDocument } from "@/lib/process-document";
import type { AnalysisMode } from "@/lib/ai-providers";

/**
 * Vuelve a cargar el documento con otro motor (útil si la extracción o la
 * clasificación no salieron bien con el motor anterior): crea una versión
 * nueva (el archivo no se vuelve a subir), la deja recién cargada — sin
 * ningún análisis todavía, esos se piden aparte — y conserva la versión
 * anterior intacta en la pestaña Versiones.
 */
export function ReanalyzeButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>("auto");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setProgress("creando nueva versión…");
    try {
      const res = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo iniciar el reanálisis");

      const result = await processDocument(documentId, setProgress, { mode });
      setProgress(null);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "El análisis no pudo completarse");
      }
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Recargar con otro motor
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Recargar con otro motor</p>
      <p className="text-xs text-muted-foreground">
        Crea una versión nueva sin perder la actual; podrás ver ambas desde Versiones. Los análisis
        (resumen, sistemas, etc.) de la versión nueva se piden aparte, uno por uno.
      </p>
      <EngineSelector value={mode} onChange={setMode} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={progress !== null}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Recargar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={progress !== null}>
          Cancelar
        </Button>
      </div>
      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
