import type { CurrencyCode } from '@/types/database.types';

/**
 * Formateo de presentacion (§85).
 *
 * El valor SIEMPRE viaja y se almacena como number. Estas funciones solo
 * generan la cadena que ve el usuario. Nunca se guarda "€48.000" como texto.
 */

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  EUR: 'es-ES',
  USD: 'en-US',
  ARS: 'es-AR',
  CLP: 'es-CL',
};

const DECIMALS_BY_CURRENCY: Record<CurrencyCode, number> = {
  EUR: 2,
  USD: 2,
  ARS: 2,
  CLP: 0, // el peso chileno no usa decimales
};

export function formatMoney(
  value: number | null | undefined,
  currency: CurrencyCode = 'EUR',
  options: { compact?: boolean; showSymbol?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  const { compact = false, showSymbol = true } = options;
  const locale = LOCALE_BY_CURRENCY[currency] ?? 'es-ES';
  const decimals = DECIMALS_BY_CURRENCY[currency] ?? 2;

  if (compact && Math.abs(value) >= 1000) {
    const formatted = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return showSymbol ? `${currencySymbol(currency)}${formatted}` : formatted;
  }

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function currencySymbol(currency: CurrencyCode): string {
  return { EUR: '€', USD: '$', ARS: '$', CLP: '$' }[currency] ?? '';
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Porcentaje. NULL significa "no calculable", y se muestra como tal. */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

export function formatDate(
  value: string | Date | null | undefined,
  style: 'short' | 'long' | 'datetime' = 'short',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  if (style === 'long') {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
  if (style === 'datetime') {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** "hace 3 dias", "en 2 semanas". Para timelines y agendas. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / 3_600_000);
    if (Math.abs(diffHours) < 1) return rtf.format(Math.round(diffMs / 60_000), 'minute');
    return rtf.format(diffHours, 'hour');
  }
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), 'month');
  return rtf.format(Math.round(diffDays / 365), 'year');
}

/** Convierte un enum de la BD en texto legible: EN_TRANSITO -> En transito */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Parseo de importes escritos por el usuario: "48.000,50" -> 48000.5 */
export function parseMoneyInput(input: string): number | null {
  if (!input) return null;
  const cleaned = input
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}
