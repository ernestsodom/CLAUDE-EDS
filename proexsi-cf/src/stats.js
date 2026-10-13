// Medición propia del sitio: clasificación de visitas y cálculo del panel de control.

const TZ = 'America/Santiago';

export function isBot(ua) {
  return !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|java\/|facebookexternalhit|whatsapp\/|embedly/i.test(ua);
}

export function parseUA(ua = '') {
  const device = /ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'Tablet'
    : /mobi|iphone|android/i.test(ua) ? 'Celular' : 'Computador';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /samsungbrowser/i.test(ua) ? 'Samsung'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Otro';
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /mac os/i.test(ua) ? 'macOS'
    : /android/i.test(ua) ? 'Android' : /linux/i.test(ua) ? 'Linux' : 'Otro';
  return { device, browser, os };
}

// De dónde llega la visita: campaña, buscador, red social, otro sitio o directo
export function classifySource(referrer, utmSource, ownHost) {
  if (utmSource) return 'Campaña: ' + String(utmSource).slice(0, 40);
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'Directo'; }
  if (!host || host === ownHost || host.endsWith('.workers.dev')) return 'Directo';
  const rules = [
    [/google\./, 'Google'], [/bing\.|duckduckgo|yahoo\.|ecosia|brave\.com/, 'Otros buscadores'],
    [/facebook\.|fb\.|m\.facebook/, 'Facebook'], [/instagram\./, 'Instagram'], [/linkedin\.|lnkd\.in/, 'LinkedIn'],
    [/whatsapp|wa\.me/, 'WhatsApp'], [/t\.co$|twitter\.|x\.com/, 'X (Twitter)'], [/youtube\.|youtu\.be/, 'YouTube'],
    [/tiktok\./, 'TikTok'], [/mail\.|outlook\.|gmail/, 'Correo'], [/chatgpt|openai|perplexity|claude\.ai|gemini/, 'Asistentes de IA'],
  ];
  for (const [re, name] of rules) if (re.test(host)) return name;
  return 'Otro sitio: ' + host;
}

const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

function count(map, key, by = 1) { if (key) map.set(key, (map.get(key) || 0) + by); }
function top(map, n = 8) { return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value })); }
function uniqCount(map, key, visitor) { if (!key || !visitor) return; let s = map.get(key); if (!s) map.set(key, s = new Set()); s.add(visitor); }
function topSets(map, n = 8) { return top(new Map([...map].map(([k, s]) => [k, s.size])), n); }

export function pageName(path, content) {
  if (!path || path === '/') return 'Inicio';
  const m = path.match(/^\/productos\/([^/]+)/);
  if (m) return 'Producto: ' + ((content.categories || []).find(c => c.slug === m[1])?.name || m[1]);
  const slug = path.replace(/^\//, '');
  return (content.pages || []).find(p => p.slug === slug)?.title || path;
}

function sectionName(id, content) {
  const b = (content.home?.blocks || []).find(x => x.id === id);
  if (!b) return null;
  const names = { hero: 'Portada', categories: 'Productos', trust: 'Franja de confianza', benefits: 'Beneficios', flow: 'La Plataforma', cards: 'Tarjetas', faq: 'Preguntas frecuentes', contact: 'Contacto y formulario' };
  return (b.type === 'cards' && b.title ? b.title.slice(0, 40) : names[b.type]) || b.eyebrow || b.title || id;
}

function summarize(events, leads) {
  const visitors = new Set(), sessions = new Set();
  let pageviews = 0;
  for (const e of events) {
    if (e.visitor) visitors.add(e.visitor);
    if (e.session) sessions.add(e.session);
    if (e.type === 'pageview') pageviews++;
  }
  const leadsN = leads.length;
  return { visitors: visitors.size, sessions: sessions.size, pageviews, leads: leadsN, conversion: visitors.size ? leadsN / visitors.size : 0 };
}

export function computeStats({ events, leads, days, content, now = Date.now() }) {
  const start = now - days * 86400000;
  const cur = events.filter(e => new Date(e.ts).getTime() >= start);
  const prev = events.filter(e => new Date(e.ts).getTime() < start);
  const curLeads = leads.filter(l => new Date(l.created_at).getTime() >= start);
  const prevLeads = leads.filter(l => new Date(l.created_at).getTime() < start);
  const k = summarize(cur, curLeads), kp = summarize(prev, prevLeads);
  const online = new Set(events.filter(e => e.visitor && now - new Date(e.ts).getTime() < 5 * 60000).map(e => e.visitor)).size;

  // visitas por día
  const daily = new Map();
  for (let i = days - 1; i >= 0; i--) daily.set(dayKey(now - i * 86400000), { visitors: new Set(), pageviews: 0 });
  for (const e of cur) {
    const d = daily.get(dayKey(e.ts)); if (!d) continue;
    if (e.visitor) d.visitors.add(e.visitor);
    if (e.type === 'pageview') d.pageviews++;
  }

  // sesiones: fuente, lugar, dispositivo y recorrido
  const sess = new Map();
  for (const e of cur) {
    if (!e.session) continue;
    let s = sess.get(e.session);
    if (!s) sess.set(e.session, s = { visitor: e.visitor, start: e.ts, last: e.ts, pages: [], source: null, city: null, region: null, country: null, device: null });
    s.last = e.ts;
    if (!s.source && e.source) s.source = e.source;
    if (!s.city && e.city) { s.city = e.city; s.region = e.region; }
    if (!s.country && e.country) s.country = e.country;
    if (!s.device && e.device) s.device = e.device;
    if (e.type === 'pageview' && s.pages[s.pages.length - 1] !== e.path) s.pages.push(e.path);
  }
  const sources = new Map(), cities = new Map(), countries = new Map(), devices = new Map();
  for (const s of sess.values()) {
    count(sources, s.source || 'Directo');
    uniqCount(cities, s.city ? s.city + (s.country && s.country !== 'CL' ? ` (${s.country})` : '') : 'Sin dato', s.visitor);
    uniqCount(countries, s.country || 'Sin dato', s.visitor);
    uniqCount(devices, s.device || 'Computador', s.visitor);
  }

  // páginas, secciones, clics e interés por producto
  const pages = new Map(), sections = new Map(), clicks = new Map(), interest = new Map();
  const sawProducts = new Set(), sawContact = new Set();
  const productBySlug = new Map((content.categories || []).map(c => [c.slug, c.name]));
  const productByName = new Map((content.categories || []).map(c => [c.name, c.name]));
  for (const e of cur) {
    if (e.type === 'pageview') {
      count(pages, pageName(e.path, content));
      const m = e.path?.match(/^\/productos\/([^/]+)/);
      if (m) { sawProducts.add(e.visitor); uniqCount(interest, productBySlug.get(m[1]) || m[1], e.visitor); }
    } else if (e.type === 'section') {
      const n = sectionName(e.section, content);
      if (n) uniqCount(sections, n, e.visitor);
      if (e.section === 'productos') sawProducts.add(e.visitor);
      if (e.section === 'contacto') sawContact.add(e.visitor);
    } else if (e.type === 'click') {
      count(clicks, e.label);
      if (productByName.has(e.label)) uniqCount(interest, e.label, e.visitor);
      if (/#contacto/.test(e.section || '')) sawContact.add(e.visitor);
    }
  }
  const leadVisitors = new Set(curLeads.map(l => l.data?._meta?.visitor).filter(Boolean));
  for (const v of leadVisitors) sawContact.add(v);

  // solicitudes de demo con el recorrido de esa persona
  const byVisitor = new Map();
  for (const e of events) { if (!e.visitor) continue; let a = byVisitor.get(e.visitor); if (!a) byVisitor.set(e.visitor, a = []); a.push(e); }
  const leadRows = curLeads.slice(0, 50).map(l => {
    const m = l.data?._meta || {};
    const evs = byVisitor.get(m.visitor) || [];
    const prods = [...new Set(evs.filter(e => e.type === 'pageview' && /^\/productos\//.test(e.path || '')).map(e => pageName(e.path, content).replace('Producto: ', '')))];
    const first = evs.find(e => e.source);
    return {
      id: l.id, created_at: l.created_at, nombre: l.data.nombre, institucion: l.data.institucion, cargo: l.data.cargo,
      correo: l.data.correo, telefono: l.data.telefono, producto: l.data.producto,
      city: m.city || evs.find(e => e.city)?.city || null, country: m.country || null, device: m.device || null,
      source: first?.source || m.source || 'Directo',
      visits: new Set(evs.map(e => e.session)).size || 1, pageviews: evs.filter(e => e.type === 'pageview').length, products: prods,
    };
  });

  const recent = [...sess.values()].sort((a, b) => new Date(b.last) - new Date(a.last)).slice(0, 12).map(s => ({
    last: s.last, city: s.city, country: s.country, device: s.device, source: s.source || 'Directo',
    pages: s.pages.map(p => pageName(p, content)), lead: leadVisitors.has(s.visitor),
  }));

  return {
    days, online,
    kpi: { cur: k, prev: kp },
    daily: [...daily.entries()].map(([date, d]) => ({ date, visitors: d.visitors.size, pageviews: d.pageviews })),
    funnel: [
      { label: 'Visitaron el sitio', value: k.visitors },
      { label: 'Vieron productos', value: sawProducts.size },
      { label: 'Llegaron al contacto', value: sawContact.size },
      { label: 'Pidieron una demo', value: Math.max(leadVisitors.size, curLeads.length) },
    ],
    pages: top(pages), sections: topSets(sections, 10), clicks: top(clicks, 10), interest: topSets(interest, 10),
    sources: top(sources), cities: topSets(cities, 10), countries: topSets(countries, 8), devices: topSets(devices, 3),
    leads: leadRows, recent,
  };
}
