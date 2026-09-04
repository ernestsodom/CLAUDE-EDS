"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText, Users, Landmark, Clock, ShieldAlert, CircleDollarSign,
  LayoutList, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Progress } from "@/components/systems-checklist";
import { STEP_LABELS } from "@/core/services/ingestion.service";
import { cn, formatCLP, formatDate } from "@/lib/utils";

export interface DashboardDrilldown {
  documents: Array<{ id: string; title: string; doc_type: string; status: string; doc_date: string | null; client: string | null }>;
  clients: Array<{ id: string; name: string; documents: number }>;
  tenders: Array<{ number: string; name: string | null; documents: number; amount: number | null }>;
  pending: Array<{ id: string; title: string; status: string; step: string | null; error: string | null }>;
  critical: Array<{ type: string; label: string; count: number; samples: Array<{ id: string; title: string; document_id: string }> }>;
  systems: { systems: number; features: number; completed: number; pct: number; byDocument: Array<{ id: string; title: string; total: number; done: number; pct: number }> };
  amounts: Array<{ client: string; amount: number }>;
}

export interface DashboardTotals {
  documents: number;
  clients: number;
  tenders: number;
  pending: number;
  critical: number;
  amount: number;
}

type PanelId = keyof typeof PANELS;

const PANELS = {
  documents: { label: "Documentos", icon: FileText },
  clients: { label: "Clientes", icon: Users },
  tenders: { label: "Licitaciones", icon: Landmark },
  pending: { label: "Pendientes", icon: Clock },
  systems: { label: "Sistemas", icon: LayoutList },
  critical: { label: "Puntos críticos", icon: ShieldAlert },
  amount: { label: "Monto total", icon: CircleDollarSign },
} as const;

/**
 * KPIs del dashboard: cada tarjeta es un botón que despliega su contenido
 * bajo la fila. Un número suelto no dice nada — lo útil es poder abrirlo y ver
 * QUÉ hay dentro sin salir de la pantalla, y saltar desde ahí al documento.
 */
export function DashboardKpis({
  totals,
  data,
}: {
  totals: DashboardTotals;
  data: DashboardDrilldown;
}) {
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  const values: Record<PanelId, string> = {
    documents: String(totals.documents),
    clients: String(totals.clients),
    tenders: String(totals.tenders),
    pending: String(totals.pending),
    systems: `${data.systems.pct}%`,
    critical: String(totals.critical),
    amount: formatCLP(totals.amount),
  };

  const subtitles: Record<PanelId, string> = {
    documents: "en la biblioteca",
    clients: "con documentos",
    tenders: "identificadas",
    pending: totals.pending > 0 ? "sin procesar o con error" : "todo procesado",
    systems: `${data.systems.completed}/${data.systems.features} funcionalidades`,
    critical: "garantías, plazos, multas…",
    amount: "suma de los documentos",
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {(Object.keys(PANELS) as PanelId[]).map((id) => {
          const { label, icon: Icon } = PANELS[id];
          const active = openPanel === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setOpenPanel(active ? null : id)}
              aria-expanded={active}
              className={cn(
                "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent",
                active && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {active ? (
                  <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <p className="mt-2 text-xl font-semibold">{values[id]}</p>
              <p className="text-xs text-muted-foreground">{subtitles[id]}</p>
            </button>
          );
        })}
      </div>

      {openPanel && (
        <Card>
          <CardContent className="p-4">
            <Panel id={openPanel} data={data} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

function Panel({ id, data }: { id: PanelId; data: DashboardDrilldown }) {
  if (id === "documents") {
    if (data.documents.length === 0) return <Empty>Aún no has subido documentos.</Empty>;
    return (
      <ul className="divide-y">
        {data.documents.map((d) => (
          <li key={d.id}>
            <Link
              href={`/documents/${d.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{d.title}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {d.doc_type.replace(/_/g, " ")} · {d.client ?? "sin cliente"} ·{" "}
                  {formatDate(d.doc_date)}
                </p>
              </div>
              <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
            </Link>
          </li>
        ))}
        <li className="pt-2">
          <Link href="/documents" className="text-sm text-primary underline">
            Ver todos los documentos →
          </Link>
        </li>
      </ul>
    );
  }

  if (id === "clients") {
    if (data.clients.length === 0) return <Empty>Sin clientes registrados todavía.</Empty>;
    return (
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.clients.map((c) => (
          <li key={c.id} className="rounded-md border px-3 py-2 text-sm">
            <p className="truncate font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.documents} documentos</p>
          </li>
        ))}
      </ul>
    );
  }

  if (id === "tenders") {
    if (data.tenders.length === 0) return <Empty>No se ha identificado ninguna licitación.</Empty>;
    return (
      <ul className="divide-y">
        {data.tenders.map((t) => (
          <li key={t.number} className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.name ?? t.number}</p>
              <p className="text-xs text-muted-foreground">
                N° {t.number} · {t.documents} documentos
              </p>
            </div>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCLP(t.amount)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (id === "pending") {
    if (data.pending.length === 0)
      return <Empty>Todos los documentos están procesados. Nada pendiente.</Empty>;
    return (
      <ul className="divide-y">
        {data.pending.map((d) => (
          <li key={d.id}>
            <Link
              href={`/documents/${d.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.error ?? (d.step ? `etapa: ${STEP_LABELS[d.step] ?? d.step}` : "sin analizar")}
                </p>
              </div>
              <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (id === "systems") {
    if (data.systems.byDocument.length === 0)
      return (
        <Empty>
          Aún no hay sistemas identificados. Procesa una licitación o unas bases técnicas para
          generar su checklist.
        </Empty>
      );
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {data.systems.systems} sistemas · {data.systems.completed} de {data.systems.features}{" "}
          funcionalidades completadas
        </p>
        <ul className="space-y-2">
          {data.systems.byDocument.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.done}/{d.total} funcionalidades
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <Progress value={d.pct} />
                </div>
                <Badge variant={d.pct === 100 ? "success" : d.pct > 0 ? "warning" : "secondary"}>
                  {d.pct}%
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (id === "critical") {
    if (data.critical.length === 0)
      return <Empty>No se han extraído puntos críticos todavía.</Empty>;
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.critical.map((group) => (
          <div key={group.type} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{group.label}</p>
              <Badge variant="secondary">{group.count}</Badge>
            </div>
            <ul className="mt-2 space-y-1">
              {group.samples.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/documents/${s.document_id}`}
                    className="line-clamp-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // amount
  if (data.amounts.length === 0) return <Empty>Ningún documento tiene monto registrado.</Empty>;
  const max = Math.max(...data.amounts.map((a) => a.amount), 1);
  return (
    <ul className="space-y-2">
      {data.amounts.map((a) => (
        <li key={a.client} className="flex items-center gap-3 text-sm">
          <span className="w-48 truncate">{a.client}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
            <div className="h-full rounded bg-primary" style={{ width: `${(a.amount / max) * 100}%` }} />
          </div>
          <span className="w-32 shrink-0 text-right tabular-nums">{formatCLP(a.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
