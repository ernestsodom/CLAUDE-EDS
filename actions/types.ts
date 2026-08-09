/**
 * Contrato unico de resultado para todas las Server Actions.
 *
 * Nunca se lanza una excepcion cruda hacia la UI: se devuelve un resultado
 * discriminado que el componente sabe representar (§96).
 */
export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export function success<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function failure(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Traduce errores de PostgreSQL/PostgREST a lenguaje de negocio.
 *
 * El usuario final no debe leer "new row violates row-level security
 * policy" ni un codigo SQLSTATE.
 */
export function toUserMessage(raw: string): string {
  const message = raw.toLowerCase();

  if (message.includes('row-level security') || message.includes('permiso denegado')) {
    return 'No tienes permiso para realizar esta accion en este proyecto.';
  }
  if (message.includes('ya esta confirmada')) {
    return 'Esta venta ya estaba confirmada.';
  }
  if (message.includes('no tiene lineas')) {
    return 'La venta no tiene lineas. Anade al menos un concepto antes de confirmarla.';
  }
  if (message.includes('venta anulada')) {
    return 'No se puede confirmar una venta anulada.';
  }
  if (message.includes('aislamiento')) {
    return 'El registro pertenece a otra unidad de negocio.';
  }
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return 'Ya existe un registro con esos datos.';
  }
  if (message.includes('foreign key')) {
    return 'No se puede completar: hay informacion relacionada que lo impide.';
  }
  if (message.includes('check constraint') || message.includes('violates check')) {
    return 'Los datos no cumplen una regla de negocio. Revisa importes y fechas.';
  }
  if (message.includes('no encontrad')) {
    return 'El registro no existe o no tienes acceso a el.';
  }

  return 'No se pudo completar la operacion. Intentalo de nuevo; si persiste, avisa al administrador.';
}
