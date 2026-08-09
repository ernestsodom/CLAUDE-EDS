'use client';

import { useFormStatus } from 'react-dom';
import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/cn';
import { currencySymbol } from '@/lib/format';
import type { ActionResult } from '@/actions/types';
import type { CurrencyCode } from '@/types/database.types';

/**
 * Primitivas de formulario.
 *
 * Todos los formularios de alta y edicion se construyen con estas piezas,
 * de modo que el etiquetado, los mensajes de error y la accesibilidad son
 * identicos en las 20 pantallas. Los campos son no controlados (name +
 * defaultValue): el envio va por FormData a una Server Action, no por
 * estado de React.
 */

// ---------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------
export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 1 ? 'grid-cols-1' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-5 first:border-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-content-muted">{title}</h2>
      {description ? <p className="mt-1 text-2xs text-content-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormActions({
  children,
  cancelHref,
}: {
  children?: ReactNode;
  cancelHref?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
      {cancelHref ? (
        <a href={cancelHref} className="btn-secondary">
          Cancelar
        </a>
      ) : null}
      {children}
    </div>
  );
}

/** Botón de envío que refleja el estado real del formulario. */
export function SubmitButton({
  label = 'Guardar',
  pendingLabel = 'Guardando...',
}: {
  label?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Resultado de la acción: error de negocio o confirmación. */
export function FormFeedback({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;

  if (!state.ok) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical"
      >
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  }

  if (!state.message) return null;
  return (
    <div className="flex items-start gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
      <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
      <span>{state.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------
interface BaseFieldProps {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function FieldShell({
  id,
  label,
  hint,
  required,
  className,
  children,
}: BaseFieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="ml-1 text-accent">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-2xs text-content-muted">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  defaultValue,
  placeholder,
  type = 'text',
  maxLength,
  ...props
}: BaseFieldProps & {
  defaultValue?: string | null;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  maxLength?: number;
}) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <input
        id={id}
        name={props.name}
        type={type}
        required={props.required}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="input"
      />
    </FieldShell>
  );
}

export function TextAreaField({
  defaultValue,
  placeholder,
  rows = 3,
  ...props
}: BaseFieldProps & { defaultValue?: string | null; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <textarea
        id={id}
        name={props.name}
        rows={rows}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="input resize-none"
      />
    </FieldShell>
  );
}

export function SelectField({
  options,
  defaultValue,
  placeholder = 'Selecciona...',
  allowEmpty = true,
  ...props
}: BaseFieldProps & {
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <select
        id={id}
        name={props.name}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        className="input cursor-pointer"
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function DateField({
  defaultValue,
  ...props
}: BaseFieldProps & { defaultValue?: string | null }) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <input
        id={id}
        name={props.name}
        type="date"
        required={props.required}
        defaultValue={defaultValue ? String(defaultValue).slice(0, 10) : ''}
        className="input"
      />
    </FieldShell>
  );
}

export function NumberField({
  defaultValue,
  step = '1',
  min,
  max,
  suffix,
  ...props
}: BaseFieldProps & {
  defaultValue?: number | string | null;
  step?: string;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <div className="relative">
        <input
          id={id}
          name={props.name}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          required={props.required}
          defaultValue={defaultValue ?? ''}
          className={cn('input tabular', suffix && 'pr-10')}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-content-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

/**
 * Importe monetario (§85).
 *
 * El input es numérico y lo que viaja al servidor es un número; el símbolo
 * de moneda es decoración. Nunca se envía "€48.000" como texto.
 */
export function MoneyField({
  defaultValue,
  currency = 'EUR',
  ...props
}: BaseFieldProps & { defaultValue?: number | string | null; currency?: CurrencyCode }) {
  const id = useId();
  const [value, setValue] = useState(
    defaultValue === null || defaultValue === undefined ? '' : String(defaultValue),
  );

  return (
    <FieldShell id={id} {...props}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-content-muted">
          {currencySymbol(currency)}
        </span>
        <input
          id={id}
          name={props.name}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          required={props.required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input tabular pl-7"
          placeholder="0,00"
        />
      </div>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5 py-1">
      <input
        id={id}
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(255,90,0)]"
      />
      <label htmlFor={id} className="text-sm text-content-secondary">
        {label}
        {hint ? <span className="block text-2xs text-content-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Campo oculto para el contexto que la acción necesita. */
export function HiddenField({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
