"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  TriangleAlert,
  ChevronDown,
  ChevronRight,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Progress } from "@/components/systems-checklist";
import { DocumentPicker, type PickedDocument } from "@/components/document-picker";
import type { ChecklistComparison } from "@/core/services/checklist.service";

const STATE_LABEL: Record<string, string> = {
  entregado: "Entregado",
  en_desarrollo: "En desarrollo",
  pendiente: "Pendiente",
  ausente: "Ausente en el Excel",
};

const STATE_VARIANT: Record<string, "success" | "warning" | "secondary" | "danger"> = {
  entregado: "success",
  en_desarrollo: "warning",
  pendiente: "secondary",
  ausente: "danger",
};

/**
 * Comparador: checklist de sistemas del documento base contra el Excel de
 * control con formato predeterminado (docs/formato-excel.md).
 *
 * El segundo archivo es SIEMPRE un Excel, nunca un documento analizado por
 * IA: así la comparación es determinista, instantánea y no gasta cuota. Lo
 * que aparece en el Excel y no exige el documento base se destaca aparte —
 * es el trabajo entregado de más, muchas veces sin cobrar.
 */
export function ChecklistComparator() {
  const [base, setBase] = useState<PickedDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ChecklistComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = base?.status === "procesado";

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function compare() {
    if (!base || !file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/documents/${base.id}/checklist/compare`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al comparar");
      setResult(json as ChecklistComparison);
      setOpen(new Set([0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <DocumentPicker
            label="1 · Documento base (licitación, bases técnicas o contrato)"
            hint="De aquí sale el checklist de sistemas y funcionalidades comprometidas."
            value={base}
            onChange={(doc) => {
              setBase(doc);
              setResult(null);
            }}
          />
          {ready && (
            <p className="text-xs text-muted-foreground">
              Antes de comparar, asegúrate de haber pedido las funcionalidades de cada sistema que
              te interese en la ficha del documento (pestaña Sistemas → Analizar funcionalidades):
              se piden por sistema, no automáticamente al cargar.
            </p>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">2 · Tu control de entregas (Excel)</p>
              <p className="text-xs text-muted-foreground">
                Debe ser un archivo <span className="font-medium">.xlsx</span> con el formato
                predeterminado. Descárgalo ya pre-llenado con el checklist del documento base y
                solo completa lo entregado.{" "}
                <Link href="/formato-excel" className="text-primary underline">
                  Ver el formato
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  if (base) window.location.href = `/api/documents/${base.id}/checklist/template`;
                }}
              >
                <Download className="h-4 w-4" /> Descargar plantilla Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {file ? "Cambiar archivo" : "Seleccionar Excel"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
              {file && (
                <span className="flex items-center text-sm text-muted-foreground">{file.name}</span>
              )}
            </div>
            {!ready && base && (
              <p className="text-xs text-muted-foreground">
                La plantilla estará disponible cuando el documento base termine de analizarse.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={compare} disabled={busy || !ready || !file}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Comparar
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Cumplimiento" value={`${result.totals.pctCompleted}%`} highlight />
            <Kpi label="Funcionalidades exigidas" value={String(result.totals.totalFeatures)} />
            <Kpi label="Entregadas" value={String(result.totals.completed)} />
            <Kpi label="Ausentes en el Excel" value={String(result.totals.missing)} />
            <Kpi label="Adicionales detectados" value={String(result.totals.extra)} />
          </div>

          {result.extras.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TriangleAlert className="h-4 w-4 text-amber-600" />
                  {result.extras.length} funcionalidades en tu Excel que el documento base no exige
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Trabajo entregado fuera de lo comprometido
                  {result.totals.freeExtras > 0 && (
                    <>
                      {" "}
                      —{" "}
                      <span className="font-medium text-foreground">
                        {result.totals.freeExtras} sin costo
                      </span>
                    </>
                  )}
                  . Es tu respaldo en negociaciones y al responder reclamos.
                </p>
                <Table>
                  <THead>
                    <TR>
                      <TH>Sistema (según tu Excel)</TH>
                      <TH>Funcionalidad</TH>
                      <TH>Estado</TH>
                      <TH>Condición</TH>
                      <TH>Fila</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {result.extras.map((extra) => (
                      <TR key={extra.row} className="bg-amber-500/10">
                        <TD>{extra.system}</TD>
                        <TD>
                          <p className="font-medium">{extra.feature}</p>
                          {extra.notes && (
                            <p className="text-xs text-muted-foreground">{extra.notes}</p>
                          )}
                        </TD>
                        <TD>
                          <Badge variant={STATE_VARIANT[extra.state]}>
                            {STATE_LABEL[extra.state]}
                          </Badge>
                        </TD>
                        <TD>
                          {extra.isFree ? (
                            <Badge variant="success" className="gap-1">
                              <Gift className="h-3 w-3" /> sin costo
                            </Badge>
                          ) : extra.isAdditional ? (
                            <Badge>adicional</Badge>
                          ) : (
                            <Badge variant="secondary">no comprometida</Badge>
                          )}
                        </TD>
                        <TD className="tabular-nums text-muted-foreground">{extra.row}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {result.systems.map((system, i) => {
              const isOpen = open.has(i);
              return (
                <div key={system.name} className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
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
                        {system.completed}/{system.total} entregadas
                        {system.deadlineText && ` · plazo: ${system.deadlineText}`}
                      </p>
                    </div>
                    <div className="hidden w-32 sm:block">
                      <Progress value={system.pct} />
                    </div>
                    <Badge
                      variant={system.pct === 100 ? "success" : system.pct > 0 ? "warning" : "danger"}
                    >
                      {system.pct}%
                    </Badge>
                  </button>

                  {isOpen && (
                    <ul className="divide-y border-t">
                      {system.features.map((feature, j) => (
                        <li
                          key={j}
                          className={`flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm ${
                            feature.state === "ausente" ? "bg-red-500/5" : ""
                          }`}
                        >
                          <Badge variant={STATE_VARIANT[feature.state]} className="shrink-0">
                            {STATE_LABEL[feature.state]}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p>{feature.name}</p>
                            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              {feature.deadlineText && <span>plazo: {feature.deadlineText}</span>}
                              {feature.deliveredOn && <span>entregada: {feature.deliveredOn}</span>}
                              {feature.excelRow != null && <span>Excel fila {feature.excelRow}</span>}
                              {feature.notes && <span>{feature.notes}</span>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={highlight ? "text-2xl font-semibold" : "text-xl font-semibold"}>{value}</p>
      </CardContent>
    </Card>
  );
}
