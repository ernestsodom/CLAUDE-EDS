"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CalendarClock, Loader2, Play, RotateCw } from "lucide-react";
import { toggleSystemFeature, setSystemFeatureDeadline } from "@/actions/system-features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EngineSelector } from "@/components/engine-selector";
import { analyzeSystemFeatures } from "@/lib/analyze-features";
import { cn, formatDate } from "@/lib/utils";
import type { SystemRow } from "@/core/repositories/checklist.repo";
import type { AnalysisMode } from "@/lib/ai-providers";

const EVIDENCE_LABELS: Record<"explicito" | "implicito" | "interpretacion", string> = {
  explicito: "explícito",
  implicito: "implícito",
  interpretacion: "interpretación",
};

/**
 * Checklist de sistemas: un botón por sistema que al pulsarlo despliega sus
 * funcionalidades — a pedido, sistema por sistema (no todos de una vez: es
 * la etapa que antes agotaba tiempo y cuota). Es la parte de la que depende
 * el comparador Checklist vs Excel: sin funcionalidades no hay nada que
 * enfrentar contra el Excel de control.
 *
 * Cada funcionalidad se marca como completada con un check y admite un
 * plazo propio; el porcentaje de cumplimiento se recalcula al vuelo, por
 * sistema y para el documento completo.
 *
 * Las marcas se guardan en el acto vía Server Action (política
 * features_update sigue aplicando igual, ahora del lado del servidor).
 */
export function SystemsChecklist({
  documentId,
  systems: initial,
}: {
  documentId: string;
  systems: SystemRow[];
}) {
  const router = useRouter();
  const [systems, setSystems] = useState(initial);
  const [open, setOpen] = useState<Set<string>>(
    // Con un único sistema no tiene sentido obligar a un clic extra.
    () => new Set(initial.length === 1 ? [initial[0].id] : [])
  );
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [engineOpen, setEngineOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("auto");

  const totals = useMemo(() => {
    const all = systems.flatMap((s) => s.features);
    const done = all.filter((f) => f.is_completed).length;
    return { total: all.length, done, pct: all.length === 0 ? 0 : Math.round((done / all.length) * 100) };
  }, [systems]);

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Aplica el cambio en pantalla de inmediato; si el guardado falla, lo revierte. */
  function applyOptimistic(
    featureId: string,
    optimistic: (f: SystemRow["features"][number]) => SystemRow["features"][number]
  ) {
    const before = systems;
    setSystems((prev) =>
      prev.map((s) => ({
        ...s,
        features: s.features.map((f) => (f.id === featureId ? optimistic(f) : f)),
      }))
    );
    return before;
  }

  async function toggleFeature(featureId: string, completed: boolean) {
    const before = applyOptimistic(featureId, (f) => ({
      ...f,
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    }));
    setSaving((prev) => new Set(prev).add(featureId));
    setError(null);

    const { error: dbError } = await toggleSystemFeature(featureId, completed);

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(featureId);
      return next;
    });
    if (dbError) {
      setSystems(before);
      setError(`No se pudo guardar el cambio: ${dbError}`);
    }
  }

  async function setDeadline(featureId: string, value: string) {
    const date = value || null;
    const before = applyOptimistic(featureId, (f) => ({ ...f, deadline_date: date }));
    setSaving((prev) => new Set(prev).add(featureId));
    setError(null);

    const { error: dbError } = await setSystemFeatureDeadline(featureId, date);

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(featureId);
      return next;
    });
    if (dbError) {
      setSystems(before);
      setError(`No se pudo guardar el cambio: ${dbError}`);
    }
  }

  async function runFeatures(systemId: string) {
    setAnalyzing((prev) => new Set(prev).add(systemId));
    setProgress((prev) => ({ ...prev, [systemId]: "iniciando…" }));
    setError(null);

    const result = await analyzeSystemFeatures(
      documentId,
      systemId,
      (label) => setProgress((prev) => ({ ...prev, [systemId]: label })),
      { mode }
    );

    setAnalyzing((prev) => {
      const next = new Set(prev);
      next.delete(systemId);
      return next;
    });
    setProgress((prev) => {
      const next = { ...prev };
      delete next[systemId];
      return next;
    });

    if (result.ok) {
      setEngineOpen(null);
      router.refresh();
    } else {
      setError(result.error ?? "No se pudieron analizar las funcionalidades");
    }
  }

  if (systems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no se han identificado sistemas en este documento. Procésalo (o vuelve a procesarlo)
        para generar el checklist de sistemas y funcionalidades.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Cumplimiento global</p>
            <p className="text-xs text-muted-foreground">
              {totals.done} de {totals.total} funcionalidades completadas · {systems.length}{" "}
              {systems.length === 1 ? "sistema" : "sistemas"}
            </p>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{totals.pct}%</span>
        </div>
        <Progress value={totals.pct} className="mt-3" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {systems.map((system) => {
          const done = system.features.filter((f) => f.is_completed).length;
          const pct =
            system.features.length === 0 ? 0 : Math.round((done / system.features.length) * 100);
          const isOpen = open.has(system.id);

          return (
            <div key={system.id} className="overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => toggleOpen(system.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{system.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {done}/{system.features.length} funcionalidades
                    {system.deadline_text && ` · plazo: ${system.deadline_text}`}
                    {system.page != null && ` · pág. ${system.page}`}
                  </p>
                </div>
                <div className="hidden w-32 sm:block">
                  <Progress value={pct} />
                </div>
                <Badge variant={pct === 100 ? "success" : pct > 0 ? "warning" : "secondary"}>
                  {pct}%
                </Badge>
              </button>

              {isOpen && (
                <div className="border-t">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">
                      {system.features.length > 0
                        ? "Vuelve a analizar si crees que faltó cobertura."
                        : "Todavía no se pidieron las funcionalidades de este sistema."}
                    </p>
                    {engineOpen === system.id ? (
                      <div className="flex items-center gap-2">
                        <EngineSelector value={mode} onChange={setMode} compact />
                        <Button
                          size="sm"
                          onClick={() => runFeatures(system.id)}
                          disabled={analyzing.has(system.id)}
                        >
                          {analyzing.has(system.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5" />
                          )}
                          Analizar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEngineOpen(null)}
                          disabled={analyzing.has(system.id)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={system.features.length > 0 ? "outline" : "default"}
                        onClick={() =>
                          system.features.length > 0
                            ? setEngineOpen(system.id)
                            : runFeatures(system.id)
                        }
                        disabled={analyzing.has(system.id)}
                      >
                        {analyzing.has(system.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : system.features.length > 0 ? (
                          <RotateCw className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {system.features.length > 0 ? "Reanalizar" : "Analizar funcionalidades"}
                      </Button>
                    )}
                  </div>
                  {progress[system.id] && (
                    <p className="px-4 pb-2 text-xs text-muted-foreground">{progress[system.id]}</p>
                  )}
                  <ul className="divide-y border-t">
                  {system.features.map((feature) => (
                    <li
                      key={feature.id}
                      className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap"
                    >
                      <input
                        type="checkbox"
                        checked={feature.is_completed}
                        onChange={(e) => toggleFeature(feature.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                        aria-label={`Marcar como completada: ${feature.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm",
                            feature.is_completed && "text-muted-foreground line-through"
                          )}
                        >
                          {feature.name}
                          {!feature.is_mandatory && (
                            <Badge variant="secondary" className="ml-2">
                              opcional
                            </Badge>
                          )}
                          {feature.evidence_type && feature.evidence_type !== "explicito" && (
                            <Badge variant="secondary" className="ml-2">
                              {EVIDENCE_LABELS[feature.evidence_type]}
                            </Badge>
                          )}
                        </p>
                        {feature.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {feature.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {feature.deadline_text && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {feature.deadline_text}
                            </span>
                          )}
                          {feature.page != null && <span>pág. {feature.page}</span>}
                          {feature.is_completed && feature.completed_at && (
                            <span>completada el {formatDate(feature.completed_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {saving.has(feature.id) && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                        <input
                          type="date"
                          value={feature.deadline_date ?? ""}
                          onChange={(e) => setDeadline(feature.id, e.target.value)}
                          title="Plazo comprometido"
                          aria-label={`Plazo de ${feature.name}`}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        />
                      </div>
                    </li>
                  ))}
                  {system.features.length === 0 && (
                    <li className="px-4 py-3 text-sm text-muted-foreground">
                      Sin funcionalidades detectadas para este sistema.
                    </li>
                  )}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Barra de avance simple, sin dependencias. */
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded transition-all",
          value === 100 ? "bg-green-500" : value > 0 ? "bg-primary" : "bg-muted"
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
