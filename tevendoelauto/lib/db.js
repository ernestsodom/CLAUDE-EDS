import { neon } from '@neondatabase/serverless';

let client;
export function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Configuración editable desde el back office (logo, menú, textos, bloques…)
export const DEFAULT_SETTINGS = {
  whatsapp: '56997360901',
  logo_url: '',
  hero_url: '/img/hero-truck.jpg',
  nav: [
    { page: 'inicio', label: 'Inicio', visible: true },
    { page: 'vehiculos', label: 'Vehículos en venta', visible: true },
    { page: 'vende', label: 'Vende tu auto', visible: true },
    { page: 'nosotros', label: 'Nosotros', visible: true },
    { page: 'contacto', label: 'Contacto', visible: true }
  ],
  header_cta: { label: 'WhatsApp', visible: true },
  fab: { label: '¿Hablamos?', visible: true },
  social: { instagram: 'https://instagram.com', facebook: 'https://facebook.com' },
  contacts: {
    phones: [{ number: '56997360901', label: '' }, { number: '56992180841', label: '' }],
    emails: ['agustin@tevendoelauto.cl', 'mario@tevendoelauto.cl'],
    show_hours: false
  },
  theme: { accent: '#FFD21F', dark: '#0D1015', light: '#F4F5F6', text: '#14171C' },
  texts: {},
  blocks: []
};

export async function getSettings() {
  const rows = await sql()`SELECT value FROM settings WHERE key = 'site'`;
  const saved = rows[0]?.value || {};
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export const clip = (v, n = 500) => String(v ?? '').trim().slice(0, n);
