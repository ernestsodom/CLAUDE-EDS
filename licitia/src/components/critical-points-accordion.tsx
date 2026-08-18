"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CRITICAL_TYPE_LABELS } from "@/core/ai/schemas";

type CriticalKey = keyof typeof CRITICAL_TYPE_LABELS;

interface RequirementRow {
  id: string;
  title: string;
  description: string | null;
  quote: string | null;
  page: number | null;
  priority: string;
  mandatory: boolean;
  critical_type: string | null;
  deadline_text: string | null;
}

/**
 * Puntos críticos agrupados por tipo (boleta de garantía, servidores, SLA,
 * plazos, multas, certificados, migración de datos). Cada punto se despliega
 * y contrae al hacer click para no saturar la vista cuando hay muchos.
 */
export function CriticalPointsAccordion({ requirements }: { requirements: RequirementRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Los documentos analizados antes de agregar critical_type no lo traen:
  // se muestran igualmente, agrupados como "otros".
  const grouped = new Map<string, RequirementRow[]>();
  for (const r of requirements) {
    const key = r.critical_type ?? "otros";
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }
  const groupLabel = (key: string) =>
    key === "otros" ? "Otros requerimientos" : CRITICAL_TYPE_LABELS[key as CriticalKey] ?? key;

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([key, items]) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-base">
              {groupLabel(key)} <span className="text-muted-foreground">({items.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((r) => {
              const isOpen = open.has(r.id);
              return (
                <div key={r.id} className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.mandatory ? "Obligatorio" : "No obligatorio"}
                        {r.deadline_text && ` · plazo: ${r.deadline_text}`}
                        {r.page != null && ` · pág. ${r.page}`}
                      </p>
                    </div>
                    <Badge variant={statusVariant(r.priority)}>{r.priority}</Badge>
                  </button>

                  {isOpen && (
                    <div className={cn("space-y-2 border-t px-4 py-3 text-sm")}>
                      {r.description && <p>{r.description}</p>}
                      {r.deadline_text && (
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="h-3 w-3" /> Plazo: {r.deadline_text}
                        </p>
                      )}
                      {r.quote && (
                        <p className="border-l-2 pl-2 text-xs italic text-muted-foreground">
                          “{r.quote}”{r.page != null && ` (pág. ${r.page})`}
                        </p>
                      )}
                      {!r.quote && r.page != null && (
                        <p className="text-xs text-muted-foreground">Página: {r.page}</p>
                      )}
                      {!r.description && !r.quote && !r.deadline_text && r.page == null && (
                        <p className="text-xs text-muted-foreground">Sin detalle adicional.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
