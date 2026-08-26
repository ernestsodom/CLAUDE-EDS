"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DocumentUploadPanel } from "@/components/document-upload-panel";

interface DocRow {
  id: string;
  title: string;
  status: string;
  tender_number: string | null;
  client_name: string | null;
}

/**
 * Cuadro comparativo múltiple: sube varias licitaciones, marca las que
 * quieras enfrentar y descarga un Excel con una fila por documento — número
 * de licitación, cliente, software solicitado, plazos, presupuesto,
 * servidores, multas, SLA, experiencia, migración, certificaciones y pauta
 * de evaluación. Ensambla lo que ya quedó extraído al procesar cada
 * documento — no vuelve a llamar a la IA, así que es instantáneo.
 */
export function ComparativeMatrixPanel({ documents }: { documents: DocRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(() => documents.filter((d) => d.status === "procesado"), [documents]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable.map((d) => d.id))));
  }

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/documents/comparative-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [...selected] }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "No se pudo generar el cuadro comparativo");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuadro-comparativo-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sube varias licitaciones y, una vez procesadas, marca las que quieras comparar para descargar
        un Excel con número de licitación, cliente, software solicitado, plazos, presupuesto,
        servidores, multas, SLA, experiencia, migración, certificaciones y pauta de evaluación — una
        fila por documento.
      </p>

      <DocumentUploadPanel />

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay documentos subidos.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>
                <input
                  type="checkbox"
                  checked={selectable.length > 0 && selected.size === selectable.length}
                  onChange={toggleAll}
                  aria-label="Seleccionar todos los documentos procesados"
                />
              </TH>
              <TH>Documento</TH>
              <TH>N° Licitación</TH>
              <TH>Cliente</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {documents.map((d) => {
              const canSelect = d.status === "procesado";
              return (
                <TR key={d.id}>
                  <TD>
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      disabled={!canSelect}
                      onChange={() => toggle(d.id)}
                      aria-label={`Seleccionar ${d.title}`}
                    />
                  </TD>
                  <TD className={canSelect ? "font-medium" : "text-muted-foreground"}>
                    {d.title}
                    {!canSelect && <span className="ml-1.5 text-xs">(sin procesar aún)</span>}
                  </TD>
                  <TD>{d.tender_number ?? "—"}</TD>
                  <TD>{d.client_name ?? "—"}</TD>
                  <TD>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={selected.size < 2 || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generar cuadro comparativo ({selected.size})
        </Button>
        {selected.size < 2 && (
          <p className="text-xs text-muted-foreground">Elige al menos 2 documentos procesados.</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
