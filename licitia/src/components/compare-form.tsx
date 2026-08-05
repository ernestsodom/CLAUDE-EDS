"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DocumentPicker, type PickedDocument } from "@/components/document-picker";

interface HistoryItem {
  id: string; comparison_type: string; status: string; traffic_light: string | null;
  created_at: string;
  source: { title: string } | null; target: { title: string } | null;
}

const TYPES = [
  { id: "cumplimiento", label: "Control de cumplimiento (comprometido vs entregado)" },
  { id: "licitacion_vs_licitacion", label: "Dos licitaciones" },
  { id: "propuesta_vs_propuesta", label: "Dos propuestas" },
  { id: "contrato_vs_contrato", label: "Dos contratos" },
  { id: "version_vs_version", label: "Dos versiones" },
];

/**
 * Formulario del comparador. Cada documento se elige buscando entre los ya
 * subidos o subiéndolo directamente desde esta pantalla (con seguimiento del
 * procesamiento IA hasta que quede listo para comparar).
 */
export function CompareForm({ history }: { history: HistoryItem[] }) {
  const router = useRouter();
  const [type, setType] = useState("cumplimiento");
  const [source, setSource] = useState<PickedDocument | null>(null);
  const [target, setTarget] = useState<PickedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompliance = type === "cumplimiento";
  const bothReady =
    source?.status === "procesado" && target?.status === "procesado" && source.id !== target.id;

  async function run() {
    if (!bothReady || !source || !target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comparisonType: type,
          sourceDocumentId: source.id,
          targetDocumentId: target.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al comparar");
      router.push(`/compare?r=${json.comparisonId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="space-y-3 p-5">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Tipo de comparación"
          >
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <DocumentPicker
            label={isCompliance ? "1 · Documento técnico base" : "1 · Documento A"}
            hint={
              isCompliance
                ? "La licitación, bases técnicas o contrato con lo comprometido."
                : undefined
            }
            value={source}
            onChange={setSource}
          />
          <DocumentPicker
            label={isCompliance ? "2 · Documento a comparar (control de entregas)" : "2 · Documento B"}
            hint={
              isCompliance
                ? "Tu documento propio con lo realmente entregado, incluidos trabajos adicionales."
                : undefined
            }
            value={target}
            onChange={setTarget}
          />

          {isCompliance && (
            <p className="text-xs text-muted-foreground">
              El sistema clasifica cada requerimiento del documento base contra tu control
              (cumplido / parcial / pendiente) y además detecta las entregas tuyas que no
              responden a ningún requerimiento del acuerdo, marcándolas como{" "}
              <span className="font-medium">adicionales</span> — incluyendo las realizadas sin costo.
            </p>
          )}
          {source && target && source.id === target.id && (
            <p className="text-sm text-destructive">Selecciona dos documentos distintos.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={run} disabled={busy || !bothReady}>
            {busy
              ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analizando (puede tardar minutos)…</>)
              : "Comparar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 p-4">
          <p className="mb-2 text-sm font-medium">Comparaciones recientes</p>
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/compare?r=${h.id}`}
              className="block rounded-md px-2 py-1.5 text-xs hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                {h.traffic_light && <Badge variant={statusVariant(h.traffic_light)}>{h.traffic_light}</Badge>}
                <span className="truncate">{h.source?.title} vs {h.target?.title}</span>
              </div>
              <span className="text-muted-foreground">{formatDate(h.created_at)}</span>
            </Link>
          ))}
          {history.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay comparaciones.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
