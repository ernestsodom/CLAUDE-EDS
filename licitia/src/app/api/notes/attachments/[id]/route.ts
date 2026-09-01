import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { useBlobStorage, downloadBlob } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/notes/attachments/:id — metadatos + URL para abrir el adjunto.
 * Con `?download=1` sirve el archivo directamente (Vercel Blob) o redirige
 * a una URL firmada de una hora (Supabase Storage).
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    // RLS solo deja leer adjuntos de comentarios sobre documentos autorizados.
    const { data: attachment } = await supabase
      .from("note_attachments")
      .select("storage_path, file_name, mime_type")
      .eq("id", id)
      .maybeSingle();
    if (!attachment) throw new NotFoundError("Adjunto no encontrado");

    if (new URL(request.url).searchParams.get("download") === "1") {
      if (useBlobStorage()) {
        const buffer = await downloadBlob(attachment.storage_path);
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": attachment.mime_type ?? "application/octet-stream",
            "Content-Disposition": `inline; filename="${attachment.file_name}"`,
          },
        });
      }
      const { data: signed, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.storage_path, 3600);
      if (error || !signed) throw new NotFoundError("No fue posible firmar la URL");
      return NextResponse.redirect(signed.signedUrl);
    }

    return NextResponse.json({
      url: `/api/notes/attachments/${id}?download=1`,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
    });
  }
);
