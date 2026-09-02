"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCw, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineSelector } from "@/components/engine-selector";
import { analyzePart } from "@/lib/analyze-part";
import type { AnalysisMode } from "@/lib/ai-providers";
import type { AnalysisPart } from "@/core/services/ingestion.service";

/**
 * Botón de una parte del análisis a pedido (resumen, sistemas, línea de
 * tiempo, evaluación y anexos, puntos críticos, o preparar el chat). Cada
 * parte es independiente: pedirla, reintentarla o que falle no afecta a las
 * demás.
 */
export function AnalysisPartButton({
  documentId,
  part,
  label,
  description,
  status,
  errorMessage,
}: {
  documentId: string;
  part: AnalysisPart;
  label: string;
  description: string;
  status: "pendiente" | "procesando" | "listo" | "error";
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisMode>("auto");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(errorMessage ?? null);
  const [open, setOpen] = useState(false);

  async function run() {
    setError(null);
    setProgress("iniciando…");
    const result = await analyzePart(documentId, part, setProgress, { mode });
    setProgress(null);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "El análisis no pudo completarse");
    }
  }

  const busy = progress !== null;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{label}</p>
            {status === "listo" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {!open && (
          <Button
            size="sm"
            variant={status === "listo" ? "outline" : "default"}
            onClick={() => (status === "listo" ? setOpen(true) : run())}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "listo" ? (
              <RotateCw className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {status === "listo" ? "Reanalizar" : status === "error" ? "Reintentar" : "Analizar"}
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t pt-2">
          <EngineSelector value={mode} onChange={setMode} />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Reanalizar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
