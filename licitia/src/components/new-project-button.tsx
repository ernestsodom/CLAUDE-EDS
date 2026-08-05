"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/components/project-picker";

/** Botón "Nueva carpeta" de la vista de carpetas: reutiliza el ProjectPicker
 *  en modo creación y navega a la carpeta recién creada. */
export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <FolderPlus className="h-4 w-4" /> Nueva carpeta
        </Button>
      ) : (
        <ProjectPicker
          value={null}
          onChange={(projectId) => {
            if (projectId) {
              router.push(`/projects/${projectId}`);
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
