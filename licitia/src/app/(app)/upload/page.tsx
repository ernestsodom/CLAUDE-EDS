"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/components/project-picker";
import { EngineSelector } from "@/components/engine-selector";
import { processDocument } from "@/lib/process-document";
import type { AnalysisMode } from "@/lib/ai-providers";

type UploadState = {
  name: string;
  status: "subiendo" | "procesando" | "listo" | "error";
  documentId?: string;
  detail?: string;
};

const ACCEPT = ".pdf,.docx,.xlsx,.txt,.ppt,.pptx,.zip";

/** Pantalla de subida drag & drop. Tras subir, el navegador va avanzando
 *  el análisis de la IA etapa por etapa, mostrando el progreso real. */
export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("auto");

  const patch = useCallback((name: string, changes: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.name === name ? { ...u, ...changes } : u)));
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        setUploads((prev) => [...prev, { name: file.name, status: "subiendo" }]);
        try {
          const formData = new FormData();
          formData.append("file", file);
          if (projectId) formData.append("projectId", projectId);

          const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? "Error al subir");

          patch(file.name, {
            status: "procesando",
            documentId: json.documentId,
            detail: "iniciando análisis…",
          });

          const result = await processDocument(
            json.documentId,
            (label) => patch(file.name, { detail: label }),
            { mode }
          );

          patch(file.name, {
            status: result.ok ? "listo" : "error",
            detail: result.ok ? "análisis completo" : result.error,
          });
        } catch (err) {
          patch(file.name, {
            status: "error",
            detail: err instanceof Error ? err.message : "Error inesperado",
          });
        }
      }
      router.refresh();
    },
    [projectId, patch, router, mode]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subir documentos</h1>
        <p className="text-sm text-muted-foreground">
          PDF, DOCX, XLSX, TXT, PPT o ZIP. La IA extraerá el texto (con OCR si es escaneado),
          clasificará el documento y generará el resumen ejecutivo, las variables técnicas,
          los requerimientos y la línea de tiempo.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Archivar en carpeta</p>
        <p className="text-xs text-muted-foreground">
          Agrupa el documento en la carpeta del cliente/proyecto para llevar todo lo
          relacionado en un solo lugar. Puedes crear la carpeta aquí mismo.
        </p>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Motor de análisis</p>
        <EngineSelector value={mode} onChange={setMode} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-14 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
        onClick={() => document.getElementById("file-input")?.click()}
        role="button"
        aria-label="Zona de arrastre para subir archivos"
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Arrastra tus archivos aquí</p>
        <p className="text-sm text-muted-foreground">o haz clic para seleccionarlos (máx. 50 MB c/u)</p>
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {(u.status === "subiendo" || u.status === "procesando") && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {u.status === "listo" && <FileCheck2 className="h-4 w-4 shrink-0 text-green-500" />}
                {u.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{u.name}</p>
                  {u.detail && (
                    <p className={cn("truncate text-xs", u.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                      {u.detail}
                    </p>
                  )}
                </div>
                {u.documentId && (
                  <Button variant="outline" size="sm" onClick={() => router.push(`/documents/${u.documentId}`)}>
                    Ver
                  </Button>
                )}
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Mantén esta pestaña abierta hasta que el análisis termine. Si se interrumpe,
              puedes retomarlo desde la ficha del documento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
