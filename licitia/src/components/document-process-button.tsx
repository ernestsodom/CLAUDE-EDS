"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, Zap } from "lucide-react";
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

  async function run(mode: "auto" | "local") {
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
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("auto")} disabled={progress !== null}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {status === "error" ? "Reintentar con IA" : "Analizar con IA"}
        </Button>
        <Button variant="outline" onClick={() => run("local")} disabled={progress !== null}>
          <Zap className="h-4 w-4" />
          Analizar sin IA
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <b>Con IA</b>: análisis interpretativo completo (consume cuota; si se agota, continúa
        automáticamente en modo local). <b>Sin IA</b>: extracción por patrones, instantánea y
        sin consumir cuota.
      </p>
      {progress && (
        <p className="text-xs text-muted-foreground">
          {progress} — mantén esta pestaña abierta.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
