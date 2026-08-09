import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';

/**
 * Semantica de color unica para todo el sistema.
 *
 * El color comunica situacion, no decora:
 *   naranja  = en curso / requiere atencion del negocio
 *   verde    = terminado correctamente
 *   rojo     = problema o bloqueo
 *   ambar    = riesgo o pendiente de accion
 *   neutro   = estado inicial o informativo
 */
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'critical' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-elevated text-content-secondary border border-line',
  accent: 'bg-accent/15 text-accent border border-accent/30',
  success: 'bg-success/15 text-success border border-success/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  critical: 'bg-critical/15 text-critical border border-critical/30',
  info: 'bg-info/15 text-info border border-info/30',
};

const STATUS_TONE: Record<string, Tone> = {
  // Ventas
  BORRADOR: 'neutral',
  COTIZACION: 'info',
  COMPROMETIDA: 'warning',
  CONFIRMADA: 'accent',
  EN_PRODUCCION: 'accent',
  PARCIALMENTE_ENTREGADA: 'warning',
  ENTREGADA: 'success',
  CERRADA: 'success',
  ANULADA: 'critical',

  // Canchas — nuevas
  PLANIFICADA: 'neutral',
  MATERIALES_PENDIENTES: 'warning',
  EN_CONSTRUCCION: 'accent',
  CONSTRUCCION_TERMINADA: 'accent',
  GALVANIZADO: 'accent',
  GALVANIZADO_TERMINADO: 'accent',
  EMBALAJE: 'accent',
  EMBALADA: 'accent',
  EN_TRANSITO: 'info',
  EN_INSTALACION: 'accent',
  INSTALACION_TERMINADA: 'success',

  // Canchas — usadas
  DISPONIBLE: 'success',
  RESERVADA: 'warning',
  EN_DESMONTAJE: 'accent',
  DESMONTADA: 'neutral',
  EN_REPARACION: 'accent',
  PREPARADA: 'success',
  EN_TRANSPORTE: 'info',
  VENDIDA: 'success',
  // Nota: 'BAJA' es a la vez estado de cancha (dada de baja) y prioridad.
  // Se define una sola vez, mas abajo, con tono neutro.

  // Fabricacion
  PLANIFICACION: 'neutral',
  MATERIALES: 'warning',
  CONTROL_CALIDAD: 'info',
  LISTO_DESPACHO: 'success',
  DESPACHADO: 'info',
  TERMINADO: 'success',
  CANCELADO: 'critical',

  // CRM
  PROSPECTO: 'neutral',
  CONTACTADO: 'info',
  CALIFICADO: 'warning',
  ACTIVO: 'success',
  INACTIVO: 'neutral',
  PERDIDA: 'critical',
  PERDIDO: 'critical',
  NUEVA: 'neutral',
  CALIFICANDO: 'info',
  REUNION: 'info',
  COTIZADA: 'warning',
  NEGOCIACION: 'accent',
  GANADA: 'success',
  ARCHIVADA: 'neutral',

  // Finanzas
  EMITIDA: 'info',
  ENVIADA: 'info',
  PARCIALMENTE_PAGADA: 'warning',
  PAGADA: 'success',
  VENCIDA: 'critical',
  VIGENTE: 'success',
  FIRMADO: 'success',

  // Logistica
  PLANIFICADO: 'neutral',
  RESERVADO: 'info',
  CARGADO: 'accent',
  EN_ADUANA: 'warning',
  LIBERADO: 'success',
  ENTREGADO: 'success',
  INCIDENCIA: 'critical',

  // Operacion
  PENDIENTE: 'warning',
  EN_CURSO: 'accent',
  COMPLETADO: 'success',
  COMPLETADA: 'success',
  BLOQUEADA: 'critical',
  VENCIDO: 'critical',
  RECEPCIONADA: 'success',
  TERMINADA: 'success',
  APROBADO: 'success',
  RECHAZADO: 'critical',
  CORREGIR: 'warning',

  // Prioridades
  CRITICA: 'critical',
  ALTA: 'warning',
  MEDIA: 'info',
  BAJA: 'neutral',

  // Estado de entrega derivado
  SIN_CANCHAS: 'neutral',
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string | null | undefined;
  tone?: Tone;
  className?: string;
}) {
  if (!status) return <span className="text-content-muted">—</span>;
  const resolved = tone ?? STATUS_TONE[status] ?? 'neutral';

  return (
    <span className={cn('badge', TONE_CLASS[resolved], className)}>
      {humanize(status)}
    </span>
  );
}

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return STATUS_TONE[status] ?? 'neutral';
}
