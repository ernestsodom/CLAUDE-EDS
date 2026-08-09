'use client';

import { useActionState, type ReactNode } from 'react';
import {
  FormActions, FormFeedback, HiddenField, SubmitButton,
} from '@/components/forms';
import type { ActionResult } from '@/actions/types';

type SaveAction = (
  prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) => Promise<ActionResult<{ id: string }> | null>;

/**
 * Envoltorio comun de los formularios de alta y edicion.
 *
 * Centraliza el contexto oculto (proyecto e id), el estado de envio y la
 * presentacion del resultado. Cada formulario concreto solo declara sus
 * campos, asi que anadir una entidad nueva no obliga a repetir el
 * cableado ni a reinventar el manejo de errores.
 */
export function EntityForm({
  action,
  projectCode,
  id,
  cancelHref,
  submitLabel,
  hidden,
  children,
}: {
  action: SaveAction;
  projectCode: string;
  id?: string;
  cancelHref?: string;
  submitLabel?: string;
  /** Valores fijos que la accion necesita (ej. sale_id, invoice_id). */
  hidden?: Record<string, string | undefined>;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-6">
      <HiddenField name="projectCode" value={projectCode} />
      {id ? <HiddenField name="id" value={id} /> : null}
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? <HiddenField key={name} name={name} value={value} /> : null,
      )}

      {children}

      <FormFeedback state={state} />

      <FormActions cancelHref={cancelHref}>
        <SubmitButton label={submitLabel ?? (id ? 'Guardar cambios' : 'Crear')} />
      </FormActions>
    </form>
  );
}
