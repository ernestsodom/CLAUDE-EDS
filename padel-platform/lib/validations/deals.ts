import { z } from 'zod';

/**
 * Esquemas del modulo Negocios (trader).
 *
 * Cada regla tiene su equivalente como constraint en PostgreSQL (§84).
 * En particular la regla de las fechas: aqui da un mensaje util en el
 * formulario, pero quien la garantiza es `deals_dates_ck`.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida').optional();

export const DEAL_STATUSES = [
  'POTENCIAL', 'EN_NEGOCIACION', 'CERRADA', 'ENTREGADA', 'PERDIDA',
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

/** Estados en los que la venta ya esta cerrada y por tanto hay fechas. */
export const CLOSED_STATUSES: readonly DealStatus[] = ['CERRADA', 'ENTREGADA'];

export const isClosedStatus = (status: string): boolean =>
  CLOSED_STATUSES.includes(status as DealStatus);

export const LOGO_BRANDS = ['ATILA', 'CLUB'] as const;
export type LogoBrand = (typeof LOGO_BRANDS)[number];

export const LOGO_BRAND_LABEL: Record<LogoBrand, string> = {
  ATILA: 'Logo Atila',
  CLUB: 'Logo del club',
};

export const DealSchema = z
  .object({
    client_name: z.string().trim().min(2, 'El nombre del club o cliente es obligatorio').max(200),
    contact_name: optionalText(150),
    contact_email: z.string().trim().email('Email invalido').max(200).optional(),
    contact_phone: optionalText(50),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, 'Usa el codigo ISO de 2 letras (AR, ES, CL...)')
      .optional(),
    city: optionalText(100),
    status: z.enum(DEAL_STATUSES).default('POTENCIAL'),
    commission_per_court_usd: z.coerce
      .number({ invalid_type_error: 'La comision debe ser un numero' })
      .min(0, 'La comision no puede ser negativa')
      .default(1700),
    opened_at: isoDate,
    expected_close_date: isoDate,
    closed_at: isoDate,
    delivery_date: isoDate,
    lost_reason: optionalText(500),
    notes: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    const closed = isClosedStatus(data.status);

    // La regla que pidio el negocio: sin venta cerrada, no hay fechas.
    if (!closed && data.delivery_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_date'],
        message: 'Solo se indica fecha de entrega cuando la venta esta cerrada.',
      });
    }
    if (!closed && data.closed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['closed_at'],
        message: 'La fecha de cierre solo aplica a una venta cerrada.',
      });
    }
    if (closed && !data.closed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['closed_at'],
        message: 'Indica la fecha en que se cerro la venta.',
      });
    }
    if (data.closed_at && data.delivery_date && data.delivery_date < data.closed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_date'],
        message: 'La entrega no puede ser anterior al cierre.',
      });
    }
  });

export const DealCourtSchema = z.object({
  deal_id: z.string().uuid(),
  court_model_id: z.string().uuid('Selecciona un tipo de cancha'),
  turf_color_id: z.string().uuid('Selecciona un color de cesped valido').optional(),
  light_post_color_id: z.string().uuid('Selecciona un color de postes valido').optional(),
  position: z.coerce.number().int().min(1).default(1),
  is_custom: z.boolean().default(false),
  commission_usd: z.coerce
    .number({ invalid_type_error: 'La comision debe ser un numero' })
    .min(0, 'La comision no puede ser negativa'),
  specs: optionalText(1000),
});

export type CatalogTable =
  | 'court_models'
  | 'logo_positions'
  | 'turf_colors'
  | 'light_post_colors';

/** Geometrias que sabe dibujar el visualizador 3D de muestra. */
export const PREVIEW_COURT_TYPES = ['panoramica', 'semi', 'normal'] as const;

export const CourtModelSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,32}$/, 'Usa mayusculas, numeros y guion bajo (ej. ATILA_PRO)'),
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  description: optionalText(300),
  default_commission_usd: z.coerce
    .number({ invalid_type_error: 'La comision debe ser un numero' })
    .min(0, 'La comision no puede ser negativa')
    .default(1700),
  preview_court_type: z.enum(PREVIEW_COURT_TYPES).default('panoramica'),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.boolean().default(true),
});

/** Catalogos editables del modulo Negocios. */
export const ColorOptionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,32}$/, 'Usa mayusculas, numeros y guion bajo (ej. GRIS_OSCURO)'),
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Usa un color en formato #RRGGBB')
    .optional(),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.boolean().default(true),
});

export const LogoPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,32}$/, 'Usa mayusculas, numeros y guion bajo (ej. POSTES_LUZ)'),
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.boolean().default(true),
});
