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
  claude:
    "Análisis con Claude Haiku 4.5. DE PAGO: se cobra por uso desde el primer token, a diferencia " +
    "de Gemini y Groq. No genera vectores de búsqueda ni hace OCR de PDFs escaneados. " +
    "«Automático» nunca lo elige por su cuenta: solo se usa si lo marcas aquí.",
  auto:
    "Prueba los proveedores gratuitos configurados en orden y, si todos se quedan sin cuota, " +
    "continúa automáticamente en modo local. Nunca salta a un proveedor de pago.",
  local:
    "Extracción por patrones: instantánea y sin consumir cuota ni créditos de ningún proveedor.",
};

const FALLBACK_LABEL: Record<AnalysisMode, string> = {
  gemini: "Gemini",
  groq: "Groq",
  claude: "Claude Haiku 4.5",
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
  hideLocal = false,
  hideAuto = false,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  className?: string;
  compact?: boolean;
  /** Análisis que no tienen versión por patrones (comparaciones, reclamos). */
  hideLocal?: boolean;
  hideAuto?: boolean;
}) {
  const { providers, loading } = useAiProviders();
  const options: AnalysisMode[] = [
    ...providers.map((p) => p.id as AnalysisMode),
    ...(providers.length > 0 && !hideAuto ? (["auto"] as AnalysisMode[]) : []),
    ...(hideLocal ? [] : (["local"] as AnalysisMode[])),
  ];

  // Sin proveedores configurados, "auto" no es una opción visible: se
  // reconcilia la selección a "local" para que un botón quede resaltado.
  useEffect(() => {
    if (loading || hideLocal) return;
    if (providers.length === 0 && value !== "local") onChange("local");
  }, [loading, providers.length, value, onChange, hideLocal]);

  // Con opciones acotadas (sin local/auto), la selección debe caer sobre un
  // motor que exista; si no, ningún botón quedaría marcado.
  useEffect(() => {
    if (loading || options.length === 0) return;
    if (!options.includes(value)) onChange(options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, options.join(","), value]);

  const labelFor = (m: AnalysisMode) =>
    providers.find((p) => p.id === m)?.label ?? FALLBACK_LABEL[m];
  const isPaid = (m: AnalysisMode) => providers.find((p) => p.id === m)?.isPaid ?? false;

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
              {/* El costo debe verse en el botón, no solo al pasar el cursor:
                  quien elige motor tiene que saber cuál le cobra. */}
              {isPaid(m) && <span className="ml-1 opacity-70">· de pago</span>}
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
