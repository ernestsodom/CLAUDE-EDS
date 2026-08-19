import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDocumentWithFile } from "@/core/repositories/documents.repo";
import { audit } from "@/core/services/audit.service";
import { sanitizeStorageFileName } from "@/lib/utils";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "txt", "ppt", "pptx", "zip"]);

const BodySchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive(),
  projectId: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/documents/upload-init  (JSON, sin el binario)
 *
 * Las funciones serverless de Vercel rechazan cualquier request de más de
 * ~4.5 MB de cuerpo — un límite fijo de la plataforma, no configurable, muy
 * por debajo de los 50 MB que la app anuncia (MAX_UPLOAD_MB) y que el bucket
 * de Storage sí acepta. Antes el archivo viajaba dentro del POST a esta API
 * y cualquier PDF grande moría con un 413 que ni siquiera es JSON.
 *
 * Ahora esta ruta solo crea documento + versión + registro de archivo y
 * devuelve la ruta de Storage; el navegador sube el binario DIRECTO a
 * Supabase Storage con su propia sesión (createClient del cliente), sin
 * pasar por ninguna función de Vercel.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const { fileName, mimeType, sizeBytes, projectId } = parsed.data;

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(`Formato no permitido: .${ext}. Use PDF, DOCX, XLSX, TXT, PPT o ZIP.`);
  }
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    throw new ValidationError(`El archivo supera el máximo de ${env().MAX_UPLOAD_MB} MB`);
  }

  const { documentId, versionId } = await createDocumentWithFile(supabase, {
    organizationId: profile.organization_id,
    userId: user.id,
    title: fileName,
    storagePath: "pending",
    fileName,
    mimeType: mimeType || "application/octet-stream",
    sizeBytes,
    // Se calculaba desde el buffer del servidor; ahora el binario nunca pasa
    // por aquí. No se usa en ningún otro lugar del sistema (solo se guardaba
    // como dato informativo), así que se deja vacío en vez de inventar uno.
    checksum: "",
    projectId: projectId ?? null,
  });

  const storagePath = `${profile.organization_id}/${documentId}/1/${sanitizeStorageFileName(fileName)}`;
  await supabase.from("files").update({ storage_path: storagePath }).eq("version_id", versionId);

  await audit(profile.organization_id, user.id, "document.upload", "document", documentId, {
    fileName,
    sizeBytes,
  });

  return NextResponse.json(
    { documentId, versionId, storagePath, bucket: "documents" },
    { status: 201 }
  );
});
