import { NextResponse } from "next/server";
import { put, get, del } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * GET /api/internal/blob-selftest — DIAGNÓSTICO TEMPORAL.
 *
 * Sube y baja un archivo de prueba del lado del servidor, sin pasar por el
 * navegador, para aislar si "Archivo no encontrado en Blob Storage" es un
 * problema del token/store en sí (fallaría también acá) o específicamente
 * de la subida directa navegador → Vercel Blob (esto pasaría igual, pero
 * el archivo de prueba SÍ se encontraría después).
 *
 * No requiere sesión (ruta pública a propósito, ver PUBLIC_PATHS en
 * middleware.ts) porque solo así se puede abrir desde el navegador sin
 * complicaciones — no toca datos reales ni expone el valor de ningún
 * token. Borrar esta ruta cuando termine el diagnóstico.
 */
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const hasBlobStoreId = Boolean(process.env.BLOB_STORE_ID);
  const testPath = `__selftest__/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;

  const report: Record<string, unknown> = {
    hasReadWriteToken: Boolean(token),
    tokenLength: token?.length ?? 0,
    hasBlobStoreId,
    testPath,
  };

  try {
    const putResult = await put(testPath, Buffer.from("selftest"), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });
    report.putOk = true;
    report.putPathname = putResult.pathname;
  } catch (error) {
    report.putOk = false;
    report.putError = error instanceof Error ? error.message : String(error);
    return NextResponse.json(report, { status: 500 });
  }

  try {
    const getResult = await get(testPath, { access: "private", token });
    report.getOk = Boolean(getResult);
    if (!getResult) report.getError = "get() devolvió null/undefined";
  } catch (error) {
    report.getOk = false;
    report.getError = error instanceof Error ? error.message : String(error);
  }

  await del(testPath, { token }).catch((error) => {
    report.delError = error instanceof Error ? error.message : String(error);
  });

  return NextResponse.json(report);
}
