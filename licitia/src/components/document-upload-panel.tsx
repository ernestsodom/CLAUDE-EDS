"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/components/project-picker";
import { EngineSelector } from "@/components/engine-selector";
import { processDocument } from "@/lib/process-document";
import { uploadDocument } from "@/lib/upload-document";
import type { AnalysisMode } from "@/lib/ai-providers";

type UploadState = {
  name: string;
  status: "subiendo" | "procesando" | "listo" | "error";
  documentId?: string;
  detail?: string;
};

const ACCEPT = ".pdf,.docx,.xlsx,.txt,.ppt,.pptx,.zip";

/**
 * Panel de subida embebido en Documentos: un único botón que despliega el
 * mismo flujo de arrastrar/soltar que antes vivía en su propia pantalla.
 * No hay dos lugares distintos para subir un documento — este es el único.
 */
export function DocumentUploadPanel({
  defaultProjectId = null,
  lockProject = false,
}: {
  defaultProjectId?: string | null;
  lockProject?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [mode, setMode] = useState<AnalysisMode>("auto");

  const patch = useCallback((name: string, changes: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.name === name ? { ...u, ...changes } : u)));
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        setUploads((prev) => [...prev, { name: file.name, status: "subiendo" }]);
        try {
          const { documentId } = await uploadDocument(file, { projectId });

          patch(file.name, {
            status: "procesando",
            documentId,
            detail: "iniciando carga…",
          });

          const result = await processDocument(
            documentId,
            (label) => patch(file.name, { detail: label }),
            { mode }
          );

          patch(file.name, {
            status: result.ok ? "listo" : "error",
            detail: result.ok ? "cargado — pedí el análisis que necesites desde la ficha" : result.error,
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
    <div className="space-y-3">
      <Button variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <UploadCloud className="h-4 w-4" />
        Subir documentos
      </Button>

      {open && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              PDF, DOCX, XLSX, TXT, PPT o ZIP. La IA extraerá el texto (con OCR si es escaneado) y
              clasificará el documento — nada más. Cada análisis (resumen, sistemas, línea de
              tiempo, evaluación y anexos, puntos críticos, chat) se pide aparte, desde la ficha.
            </p>

            {!lockProject && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Archivar en carpeta</p>
                <ProjectPicker value={projectId} onChange={setProjectId} />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium">Motor de carga</p>
              <EngineSelector value={mode} onChange={setMode} />
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onClick={() => document.getElementById("upload-panel-input")?.click()}
              role="button"
              aria-label="Zona de arrastre para subir archivos"
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Arrastra tus archivos aquí</p>
              <p className="text-sm text-muted-foreground">o haz clic para seleccionarlos (máx. 50 MB c/u)</p>
              <input
                id="upload-panel-input"
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>

            {uploads.length > 0 && (
              <div className="space-y-2">
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
                  Mantén esta pestaña abierta hasta que la carga termine. Si se interrumpe, puedes
                  retomarla desde la ficha del documento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
