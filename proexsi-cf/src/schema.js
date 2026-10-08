// Estructura editable del sitio. El back office arma sus formularios a partir de este archivo.

export const COLOR_TOKENS = [
  ['cream', 'Fondo general'],
  ['paper', 'Fondo de tarjetas'],
  ['sand', 'Fondo de secciones alternas'],
  ['sage', 'Círculos de íconos'],
  ['green-900', 'Títulos y pie de página'],
  ['green-800', 'Fondo de secciones oscuras'],
  ['green', 'Color principal'],
  ['green-600', 'Color principal oscuro (íconos)'],
  ['logo', 'Color del logo'],
  ['orange', 'Acento (botones y detalles)'],
  ['orange-600', 'Acento al pasar el mouse'],
  ['ink', 'Texto'],
  ['muted', 'Texto secundario'],
  ['line', 'Bordes'],
  ['shade', 'Velo sobre fotos'],
];

const K = COLOR_TOKENS.map(t => t[0]);
const pal = (id, name, v) => ({ id, name, colors: Object.fromEntries(K.map((k, i) => [k, v[i]])) });
export const PALETTES = [
  pal('bosque', 'Bosque y Naranjo', ['#F7F3EA', '#FFFDF8', '#EFE9DC', '#E7EBDD', '#22362A', '#2E4634', '#5B7553', '#4A6444', '#3F5E3F', '#D2692E', '#B9571F', '#2A2F28', '#5F6659', '#E4DCCB', '#1C1E21']),
  pal('azul', 'Azul Proexsi', ['#F3F5F8', '#FFFFFF', '#E8EDF3', '#E1E8F2', '#14233A', '#1C3150', '#2B5C9E', '#234C85', '#1F4F91', '#E07B24', '#C4661A', '#1E2530', '#5A6474', '#DCE3EC', '#1B1F26']),
  pal('petroleo', 'Petróleo y Coral', ['#F1F5F4', '#FCFEFD', '#E3ECEA', '#D9E8E5', '#103A3E', '#134649', '#2A6F6B', '#215C59', '#1D5C5A', '#E2614A', '#C74E39', '#1C2B2C', '#566867', '#D6E2E0', '#161C1D']),
  pal('terracota', 'Carbón y Terracota', ['#F6F2EE', '#FFFCF9', '#EDE5DD', '#F1E1D6', '#2A2826', '#33302D', '#3E3A36', '#2A2826', '#2F2C29', '#C0532C', '#A44322', '#2A2826', '#6B645D', '#E6DCD2', '#1F1D1C']),
  pal('ciruela', 'Ciruela y Mostaza', ['#F7F2F1', '#FFFCFB', '#EFE5E3', '#EDDFEA', '#35203A', '#3D2544', '#6A3D6A', '#58325A', '#5A2F5C', '#C98612', '#A96E0B', '#2D2230', '#6B5E6D', '#E8DCDA', '#1E1B20']),
  pal('vino', 'Vino y Dorado', ['#F8F4EF', '#FFFDF9', '#F0E8DE', '#F2E2E0', '#3A1B22', '#4A2129', '#7A2E3B', '#64252F', '#6E2734', '#C08A2E', '#A07022', '#2E2224', '#6E5F5F', '#E8DDD2', '#1F1A1B']),
  pal('oceano', 'Océano y Arena', ['#F4F7F9', '#FFFFFF', '#E6EEF2', '#DCEAF0', '#0F2E3D', '#123A4C', '#1F6F8B', '#195C74', '#175A72', '#E9A23B', '#C9862A', '#1B2A31', '#56666E', '#D7E3E9', '#151C20']),
];

// Tipos de campo: text, textarea, rich, image, icon, color, select, number, bool, list, strings
const T = (k, label, extra = {}) => ({ k, label, type: 'text', ...extra });
const TA = (k, label, extra = {}) => ({ k, label, type: 'textarea', ...extra });
const IMG = (k, label = 'Imagen', extra = {}) => ({ k, label, type: 'image', ...extra });
const POS = (k = 'pos', label = 'Encuadre de la foto (horizontal vertical)') => ({ k, label, type: 'position' });
const VEIL = { k: 'veil', label: 'Intensidad del velo gris (%)', type: 'number', min: 0, max: 100, step: 5 };
const BG = { k: 'bg', label: 'Fondo de la sección', type: 'select', options: [['', 'Normal'], ['sand', 'Alterno'], ['paper', 'Claro'], ['dark', 'Oscuro']] };
const ITEMS = (k, label, fields, add = 'Agregar') => ({ k, label, type: 'list', fields, add });
const ICONITEM = [{ k: 'icon', label: 'Ícono', type: 'icon' }, T('title', 'Título'), TA('text', 'Texto')];

export const BLOCKS = {
  hero: {
    name: 'Portada con foto', desc: 'Foto a todo ancho con título, botones y datos destacados.',
    fields: [T('kicker', 'Etiqueta superior'), T('title', 'Título'), T('titleAccent', 'Final del título en color de acento'), TA('lead', 'Bajada'),
      IMG('image', 'Foto de fondo'), T('alt', 'Descripción de la foto (accesibilidad)'), POS(), POS('posMobile', 'Encuadre en celular'), VEIL,
      T('cta1Label', 'Botón principal'), T('cta1Href', 'Enlace del botón principal'), T('cta2Label', 'Botón secundario'), T('cta2Href', 'Enlace del botón secundario'),
      ITEMS('facts', 'Datos destacados', [T('title', 'Dato'), T('text', 'Detalle')], 'Agregar dato')],
  },
  pageHero: {
    name: 'Encabezado de página', desc: 'Foto a todo ancho con el título de la página dentro.',
    fields: [T('eyebrow', 'Etiqueta superior'), { k: 'icon', label: 'Ícono (opcional)', type: 'icon' }, T('title', 'Título'), TA('lead', 'Bajada'),
      IMG('image', 'Foto de fondo'), T('alt', 'Descripción de la foto'), POS(), VEIL,
      T('cta1Label', 'Botón principal'), T('cta1Href', 'Enlace del botón principal'), T('cta2Label', 'Botón secundario'), T('cta2Href', 'Enlace del botón secundario')],
  },
  categories: {
    name: 'Grilla de productos', desc: 'Muestra las categorías de productos como tarjetas con foto.',
    fields: [T('eyebrow', 'Etiqueta superior'), T('title', 'Título (opcional)'), TA('lead', 'Bajada (opcional)'),
      { k: 'columns', label: 'Columnas', type: 'select', options: [['4', '4 columnas'], ['3', '3 columnas']] }, T('moreLabel', 'Texto del enlace'), BG],
  },
  trust: {
    name: 'Franja de confianza', desc: 'Fila de íconos con mensajes cortos.',
    fields: [ITEMS('items', 'Elementos', ICONITEM, 'Agregar elemento')],
  },
  benefits: {
    name: 'Beneficios con foto', desc: 'Franja de color con una foto recortada y tarjetas debajo.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), IMG('image', 'Foto (ideal PNG o WebP sin fondo)'), T('alt', 'Descripción de la foto'),
      ITEMS('items', 'Tarjetas', ICONITEM, 'Agregar tarjeta')],
  },
  flow: {
    name: 'Flujograma', desc: 'Origen → canales → destino, con línea punteada.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), TA('lead', 'Bajada'),
      { k: 'startIcon', label: 'Ícono del origen', type: 'icon' }, T('startTitle', 'Origen: título'), T('startText', 'Origen: texto'),
      ITEMS('channels', 'Canales del medio', [{ k: 'icon', label: 'Ícono', type: 'icon' }, T('title', 'Título'), T('text', 'Texto')], 'Agregar canal'),
      { k: 'endIcon', label: 'Ícono del destino', type: 'icon' }, T('endTitle', 'Destino: título'), T('endText', 'Destino: texto'),
      { k: 'checks', label: 'Lista con vistos buenos', type: 'strings', add: 'Agregar línea' }],
  },
  cards: {
    name: 'Tarjetas', desc: 'Grilla de tarjetas con ícono o número.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), TA('lead', 'Bajada'),
      { k: 'style', label: 'Estilo', type: 'select', options: [['icon', 'Con ícono'], ['number', 'Numeradas'], ['line', 'Línea superior, sin caja']] },
      { k: 'columns', label: 'Columnas', type: 'select', options: [['4', '4 columnas'], ['3', '3 columnas']] }, BG,
      ITEMS('items', 'Tarjetas', ICONITEM, 'Agregar tarjeta')],
  },
  steps: {
    name: 'Pasos', desc: 'Secuencia numerada de pasos.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), BG, { k: 'items', label: 'Pasos', type: 'strings', add: 'Agregar paso' }],
  },
  faq: {
    name: 'Preguntas frecuentes', desc: 'Preguntas desplegables.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), ITEMS('items', 'Preguntas', [T('q', 'Pregunta'), TA('a', 'Respuesta')], 'Agregar pregunta')],
  },
  contact: {
    name: 'Contacto y formulario', desc: 'Datos de contacto y formulario de solicitud de demo.',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), TA('lead', 'Bajada'), { k: 'showForm', label: 'Mostrar formulario', type: 'bool' },
      T('button', 'Texto del botón'), TA('success', 'Mensaje al enviar')],
  },
  text: {
    name: 'Texto', desc: 'Título y texto libre (admite negritas, enlaces y listas).',
    fields: [T('eyebrow', 'Etiqueta superior'), TA('title', 'Título'), { k: 'body', label: 'Texto', type: 'rich' },
      { k: 'align', label: 'Alineación', type: 'select', options: [['left', 'Izquierda'], ['center', 'Centrado']] }, BG],
  },
  stat: {
    name: 'Cifra destacada', desc: 'Un número grande con texto al lado.',
    fields: [T('number', 'Cifra'), { k: 'body', label: 'Texto principal', type: 'rich' }, TA('body2', 'Texto secundario'), BG],
  },
  image: {
    name: 'Imagen', desc: 'Una foto con pie de foto.',
    fields: [IMG('image'), T('alt', 'Descripción de la foto'), T('caption', 'Pie de foto'), { k: 'full', label: 'A todo el ancho de la página', type: 'bool' }, BG],
  },
  chips: {
    name: 'Lista de productos', desc: 'Botones con enlace a cada producto.',
    fields: [T('title', 'Título'), BG],
  },
  cta: {
    name: 'Llamado a la acción', desc: 'Caja de color con un título y un botón.',
    fields: [TA('title', 'Título'), T('button', 'Texto del botón'), T('href', 'Enlace del botón')],
  },
  note: {
    name: 'Nota', desc: 'Recuadro punteado para avisos o contenido pendiente.',
    fields: [TA('text', 'Texto')],
  },
};

export const CATEGORY_FIELDS = [
  T('name', 'Nombre'), T('slug', 'Dirección (ej: teatro → /productos/teatro)'), { k: 'icon', label: 'Ícono', type: 'icon' },
  IMG('image', 'Foto'), T('alt', 'Descripción de la foto'), POS(), VEIL,
  TA('short', 'Texto corto (tarjeta)'), TA('lead', 'Bajada de la página del producto'),
  ITEMS('features', 'Qué puedes hacer', [T('title', 'Título'), TA('text', 'Texto')], 'Agregar función'),
  { k: 'steps', label: 'Así funciona (pasos)', type: 'strings', add: 'Agregar paso' },
  { k: 'hidden', label: 'Ocultar este producto', type: 'bool' },
];

export const CATEGORY_PAGE_FIELDS = [
  T('crumb', 'Texto de la ruta (Productos)'), T('featuresTitle', 'Título de funciones'), T('stepsTitle', 'Título de pasos'), T('othersTitle', 'Título de otros productos'),
  TA('ctaTitle', 'Título del llamado final'), T('cta1Label', 'Botón principal'), T('cta2Label', 'Botón secundario'),
];

export const SITE_FIELDS = [
  T('name', 'Nombre del sitio'), IMG('logo', 'Logo'),
  { k: 'logoMode', label: 'Color del logo', type: 'select', options: [['tint', 'Teñir con el color del logo de la paleta (logos de un color)'], ['original', 'Mostrar el logo con sus colores originales']] },
  T('title', 'Título para Google (inicio)'), TA('description', 'Descripción para Google'),
  T('ctaLabel', 'Botón del menú'), T('ctaHref', 'Enlace del botón del menú'),
  T('email', 'Correo de contacto'), T('phone', 'Teléfono'), T('hours', 'Horario'),
  TA('footerText', 'Texto del pie de página'), T('legal', 'Línea legal'),
  T('footerProductsTitle', 'Pie: título de productos'), T('footerContactTitle', 'Pie: título de contacto'),
  ITEMS('footerLinks', 'Pie: enlaces de contacto', [T('label', 'Texto'), T('href', 'Enlace')], 'Agregar enlace'),
];

export const NAV_FIELDS = [T('label', 'Texto'), T('href', 'Enlace (ej: /nosotros o /#productos)')];

export const PAGE_FIELDS = [
  T('title', 'Nombre de la página'), T('slug', 'Dirección (ej: nosotros → /nosotros)'), TA('seoDescription', 'Descripción para Google'),
  { k: 'hidden', label: 'Ocultar esta página', type: 'bool' },
];
