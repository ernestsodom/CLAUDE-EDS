import { z } from 'zod';

/**
 * Esquemas del area comercial.
 *
 * Cada regla aqui tiene su equivalente como constraint en PostgreSQL
 * (§84). Zod da el mensaje util en el formulario; la base es la que
 * garantiza que el dato no puede entrar mal por ninguna otra via.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida')
  .optional();

export const CLIENT_STATUSES = [
  'PROSPECTO', 'CONTACTADO', 'CALIFICADO', 'ACTIVO', 'INACTIVO', 'PERDIDO',
] as const;

export const LEAD_SOURCES = [
  'REFERIDO', 'WEB', 'FERIA', 'REDES_SOCIALES', 'LLAMADA_FRIA', 'CAMPANA', 'PARTNER', 'OTRO',
] as const;

export const OPPORTUNITY_STATUSES = [
  'NUEVA', 'CALIFICANDO', 'REUNION', 'COTIZADA', 'NEGOCIACION', 'GANADA', 'PERDIDA', 'ARCHIVADA',
] as const;

export const MEETING_TYPES = ['PRESENCIAL', 'VIDEOLLAMADA', 'TELEFONICA', 'FERIA'] as const;
export const MEETING_STATUSES = [
  'PLANIFICADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA',
] as const;
export const FOLLOW_UP_STATUSES = [
  'PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'VENCIDO', 'CANCELADO',
] as const;
export const PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export const CURRENCIES = ['EUR', 'USD', 'ARS', 'CLP'] as const;

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
export const ClientSchema = z.object({
  company_name: z.string().trim().min(2, 'El nombre de la empresa es obligatorio').max(200),
  legal_name: optionalText(200),
  tax_id: optionalText(50),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, 'Usa el codigo ISO de 2 letras (ES, FR, IT...)')
    .optional(),
  city: optionalText(100),
  address: optionalText(300),
  postal_code: optionalText(20),
  website: optionalText(200),
  industry: optionalText(100),
  status: z.enum(CLIENT_STATUSES).default('PROSPECTO'),
  source: z.enum(LEAD_SOURCES).optional(),
  preferred_currency: z.enum(CURRENCIES).optional(),
  payment_terms: optionalText(200),
  credit_limit: z.coerce.number().min(0, 'El limite de credito no puede ser negativo').optional(),
  notes: optionalText(2000),
});

// ---------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------
export const ContactSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  first_name: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  last_name: optionalText(100),
  position: optionalText(100),
  email: z.string().trim().email('Email no valido').optional().or(z.literal(undefined)),
  phone: optionalText(50),
  whatsapp: optionalText(50),
  is_primary: z.boolean().default(false),
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------
export const OpportunitySchema = z
  .object({
    client_id: z.string().uuid('Selecciona un cliente'),
    contact_id: z.string().uuid().optional(),
    name: z.string().trim().min(3, 'Describe la oportunidad').max(200),
    description: optionalText(2000),
    estimated_courts: z.coerce.number().int().min(0, 'No puede ser negativo').default(0),
    estimated_amount: z.coerce.number().min(0, 'El importe no puede ser negativo').default(0),
    currency: z.enum(CURRENCIES).default('EUR'),
    probability: z.coerce
      .number()
      .int()
      .min(0, 'La probabilidad va de 0 a 100')
      .max(100, 'La probabilidad va de 0 a 100')
      .default(10),
    expected_close_date: isoDate,
    status: z.enum(OPPORTUNITY_STATUSES).default('NUEVA'),
    source: z.enum(LEAD_SOURCES).optional(),
    lost_reason: optionalText(500),
    next_action: optionalText(300),
    next_action_date: isoDate,
    notes: optionalText(2000),
  })
  // Espejo del constraint `opportunities_lost_ck`: una oportunidad perdida
  // debe explicar por que se perdio.
  .refine((v) => v.status !== 'PERDIDA' || Boolean(v.lost_reason), {
    message: 'Indica el motivo de la perdida',
    path: ['lost_reason'],
  });

// ---------------------------------------------------------------------
// Reuniones
// ---------------------------------------------------------------------
export const MeetingSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    opportunity_id: z.string().uuid().optional(),
    meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha es obligatoria'),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida').optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida').optional(),
    location: optionalText(300),
    meeting_type: z.enum(MEETING_TYPES).default('VIDEOLLAMADA'),
    status: z.enum(MEETING_STATUSES).default('PLANIFICADA'),
    objective: optionalText(500),
    summary: optionalText(3000),
    agreements: optionalText(3000),
    next_steps: optionalText(2000),
    next_followup_date: isoDate,
  })
  .refine((v) => !v.start_time || !v.end_time || v.end_time > v.start_time, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['end_time'],
  });

// ---------------------------------------------------------------------
// Seguimientos
// ---------------------------------------------------------------------
export const FollowUpSchema = z.object({
  client_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  title: z.string().trim().min(3, 'El titulo es obligatorio').max(200),
  description: optionalText(2000),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de vencimiento es obligatoria'),
  priority: z.enum(PRIORITIES).default('MEDIA'),
  status: z.enum(FOLLOW_UP_STATUSES).default('PENDIENTE'),
  result: optionalText(1000),
});

export const FollowUpCompleteSchema = z.object({
  projectCode: z.string().min(1),
  followUpId: z.string().uuid(),
  result: optionalText(1000),
});

// ---------------------------------------------------------------------
// Actividad comercial
// ---------------------------------------------------------------------
export const ACTIVITY_TYPES = [
  'LLAMADA', 'EMAIL', 'WHATSAPP', 'REUNION', 'VISITA', 'COTIZACION', 'PROPUESTA', 'NOTA', 'OTRO',
] as const;

export const ActivitySchema = z.object({
  client_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  activity_type: z.enum(ACTIVITY_TYPES).default('NOTA'),
  activity_date: z.string().optional(),
  subject: z.string().trim().min(3, 'El asunto es obligatorio').max(200),
  description: optionalText(3000),
  result: optionalText(1000),
  next_action: optionalText(300),
  next_action_date: isoDate,
});
