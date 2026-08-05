import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDocumentWithFile } from "@/core/repositories/documents.repo";
import { audit } from "@/core/services/audit.service";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "txt", "ppt", "pptx", "zip"]);

/**
 * POST /api/documents/upload  (multipart/form-data, campo "file")
 * Sube el archivo a Storage, crea documento + versión + archivo y dispara
 * el pipeline de procesamiento en background.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ValidationError("Falta el archivo (campo 'file')");

  // Carpeta de proyecto opcional (se valida contra RLS al insertar)
  const projectIdRaw = formData.get("projectId");
  const projectId =
    typeof projectIdRaw === "string" && /^[0-9a-f-]{36}$/i.test(projectIdRaw)
      ? projectIdRaw
      : null;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(`Formato no permitido: .${ext}. Use PDF, DOCX, XLSX, TXT, PPT o ZIP.`);
  }
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ValidationError(`El archivo supera el máximo de ${env().MAX_UPLOAD_MB} MB`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");

  // Crear registros primero para conocer el document_id de la ruta
  const { documentId, versionId } = await createDocumentWithFile(supabase, {
    organizationId: profile.organization_id,
    userId: user.id,
    title: file.name,
    storagePath: "pending",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    checksum,
    projectId,
  });

  const storagePath = `${profile.organization_id}/${documentId}/1/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Error subiendo a Storage: ${uploadError.message}`);

  await supabase.from("files").update({ storage_path: storagePath }).eq("version_id", versionId);

  await audit(profile.organization_id, user.id, "document.upload", "document", documentId, {
    fileName: file.name,
    sizeBytes: file.size,
  });

  // Disparar pipeline en background (fire-and-forget con secreto interno)
  fetch(`${env().NEXT_PUBLIC_APP_URL}/api/internal/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": env().INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      documentId,
      versionId,
      organizationId: profile.organization_id,
      userId: user.id,
    }),
  }).catch(() => {
    // El estado queda en 'subido'; la UI ofrece reintentar el procesamiento.
  });

  return NextResponse.json({ documentId, versionId, status: "procesando" }, { status: 201 });
});
