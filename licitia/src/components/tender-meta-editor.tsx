"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { updateTenderMeta } from "@/actions/projects";
import { TENDER_STATUSES, TENDER_STATUS_LABELS, type TenderStatus } from "@/lib/tender-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Edita los datos propios de la licitación que agrupa esta carpeta — N°,
 * estado y fecha de cierre. Los tres son opcionales: vacíos, la carpeta
 * sigue siendo una carpeta simple, como antes de esta columna.
 */
export function TenderMetaEditor({
  projectId,
  tenderNumber,
  tenderStatus,
  closingDate,
}: {
  projectId: string;
  tenderNumber: string | null;
  tenderStatus: TenderStatus | null;
  closingDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(tenderNumber ?? "");
  const [status, setStatus] = useState<TenderStatus | "">(tenderStatus ?? "");
  const [closing, setClosing] = useState(closingDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setNumber(tenderNumber ?? "");
    setStatus(tenderStatus ?? "");
    setClosing(closingDate ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const { error: dbError } = await updateTenderMeta(projectId, {
      tenderNumber: number.trim() || null,
      tenderStatus: status || null,
      closingDate: closing || null,
    });
    setBusy(false);
    if (dbError) {
      setError("No se pudo guardar");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={start}>
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">N° de licitación</span>
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          disabled={busy}
          className="h-8 w-40 text-sm"
          placeholder="Ej. 1234-56-LE24"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Estado</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TenderStatus | "")}
          disabled={busy}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Sin estado</option>
          {TENDER_STATUSES.map((s) => (
            <option key={s} value={s}>{TENDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Fecha de cierre</span>
        <input
          type="date"
          value={closing}
          onChange={(e) => setClosing(e.target.value)}
          disabled={busy}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        />
      </label>
      <Button type="button" size="sm" onClick={save} disabled={busy}>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Guardar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
        Cancelar
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
