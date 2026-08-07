import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

/** GET /api/notes/attachments/:id — URL firmada (1 h) del adjunto de un comentario. */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    // RLS solo deja leer adjuntos de comentarios sobre documentos autorizados.
    const { data: attachment } = await supabase
      .from("note_attachments")
      .select("storage_path, file_name, mime_type")
      .eq("id", id)
      .maybeSingle();
    if (!attachment) throw new NotFoundError("Adjunto no encontrado");

    const { data: signed, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(attachment.storage_path, 3600);
    if (error || !signed) throw new NotFoundError("No fue posible firmar la URL");

    return NextResponse.json({
      url: signed.signedUrl,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
    });
  }
);
