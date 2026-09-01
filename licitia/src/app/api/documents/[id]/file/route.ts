import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { useBlobStorage, downloadBlob } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/documents/:id/file — metadatos + URL para abrir el archivo de la
 * versión actual. Con `?download=1` sirve el archivo directamente (Vercel
 * Blob) o redirige a una URL firmada de una hora (Supabase Storage).
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    const { data: version } = await supabase
      .from("document_versions")
      .select("id, files(storage_path, file_name, mime_type)")
      .eq("document_id", id)
      .eq("is_current", true)
      .single();

    const file = version?.files?.[0];
    if (!file) throw new NotFoundError("Archivo no encontrado");

    if (new URL(request.url).searchParams.get("download") === "1") {
      if (useBlobStorage()) {
        const buffer = await downloadBlob(file.storage_path);
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": file.mime_type ?? "application/octet-stream",
            "Content-Disposition": `inline; filename="${file.file_name}"`,
          },
        });
      }
      const { data: signed, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(file.storage_path, 3600);
      if (error || !signed) throw new NotFoundError("No fue posible firmar la URL");
      return NextResponse.redirect(signed.signedUrl);
    }

    return NextResponse.json({
      url: `/api/documents/${id}/file?download=1`,
      fileName: file.file_name,
      mimeType: file.mime_type,
    });
  }
);
