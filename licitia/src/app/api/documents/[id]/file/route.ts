import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

/** GET /api/documents/:id/file — URL firmada (1 h) del archivo de la versión actual. */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
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

    const { data: signed, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(file.storage_path, 3600);
    if (error || !signed) throw new NotFoundError("No fue posible firmar la URL");

    return NextResponse.json({
      url: signed.signedUrl,
      fileName: file.file_name,
      mimeType: file.mime_type,
    });
  }
);
