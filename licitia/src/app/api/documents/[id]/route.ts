import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "@/core/services/audit.service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * DELETE /api/documents/:id — elimina el documento y su archivo.
 *
 * El borrado en cascada de la base se lleva versiones, páginas, fragmentos,
 * análisis, checklist, notas y comparaciones. Los archivos de Storage no
 * cuelgan de esas claves foráneas, así que se borran aquí explícitamente,
 * antes de la fila, para no dejarlos huérfanos.
 *
 * Quién puede: admin, supervisor o quien subió el documento (política
 * documents_delete). Si RLS lo impide, la fila simplemente no se borra y se
 * responde 403 en vez de fingir éxito.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: doc } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado");

    // Rutas de todos los archivos del documento, incluidos los hijos de un ZIP.
    const { data: children } = await supabase
      .from("documents")
      .select("id")
      .eq("parent_document_id", id);
    const documentIds = [id, ...(children ?? []).map((c) => c.id)];

    const { data: versions } = await supabase
      .from("document_versions")
      .select("id")
      .in("document_id", documentIds);
    const versionIds = (versions ?? []).map((v) => v.id);

    let paths: string[] = [];
    if (versionIds.length > 0) {
      const { data: files } = await supabase
        .from("files")
        .select("storage_path")
        .in("version_id", versionIds);
      paths = (files ?? [])
        .map((f) => f.storage_path as string)
        .filter((p) => p && p !== "pending");
    }

    if (paths.length > 0) {
      const { error } = await supabase.storage.from("documents").remove(paths);
      // Un archivo ya inexistente no debe impedir borrar el documento.
      if (error) logger.warn("storage_delete_failed", { documentId: id, error: error.message });
    }

    const { error: deleteError, count } = await supabase
      .from("documents")
      .delete({ count: "exact" })
      .eq("id", id);
    if (deleteError) throw new Error(`Error eliminando el documento: ${deleteError.message}`);
    if (!count) {
      throw new ForbiddenError(
        "No tienes permiso para eliminar este documento. Solo puede hacerlo quien lo subió, un supervisor o un administrador."
      );
    }

    await audit(profile.organization_id, user.id, "document.delete", "document", id, {
      title: doc.title,
    });

    return NextResponse.json({ deleted: true });
  }
);
