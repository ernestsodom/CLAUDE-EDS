"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCw, Loader2, CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
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
  engine,
}: {
  documentId: string;
  part: AnalysisPart;
  label: string;
  description: string;
  status: "pendiente" | "procesando" | "listo" | "error";
  errorMessage?: string | null;
  /** Motor con el que se generó el resultado actual, si ya hay uno. "local"
   *  es el motor sin IA (por patrones) — más rápido y sin costo, pero más
   *  superficial: cuando es el que quedó guardado, se avisa para que se
   *  revise o se reanalice con IA si hace falta. */
  engine?: string | null;
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
  const effectiveStatus = busy ? "procesando" : status;
  // "listo" con motor local es un resultado más superficial (sin IA, por
  // patrones): se marca como que necesita revisión en vez de darlo por
  // bueno igual que un resultado de IA.
  const needsReview = effectiveStatus === "listo" && engine === "local";
  const STATUS_LABELS: Record<typeof effectiveStatus, string> = {
    pendiente: "Pendiente",
    procesando: "Procesando",
    listo: needsReview ? "Requiere revisión" : "Listo",
    error: "Error",
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{label}</p>
            <Badge variant={needsReview ? "warning" : statusVariant(effectiveStatus)} className="gap-1">
              {effectiveStatus === "procesando" && <Loader2 className="h-3 w-3 animate-spin" />}
              {effectiveStatus === "listo" && !needsReview && <CheckCircle2 className="h-3 w-3" />}
              {needsReview && <TriangleAlert className="h-3 w-3" />}
              {STATUS_LABELS[effectiveStatus]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {needsReview && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Generado con el motor local (sin IA): más superficial. Reanaliza con IA si necesitas
              profundidad.
            </p>
          )}
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
