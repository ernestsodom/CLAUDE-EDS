// SEO: títulos y descripciones sugeridos (se usan cuando el campo del back office está vacío) y datos estructurados.

export const BRAND = 'Cultura360';
export const COMPANY = 'Proexsi';
export const SUFFIX = 'Cultura360 · Proexsi';

export const HOME_SEO = {
  title: 'Ticketera y software de venta de entradas | Cultura360 · Proexsi',
  description: 'Cultura360 de Proexsi: software de venta de entradas e inscripciones para teatros, centros culturales y municipios. Venta online y en caja, y check in con QR.',
};

// Sugerencias por producto (según la dirección de cada uno). Los productos nuevos usan una sugerencia genérica.
export const CATEGORY_SEO = {
  teatro: {
    h1: 'Software de venta de entradas para teatros',
    title: 'Software de venta de entradas para teatros con butacas numeradas',
    description: 'Vende entradas para tu teatro con mapa de sala y butacas numeradas, online y en boletería con el mismo stock. Temporadas, cortesías y control de acceso con QR.',
  },
  'cursos-y-talleres': {
    h1: 'Sistema de inscripciones para cursos y talleres',
    title: 'Sistema de inscripciones online para cursos y talleres',
    description: 'Inscripciones online y presenciales para cursos y talleres: cupos, lista de espera, matrículas, cuotas y control de asistencia desde el celular.',
  },
  ferias: {
    h1: 'Venta de entradas y control de aforo para ferias',
    title: 'Venta de entradas y control de aforo para ferias y eventos masivos',
    description: 'Vende entradas por día y bloque horario, controla el aforo y valida accesos masivos con QR en ferias y eventos al aire libre.',
  },
  'tercera-edad': {
    h1: 'Inscripciones para actividades del adulto mayor',
    title: 'Inscripciones para actividades y talleres del adulto mayor',
    description: 'Inscripción asistida en caja, precios preferentes por RUT, recordatorios y control de asistencia para actividades y talleres del adulto mayor.',
  },
  infantil: {
    h1: 'Venta de entradas para actividades infantiles y familiares',
    title: 'Venta de entradas para actividades infantiles, familiares y escolares',
    description: 'Pase familiar, datos del apoderado, cupos por edad y reservas de colegios para funciones y talleres infantiles, con check in de grupos.',
  },
  orquesta: {
    h1: 'Venta de entradas para orquestas y salas de música',
    title: 'Venta de entradas para orquestas, conciertos y salas de música',
    description: 'Temporadas de conciertos, venta por programa, precios por zona y funciones en varias salas o giras, con informes por concierto.',
  },
  seminarios: {
    h1: 'Inscripción y acreditación con QR para seminarios',
    title: 'Inscripción y acreditación con QR para seminarios y conferencias',
    description: 'Inscripción online, credencial con QR, control de acceso por charla y certificados de asistencia para seminarios y conferencias.',
  },
};

const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s || '');
const withSuffix = (t, suffix = SUFFIX) => (t && t.includes('Cultura360') ? t : `${t} | ${suffix}`);

// Los textos originales del sitio se reemplazan por los optimizados; si los cambias en el back office, se respetan los tuyos
const OLD_TITLE = 'Proexsi | Plataforma de venta y gestión para corporaciones culturales';
const OLD_DESC = 'La mejor plataforma para gestionar todas las actividades de tu corporación cultural: venta online y presencial, inscripciones, check in con QR e informes en línea.';
export function homeSeo(site) {
  return {
    title: site.title && site.title !== OLD_TITLE ? withSuffix(site.title) : HOME_SEO.title,
    description: clip(site.description && site.description !== OLD_DESC ? site.description : HOME_SEO.description, 165),
  };
}

export function categorySeo(c) {
  const s = CATEGORY_SEO[c.slug] || {};
  return {
    h1: c.h1 || s.h1 || c.name,
    title: withSuffix(c.seoTitle || s.title || `${c.name}: venta de entradas e inscripciones`, BRAND),
    description: clip(c.seoDescription || s.description || c.lead || c.short, 165),
  };
}

export function pageSeo(p, site) {
  return {
    title: withSuffix(p.seoTitle || p.title),
    description: clip(p.seoDescription || site.description, 165),
  };
}

// Datos estructurados (JSON-LD). Se escapa "<" para que nunca cierre la etiqueta script.
export const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

export function orgLd(content, origin) {
  const s = content.site || {};
  return {
    '@type': 'Organization', '@id': origin + '/#empresa', name: COMPANY, url: origin + '/',
    logo: origin + (s.logo || '/img/logo-proexsi-verde.png'),
    brand: { '@type': 'Brand', name: BRAND },
    email: s.email || undefined, telephone: s.phone || undefined,
    address: { '@type': 'PostalAddress', addressCountry: 'CL' }, areaServed: 'CL',
    description: s.footerText || undefined,
  };
}

export function homeLd(content, origin) {
  const faq = (content.home?.blocks || []).find(b => b.type === 'faq' && !b.hidden);
  const cats = (content.categories || []).filter(c => !c.hidden);
  const graph = [
    orgLd(content, origin),
    { '@type': 'WebSite', '@id': origin + '/#sitio', name: BRAND, alternateName: COMPANY, url: origin + '/', inLanguage: 'es-CL', publisher: { '@id': origin + '/#empresa' } },
    {
      '@type': 'SoftwareApplication', name: BRAND, applicationCategory: 'BusinessApplication', applicationSubCategory: 'Software de venta de entradas',
      operatingSystem: 'Web', url: origin + '/', description: HOME_SEO.description, publisher: { '@id': origin + '/#empresa' },
      featureList: ['Venta de entradas online y en boletería', 'Butacas numeradas y mapa de sala', 'Inscripciones a cursos y talleres', 'Check in con código QR', 'Informes en línea'],
    },
  ];
  if (cats.length) graph.push({ '@type': 'ItemList', name: 'Soluciones', itemListElement: cats.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: categorySeo(c).h1, url: `${origin}/productos/${c.slug}` })) });
  if (faq && (faq.items || []).length) {
    graph.push({ '@type': 'FAQPage', mainEntity: faq.items.filter(i => i.q && i.a).map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) });
  }
  return jsonLd({ '@context': 'https://schema.org', '@graph': graph });
}

export function breadcrumbLd(origin, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: origin + path })),
  };
}

export function categoryLd(content, c, origin) {
  const seo = categorySeo(c);
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbLd(origin, [['Inicio', '/'], ['Productos', '/#productos'], [c.name, `/productos/${c.slug}`]]),
      {
        '@type': 'Service', name: seo.h1, serviceType: seo.h1, description: seo.description, url: `${origin}/productos/${c.slug}`,
        provider: orgLd(content, origin), areaServed: 'CL', brand: { '@type': 'Brand', name: BRAND },
      },
    ],
  });
}

export function pageLd(content, p, origin) {
  return jsonLd({ '@context': 'https://schema.org', '@graph': [breadcrumbLd(origin, [['Inicio', '/'], [p.title, `/${p.slug}`]]), orgLd(content, origin)] });
}
