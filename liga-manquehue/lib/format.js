// Las columnas DATE llegan como Date (medianoche UTC) desde el driver; las normalizamos a 'YYYY-MM-DD'.
export function isoDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Fecha de una jornada (columna DATE), p.ej. "sábado, 25 de octubre"
export function fmtDate(d) {
  if (!d) return '';
  return new Date(`${isoDate(d)}T12:00:00Z`).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

// Fecha de publicación (TIMESTAMPTZ)
export function fmtShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
}
