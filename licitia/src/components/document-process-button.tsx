"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineSelector } from "@/components/engine-selector";
import { processDocument } from "@/lib/process-document";
import type { AnalysisMode } from "@/lib/ai-providers";

/** Lanza (o reintenta) el análisis por etapas del documento con el motor
 *  elegido, y refresca la ficha al terminar. */
export function DocumentProcessButton({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisMode>("auto");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setProgress("iniciando…");
    const result = await processDocument(documentId, setProgress, {
      restart: status === "error",
      mode,
    });
    setProgress(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? "El análisis no pudo completarse");
  }

  return (
    <div className="space-y-2">
      <EngineSelector value={mode} onChange={setMode} />
      <Button onClick={run} disabled={progress !== null}>
        {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {status === "error" ? "Reintentar análisis" : "Analizar documento"}
      </Button>
      {progress && (
        <p className="text-xs text-muted-foreground">{progress} — mantén esta pestaña abierta.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
