// Biblioteca de íconos (trazo). Cada uno: [nombre visible, contenido SVG, viewBox opcional]
export const ICONS = {
  cursos: ['Cerámica / cursos', '<path d="M9 3h6M10 3v4c-3 1-5 4-5 8 0 3 3 6 7 6s7-3 7-6c0-4-2-7-5-8V3"/><path d="M6 14h12"/>'],
  ferias: ['Feria / toldo', '<path d="M3 10l9-6 9 6M4 10h16M4 10c0 2 1.5 3 3 3s3-1 3-3c0 2 1 3 2 3s2-1 2-3c0 2 1.5 3 3 3s3-1 3-3M6 13v8M18 13v8M9 21v-5h6v5"/>'],
  mayores: ['Personas', '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><path d="M3 21v-5c0-2.5 2-4 5-4s5 1.5 5 4v5M11 21v-5c0-2.5 2-4 5-4s5 1.5 5 4v5"/>'],
  teatro: ['Teatro / máscaras', '<path d="M3 4h9v6c0 4-2 7-4.5 7S3 14 3 10z"/><path d="M5.5 8h1M8.5 8h1M5.5 12c1 1 2.5 1 3.5 0"/><path d="M12 8h9v6c0 4-2 7-4.5 7-1.6 0-3-1-3.8-3"/><path d="M15 12h1M18 12h1M15.5 16c.7-.7 2.3-.7 3 0"/>'],
  infantil: ['Globos / infantil', '<ellipse cx="10" cy="8" rx="5" ry="6"/><path d="M10 14l-1 2h2zM10 16c0 3 2 4 2 6"/><ellipse cx="17.5" cy="10" rx="3.5" ry="4.5"/><path d="M17.5 14.5c0 2-1.5 3.5-1.5 6.5"/>'],
  orquesta: ['Nota musical', '<path d="M9 18a3 3 0 1 1-2-2.8V4l12-2v12a3 3 0 1 1-2-2.8V6L9 7.3"/>'],
  seminarios: ['Micrófono', '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>'],
  sliders: ['Ajustes', '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'],
  userplus: ['Inscripción', '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'],
  qr: ['Código QR', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 18v3"/>'],
  chart: ['Gráfico', '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>'],
  monitor: ['Computador', '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 13v-3M10 13V7M14 13v-5M18 13v-2"/>'],
  pos: ['Caja / POS', '<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="5" rx="1"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01"/>'],
  globe: ['Internet', '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'],
  shield: ['Escudo / seguro', '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'],
  ticket: ['Entrada', '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z"/><path d="M14 6v2M14 11v2M14 16v2"/>'],
  heart: ['Corazón', '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/>'],
  family: ['Familia', '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21c0-4 2.5-7 6-7s6 3 6 7M14 15c3-.5 7 1 7 6"/>'],
  calendar: ['Calendario', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>'],
  clock: ['Reloj', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  card: ['Tarjeta de pago', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'],
  cart: ['Carro de compra', '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>'],
  star: ['Estrella', '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'],
  users: ['Grupo', '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.4.7 4 2.8 4 6.2"/>'],
  building: ['Edificio', '<path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>'],
  book: ['Libro', '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-7"/>'],
  palette: ['Paleta de arte', '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'],
  camera: ['Cámara', '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'],
  film: ['Cine', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'],
  dance: ['Danza', '<circle cx="13" cy="4" r="2"/><path d="M8 21l3-6 3 2 1 4M11 15l1-5 4 2 3-2M12 10L8 8l-3 3"/>'],
  leaf: ['Hoja', '<path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16z"/><path d="M5 21l8-8"/>'],
  pin: ['Ubicación', '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'],
  mail: ['Correo', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  phone: ['Teléfono', '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>'],
  check: ['Visto bueno', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'],
  sparkles: ['Destellos', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'],
  gift: ['Regalo', '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>'],
  smile: ['Sonrisa', '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.4 2 4 2s3-.5 4-2M9 9.5h.01M15 9.5h.01"/>'],
  lock: ['Candado', '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'],
  bolt: ['Rapidez', '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
};

export function iconSvg(name, size) {
  const i = ICONS[name];
  if (!i) return '';
  return `<svg viewBox="${i[2] || '0 0 24 24'}"${size ? ` width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i[1]}</svg>`;
}
