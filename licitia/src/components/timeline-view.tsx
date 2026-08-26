"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  milestone_type: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  duration_label: string | null;
  is_estimated: boolean;
  page: number | null;
  quote: string | null;
  sort_order: number;
}

const TYPE_COLORS: Record<string, string> = {
  inicio: "bg-blue-500", hito: "bg-indigo-500", capacitacion: "bg-cyan-500",
  implementacion: "bg-violet-500", marcha_blanca: "bg-amber-500", recepcion: "bg-green-500",
  garantia: "bg-teal-500", soporte: "bg-sky-500", termino: "bg-red-500",
  entregable: "bg-fuchsia-500", otro: "bg-gray-500",
};

/** Línea de tiempo vertical interactiva: clic en un hito muestra su detalle y cita. */
export function TimelineView({ milestones }: { milestones: Milestone[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin hitos identificados aún.</p>;
  }

  return (
    <ol className="relative ml-3 space-y-1 border-l pl-6">
      {sorted.map((m) => {
        const open = selected === m.id;
        return (
          <li key={m.id} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] top-2.5 h-3 w-3 rounded-full ring-4 ring-background",
                TYPE_COLORS[m.milestone_type] ?? "bg-gray-500"
              )}
            />
            <button
              onClick={() => setSelected(open ? null : m.id)}
              className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.title}</span>
                <Badge variant="secondary" className="capitalize">
                  {m.milestone_type.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {m.starts_on ? formatDate(m.starts_on) : (m.duration_label ?? "sin fecha")}
                  {m.ends_on && m.ends_on !== m.starts_on ? ` → ${formatDate(m.ends_on)}` : ""}
                </span>
                {m.starts_on && m.is_estimated && (
                  <Badge variant="warning" title="Fecha calculada a partir de un plazo relativo, no indicada así en el documento">
                    estimada
                  </Badge>
                )}
              </div>
              {open && (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {m.is_estimated && m.duration_label && (
                    <p className="text-xs">
                      Fecha estimada a partir de <span className="italic">“{m.duration_label}”</span>{" "}
                      — el documento no da una fecha calendario para este hito; no es un dato literal.
                    </p>
                  )}
                  {m.description && <p>{m.description}</p>}
                  {m.quote && (
                    <blockquote className="border-l-2 pl-2 italic">
                      “{m.quote}” {m.page != null && <span>(pág. {m.page})</span>}
                    </blockquote>
                  )}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
