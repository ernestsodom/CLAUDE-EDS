import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/notes/:id/attachments  (multipart/form-data, campo "file")
 * Adjunta un archivo a un comentario. El bucket 'attachments' no restringe el
 * tipo: un comentario puede llevar una captura, un correo exportado o un acta.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: note } = await supabase
      .from("notes")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (!note) throw new NotFoundError("Comentario no encontrado");
    if (note.user_id !== user.id) {
      throw new ValidationError("Solo puedes adjuntar archivos a tus propios comentarios");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError("Falta el archivo (campo 'file')");
    if (file.size > env().MAX_UPLOAD_MB * 1024 * 1024) {
      throw new ValidationError(`El archivo supera el máximo de ${env().MAX_UPLOAD_MB} MB`);
    }

    // El primer segmento debe ser la organización: es lo que valida la política
    // de Storage. El nombre se sanea para no romper la ruta.
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const storagePath = `${profile.organization_id}/comentarios/${id}/${Date.now()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw new Error(`Error subiendo el adjunto: ${uploadError.message}`);

    const { data: attachment, error } = await supabase
      .from("note_attachments")
      .insert({
        note_id: id,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      })
      .select("id, file_name, mime_type, size_bytes")
      .single();
    if (error) {
      // No dejar el binario huérfano si la fila no se pudo crear.
      await supabase.storage.from("attachments").remove([storagePath]);
      throw new Error(`Error registrando el adjunto: ${error.message}`);
    }

    return NextResponse.json(attachment, { status: 201 });
  }
);
