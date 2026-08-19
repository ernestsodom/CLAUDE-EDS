import { createClient } from "@/lib/supabase/client";

export interface UploadedDocument {
  documentId: string;
  versionId: string;
}

/**
 * Sube un documento en dos pasos:
 *  1. POST liviano (JSON) a /api/documents/upload-init: crea el documento,
 *     la versión y el registro de archivo, y devuelve dónde debe ir.
 *  2. El binario se sube DIRECTO desde el navegador a Supabase Storage — sin
 *     pasar por ninguna función serverless de Vercel, que rechaza cualquier
 *     request de más de ~4.5 MB (límite fijo de la plataforma, no
 *     configurable) muy por debajo de los 50 MB que la app permite.
 *
 * Antes el binario viajaba dentro del POST a la API y cualquier documento
 * grande (bases técnicas escaneadas, licitaciones con anexos) moría con un
 * 413 que ni siquiera es JSON — de ahí el error "Unexpected token 'R',
 * 'Request En'... is not valid JSON" que veía el usuario.
 */
export async function uploadDocument(
  file: File,
  opts: { projectId?: string | null } = {}
): Promise<UploadedDocument> {
  const initRes = await fetch("/api/documents/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      projectId: opts.projectId ?? null,
    }),
  });
  const initJson = await parseJsonResponse(initRes);
  if (!initRes.ok) {
    const message = (initJson.error as { message?: string } | undefined)?.message;
    throw new Error(message ?? "Error al iniciar la subida");
  }

  const { documentId, versionId, storagePath, bucket } = initJson as {
    documentId: string;
    versionId: string;
    storagePath: string;
    bucket: string;
  };

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: true });

  if (uploadError) {
    // Sin archivo en Storage el documento no sirve de nada: se borra el
    // registro para no dejar una fila huérfana (mismo criterio que antes,
    // cuando la subida fallaba dentro de la función del servidor).
    await fetch(`/api/documents/${documentId}`, { method: "DELETE" }).catch(() => {});
    throw new Error(`Error subiendo a Storage: ${uploadError.message}`);
  }

  return { documentId, versionId };
}

/**
 * Lee la respuesta como JSON; si el servidor (o el hosting, delante de él)
 * devolvió algo que no es JSON — una página de error, texto plano de un
 * límite de tamaño — da un mensaje legible en vez de reventar con
 * "Unexpected token…" al intentar parsearlo igual.
 */
async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.status === 413
        ? "El archivo es demasiado grande para esta operación."
        : `Respuesta inesperada del servidor (${res.status}): ${text.slice(0, 140)}`
    );
  }
}
