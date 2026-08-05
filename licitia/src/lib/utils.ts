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

export function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Estimación rápida de tokens (≈4 chars/token para español). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
