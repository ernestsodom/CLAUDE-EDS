"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processDocument } from "@/lib/process-document";

/** Lanza (o reintenta) el análisis por etapas del documento y refresca la ficha. */
export function DocumentProcessButton({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setProgress("iniciando…");
    const result = await processDocument(documentId, setProgress, { restart: status === "error" });
    setProgress(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? "El análisis no pudo completarse");
  }

  return (
    <div className="space-y-1">
      <Button onClick={run} disabled={progress !== null} variant={status === "error" ? "outline" : "default"}>
        {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {status === "error" ? "Reintentar análisis" : "Analizar documento"}
      </Button>
      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {progress && (
        <p className="text-xs text-muted-foreground">
          Mantén esta pestaña abierta; el análisis avanza por etapas.
        </p>
      )}
    </div>
  );
}
