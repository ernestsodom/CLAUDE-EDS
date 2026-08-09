'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Loader2, EyeOff, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { createTaskFromAlert, updateAlertStatus } from '@/actions/operations';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ControlCenterAlert } from '@/types/database.types';

/**
 * Tarjeta de alerta accionable (§114, §116).
 *
 * Cada alerta responde las tres preguntas: que pasa (titulo), por que
 * (mensaje con las cifras) y que hago (enlace a la entidad + convertir en
 * tarea). Una alerta que no se puede accionar es ruido.
 */
const ENTITY_ROUTE: Record<string, string> = {
  SALE: 'ventas',
  COURT: 'operaciones/canchas',
  MANUFACTURING_PROJECT: 'operaciones/fabricacion',
  INVOICE: 'finanzas/facturas',
  CONTRACT: 'finanzas/contratos',
  INSTALLATION: 'operaciones/instalaciones',
  SHIPMENT: 'operaciones/logistica',
  FOLLOW_UP: 'comercial/seguimientos',
  OPPORTUNITY: 'comercial/oportunidades',
  MATERIAL_REQUIREMENT: 'operaciones/materiales',
};

export function AlertCard({
  alert,
  projectCode,
  canCreateTask,
}: {
  alert: ControlCenterAlert;
  projectCode: string;
  canCreateTask: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const route = ENTITY_ROUTE[alert.entity_type];
  const href = route ? `/${projectCode}/${route}/${alert.entity_id}` : null;

  const border =
    alert.priority === 'CRITICA'
      ? 'border-critical/30'
      : alert.priority === 'ALTA'
        ? 'border-warning/30'
        : 'border-line';

  function act(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await fn();
      setFeedback(result.ok ? (result.message ?? 'Hecho') : (result.error ?? 'Error'));
      if (result.ok) router.refresh();
    });
  }

  return (
    <article className={cn('card flex flex-col gap-2 p-4', border)}>
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={alert.priority} />
        <time className="text-2xs text-content-muted" dateTime={alert.last_detected_at}>
          {formatRelative(alert.last_detected_at)}
        </time>
      </div>

      <h3 className="text-sm font-medium leading-snug">{alert.title}</h3>
      {alert.message ? (
        <p className="text-2xs leading-relaxed text-content-secondary">{alert.message}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {href ? (
          <Link href={href} className="btn-ghost px-2 py-1 text-2xs">
            Ver detalle
            <ArrowUpRight size={12} />
          </Link>
        ) : null}

        {canCreateTask && alert.tasks_count === 0 ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              act(() => createTaskFromAlert({ projectCode, alertId: alert.id, dueDate: '' }))
            }
            className="btn-ghost px-2 py-1 text-2xs"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
            Crear tarea
          </button>
        ) : null}

        {alert.tasks_count > 0 ? (
          <span className="badge bg-elevated text-content-secondary">
            {alert.tasks_count} tarea{alert.tasks_count > 1 ? 's' : ''}
          </span>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            act(() => updateAlertStatus({ projectCode, alertId: alert.id, status: 'DESCARTADA' }))
          }
          className="btn-ghost ml-auto px-2 py-1 text-2xs"
          title="Descartar alerta"
        >
          <EyeOff size={12} />
        </button>
      </div>

      {feedback ? <p className="text-2xs text-content-muted">{feedback}</p> : null}
    </article>
  );
}
