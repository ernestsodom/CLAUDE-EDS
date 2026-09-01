import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * POST /api/documents/blob-upload-token
 *
 * Contraparte de `upload-init` cuando el almacenamiento es Vercel Blob: esta
 * ruta no crea nada en la base (eso ya lo hizo `upload-init`, que calculó un
 * `storagePath` determinístico antes de que el navegador subiera un solo
 * byte) — solo emite el token de subida de corta duración que
 * `@vercel/blob/client` necesita para subir DIRECTO desde el navegador, sin
 * pasar por esta función de Vercel.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Repite la comprobación de sesión: solo un usuario autenticado
        // puede pedir un token de subida, igual que antes con la sesión de
        // Supabase que usaba el navegador para subir directo al bucket.
        await requireUser();
        return {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: env().MAX_UPLOAD_MB * 1024 * 1024,
        };
      },
      // No hace falta actualizar la base al completarse: `upload-init` ya
      // dejó `files.storage_path` con el mismo pathname determinístico.
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error generando el token de subida" },
      { status: 400 }
    );
  }
}
