"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

/** Botones de exportación: descargan el archivo generado por /api/export. */
export function ExportButtons({
  kind,
  entityId,
}: {
  kind: "resumen" | "comparacion" | "variables" | "requerimientos";
  entityId: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(format: string) {
    setBusy(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, kind, entityId }),
      });
      if (!res.ok) throw new Error("Error exportando");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(["pdf", "docx", "xlsx", "pptx", "csv"] as const).map((f) => (
        <Button
          key={f}
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => download(f)}
        >
          <Download className="h-3 w-3" />
          {busy === f ? "…" : f.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
