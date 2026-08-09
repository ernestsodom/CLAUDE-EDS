import { z } from 'zod';

/**
 * Esquemas Zod espejo de los constraints SQL (§84).
 *
 * Validar aqui da mensajes utiles al usuario; la garantia real la sigue
 * dando PostgreSQL. Si ambos discrepan, manda la base de datos.
 */

export const CLIENT_STATUSES = [
  'PROSPECTO', 'CONTACTADO', 'CALIFICADO', 'ACTIVO', 'INACTIVO', 'PERDIDO',
] as const;

export const LEAD_SOURCES = [
  'REFERIDO', 'WEB', 'FERIA', 'REDES_SOCIALES', 'LLAMADA_FRIA',
  'CAMPANA', 'PARTNER', 'OTRO',
] as const;

export const ClientCreateSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, 'El nombre de la empresa es obligatorio')
    .max(200, 'Nombre demasiado largo'),
  tax_id: z.string().trim().max(50).optional(),
  country: z.string().trim().length(2, 'Usa el codigo ISO de 2 letras (ES, FR, IT...)').optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[\w.-]+\.\w{2,}/.test(v), 'Dominio no valido'),
  status: z.enum(CLIENT_STATUSES).default('PROSPECTO'),
  source: z.enum(LEAD_SOURCES).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type ClientCreateInput = z.infer<typeof ClientCreateSchema>;

export const FollowUpCompleteSchema = z.object({
  projectCode: z.string().min(1),
  followUpId: z.string().uuid(),
  result: z.string().trim().max(1000).optional(),
});

/** Importe monetario: numero, nunca texto con simbolo (§85). */
export const MoneySchema = z
  .number({ invalid_type_error: 'Introduce un importe valido' })
  .min(0, 'El importe no puede ser negativo')
  .max(999_999_999.99, 'Importe fuera de rango');

export const OpportunityCreateSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  name: z.string().trim().min(3, 'Describe la oportunidad').max(200),
  estimated_courts: z.coerce.number().int().min(0).default(0),
  estimated_amount: z.coerce.number().min(0).default(0),
  probability: z.coerce.number().int().min(0).max(100).default(10),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  next_action: z.string().trim().max(300).optional(),
  next_action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});
