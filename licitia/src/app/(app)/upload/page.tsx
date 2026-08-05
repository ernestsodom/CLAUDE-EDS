"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/components/project-picker";

type UploadState = { name: string; status: "subiendo" | "procesando" | "error"; documentId?: string; error?: string };

const ACCEPT = ".pdf,.docx,.xlsx,.txt,.ppt,.pptx,.zip";

/** Pantalla de subida drag & drop. Cada archivo dispara el pipeline IA. */
export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setUploads((prev) => [...prev, { name: file.name, status: "subiendo" }]);
      const formData = new FormData();
      formData.append("file", file);
      if (projectId) formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Error al subir");
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name ? { ...u, status: "procesando", documentId: json.documentId } : u
          )
        );
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name
              ? { ...u, status: "error", error: err instanceof Error ? err.message : "Error" }
              : u
          )
        );
      }
    }
  }, [projectId]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subir documentos</h1>
        <p className="text-sm text-muted-foreground">
          PDF, DOCX, XLSX, TXT, PPT o ZIP. La IA extraerá el texto (con OCR si es escaneado),
          clasificará el documento, generará el resumen ejecutivo, variables técnicas,
          requerimientos y línea de tiempo automáticamente.
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
                {u.status === "subiendo" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {u.status === "procesando" && <FileCheck2 className="h-4 w-4 text-green-500" />}
                {u.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                {u.status === "procesando" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/documents/${u.documentId}`)}
                  >
                    Ver documento
                  </Button>
                )}
                {u.status === "error" && <span className="text-xs text-destructive">{u.error}</span>}
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              El procesamiento IA continúa en segundo plano; puedes seguir su avance en la ficha del documento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
