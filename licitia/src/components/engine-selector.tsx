"use client";

import { useEffect } from "react";
import { useAiProviders } from "@/hooks/use-ai-providers";
import { cn } from "@/lib/utils";
import type { AnalysisMode } from "@/lib/ai-providers";

const HELP: Record<AnalysisMode, string> = {
  gemini:
    "Análisis interpretativo con Google Gemini. Si se agota la cuota, se detiene con un aviso " +
    "(elige Automático para que continúe solo en otro motor).",
  groq:
    "Análisis interpretativo con Groq (Llama), muy rápido y con nivel gratuito generoso. " +
    "No genera vectores de búsqueda ni hace OCR de PDFs escaneados.",
  auto:
    "Prueba los proveedores de IA configurados en orden y, si todos se quedan sin cuota, " +
    "continúa automáticamente en modo local.",
  local:
    "Extracción por patrones: instantánea y sin consumir cuota ni créditos de ningún proveedor.",
};

const FALLBACK_LABEL: Record<AnalysisMode, string> = {
  gemini: "Gemini",
  groq: "Groq",
  auto: "Automático",
  local: "Sin IA",
};

/**
 * Selector explícito de motor de análisis: un botón por cada proveedor de IA
 * configurado (Gemini, Groq…), "Automático" (prueba varios y cae a local) y
 * "Sin IA" (siempre disponible). El usuario elige el motor cada vez — nunca
 * se cambia de proveedor sin que aparezca reflejado aquí.
 */
export function EngineSelector({
  value,
  onChange,
  className,
  compact = false,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  className?: string;
  compact?: boolean;
}) {
  const { providers, loading } = useAiProviders();
  const options: AnalysisMode[] = [
    ...providers.map((p) => p.id as AnalysisMode),
    ...(providers.length > 0 ? (["auto"] as AnalysisMode[]) : []),
    "local",
  ];

  // Sin proveedores configurados, "auto" no es una opción visible: se
  // reconcilia la selección a "local" para que un botón quede resaltado.
  useEffect(() => {
    if (!loading && providers.length === 0 && value !== "local") onChange("local");
  }, [loading, providers.length, value, onChange]);

  const labelFor = (m: AnalysisMode) =>
    providers.find((p) => p.id === m)?.label ?? FALLBACK_LABEL[m];

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {loading ? (
          <span className="text-xs text-muted-foreground">cargando motores…</span>
        ) : (
          options.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              title={HELP[m]}
              className={cn(
                "rounded-full border transition-colors",
                compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
                value === m
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {labelFor(m)}
            </button>
          ))
        )}
      </div>
      {!loading && providers.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          No hay proveedores de IA configurados: solo está disponible el análisis sin IA.
        </p>
      )}
      {!loading && !compact && <p className="mt-1 text-xs text-muted-foreground">{HELP[value]}</p>}
    </div>
  );
}
