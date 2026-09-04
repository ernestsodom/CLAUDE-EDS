import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCLP(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

/** "1.2 MB", "340 KB"… — tamaño de archivo legible. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Estimación rápida de tokens (≈4 chars/token para español). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convierte un nombre de archivo en una clave segura para Storage.
 *
 * Supabase Storage rechaza claves con ciertos caracteres (`Invalid key`) —
 * en la práctica, cualquier cosa fuera de letras ASCII, dígitos, punto,
 * guion y guion bajo. Los documentos de licitaciones chilenas vienen casi
 * siempre con tildes, "ñ" o símbolos como "N°", así que sin esta limpieza
 * la subida falla justo en el caso de uso principal del sistema.
 *
 * Las tildes se quitan conservando la letra (NFD + strip de diacríticos:
 * "Técnicas" → "Tecnicas") en vez de reemplazarlas por "_", para que la ruta
 * siga siendo legible. El nombre original se conserva aparte (columna
 * `file_name`, título del documento) — esto solo afecta la ruta física.
 */
export function sanitizeStorageFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && dot < name.length - 1;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : "";

  const safeBase =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[_.-]+|[_.-]+$/g, "")
      .slice(0, 150) || "archivo";
  const safeExt = ext
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9.]+/g, "")
    .slice(0, 10);

  return `${safeBase}${safeExt}`;
}
