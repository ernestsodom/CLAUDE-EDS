// Arma el HTML público (inicio, páginas de producto y páginas internas) a partir del contenido.
import { iconSvg } from './icons.js';
import { FONTS, fontStack, fontHref } from './fonts.js';
import { COLOR_TOKENS } from './schema.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Texto con formato simple: se permiten etiquetas básicas, sin scripts ni atributos de eventos.
export function rich(html) {
  return String(html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, ' $1="#"')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');
}

const nl2br = s => esc(s).replace(/\n/g, '<br>');
const safeUrl = u => {
  const s = String(u ?? '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(s)) return s;
  return '/' + s.replace(/^\.?\/*/, '');
};
const cssUrl = u => `url('${safeUrl(u).replace(/['"()\\\s]/g, encodeURIComponent)}')`;
const safePos = p => (String(p || 'center center').match(/^[\w%.\s-]{1,40}$/) ? String(p) : 'center center');
const veil = v => Math.min(Math.max(Number(v ?? 100), 0), 100) / 100;
const hex = v => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : null);

export const productUrl = c => `/productos/${encodeURIComponent(c.slug)}`;
export const pageUrl = p => `/${encodeURIComponent(p.slug)}`;
const visibleCats = c => (c.categories || []).filter(x => x && !x.hidden && x.slug);

function btn(label, href, cls) {
  return label ? `<a class="btn ${cls}" href="${esc(safeUrl(href) || '#')}">${esc(label)}</a>` : '';
}

/* ---------- bloques ---------- */
const R = {
  hero(b) {
    const facts = (b.facts || []).filter(f => f.title || f.text);
    return `<section class="hero" id="${esc(b.id)}" aria-label="Presentación" style="--veil:${veil(b.veil)}">
  <div class="hero-bg" role="img" aria-label="${esc(b.alt)}" style="background-image:${cssUrl(b.image)};--pos:${safePos(b.pos)};--pos-m:${safePos(b.posMobile || b.pos)}"></div>
  <div class="wrap"><div class="hero-copy">
    ${b.kicker ? `<p class="kicker">${esc(b.kicker)}</p>` : ''}
    <h1>${esc(b.title)}${b.titleAccent ? ` <em>${esc(b.titleAccent)}</em>` : ''}</h1>
    ${b.lead ? `<p class="lead">${nl2br(b.lead)}</p>` : ''}
    <div class="hero-ctas">${btn(b.cta1Label, b.cta1Href, 'btn-orange')}${btn(b.cta2Label, b.cta2Href, 'btn-ghost')}</div>
    ${facts.length ? `<ul class="hero-facts">${facts.map(f => `<li><b>${esc(f.title)}</b>${esc(f.text)}</li>`).join('')}</ul>` : ''}
  </div></div>
</section>`;
  },

  pageHero(b, ctx) {
    return `<section class="pp-hero" id="${esc(b.id)}" style="--veil:${veil(b.veil)}">
  <div class="pp-bg" role="img" aria-label="${esc(b.alt)}" style="background-image:${cssUrl(b.image)};background-position:${safePos(b.pos)}"></div>
  <div class="wrap"><div class="pp-copy">
    ${ctx.crumb ? `<div class="crumb">${ctx.crumb}</div>` : ''}
    ${b.eyebrow ? `<span class="eyebrow">${esc(b.eyebrow)}</span>` : ''}
    ${b.icon ? `<span class="ic">${iconSvg(b.icon)}</span>` : ''}
    <h1>${esc(b.title)}</h1><div class="rule"></div>
    ${b.lead ? `<p class="lead">${nl2br(b.lead)}</p>` : ''}
    ${b.cta1Label || b.cta2Label ? `<div class="hero-ctas">${btn(b.cta1Label, b.cta1Href, 'btn-orange')}${btn(b.cta2Label, b.cta2Href, 'btn-ghost')}</div>` : ''}
  </div></div>
</section>`;
  },

  categories(b, ctx) {
    const cats = visibleCats(ctx.content);
    const more = b.moreLabel || 'Conoce la solución';
    return `<section class="cats ${bg(b)}" id="${esc(b.id)}" aria-label="Productos">
  <div class="wrap">${head(b)}
    <div class="cat-grid${b.columns === '3' ? ' cols-3' : ''}">${cats.map(c => `<a class="cat" href="${productUrl(c)}">
      <div class="cat-photo"><img src="${esc(safeUrl(c.image))}" alt="${esc(c.alt)}" loading="lazy" style="object-position:${safePos(c.pos)}">
        <div class="cat-head"><span class="ic">${iconSvg(c.icon)}</span><h3>${esc(c.name)}</h3></div></div>
      <div class="cat-body"><p>${esc(c.short)}</p><span class="more">${esc(more)} <span aria-hidden="true">→</span></span></div></a>`).join('')}
    </div>
  </div>
</section>`;
  },

  trust(b) {
    const items = b.items || [];
    if (!items.length) return '';
    return `<section class="trust" id="${esc(b.id)}" aria-label="Por qué elegirnos"><div class="wrap"><div class="trust-row">
  ${items.map(i => `<div>${iconSvg(i.icon)}<p><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></p></div>`).join('')}
</div></div></section>`;
  },

  benefits(b) {
    return `<section class="benef" id="${esc(b.id)}">
  <div class="benef-band">
    ${b.image ? `<img src="${esc(safeUrl(b.image))}" alt="${esc(b.alt)}" loading="lazy">` : ''}
    <div class="wrap"><div class="txt">${b.eyebrow ? `<span class="eyebrow">${esc(b.eyebrow)}</span>` : ''}<h2>${nl2br(b.title)}</h2></div></div>
  </div>
  ${(b.items || []).length ? `<div class="wrap"><div class="pill-row">${b.items.map(i => `<div class="pillar"><span class="ic">${iconSvg(i.icon)}</span><div><h3>${esc(i.title)}</h3><p>${nl2br(i.text)}</p></div></div>`).join('')}</div></div>` : ''}
</section>`;
  },

  flow(b) {
    const arrow = '<div class="link" aria-hidden="true"><svg viewBox="0 0 60 26"><path d="M2 13h50M44 5l9 8-9 8"/></svg></div>';
    const ch = (b.channels || []).filter(c => c.title);
    const label = `Flujograma: ${[b.startTitle, ch.map(c => c.title).join(' y '), b.endTitle].filter(Boolean).join(', luego ')}.`;
    return `<section class="plat" id="${esc(b.id)}" aria-label="${esc(b.eyebrow || 'Flujograma')}"><div class="wrap">
  ${head(b)}
  <div class="flow" role="img" aria-label="${esc(label)}">
    <div class="node"><span class="ni">${iconSvg(b.startIcon)}</span><h3>${esc(b.startTitle)}</h3><p>${esc(b.startText)}</p></div>
    ${arrow}
    <div class="channels">${ch.map(c => `<div class="node"><span class="ni">${iconSvg(c.icon)}</span><div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div></div>`).join('')}</div>
    ${arrow}
    <div class="node check"><span class="ni">${iconSvg(b.endIcon)}</span><h3>${esc(b.endTitle)}</h3><p>${esc(b.endText)}</p></div>
  </div>
  ${(b.checks || []).filter(Boolean).length ? `<ul class="checks">${b.checks.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
</div></section>`;
  },

  cards(b) {
    const items = b.items || [];
    let grid;
    if (b.style === 'number') {
      grid = `<div class="feat-grid">${items.map((i, n) => `<div class="feat"><span class="fn">${n + 1}</span><h3>${esc(i.title)}</h3><p>${nl2br(i.text)}</p></div>`).join('')}</div>`;
    } else if (b.style === 'line') {
      grid = `<div class="values">${items.map(i => `<div>${i.icon ? `<span class="ic" style="width:46px;height:46px">${iconSvg(i.icon)}</span>` : ''}<h3>${esc(i.title)}</h3><p>${nl2br(i.text)}</p></div>`).join('')}</div>`;
    } else {
      grid = `<div class="mod-grid${b.columns === '3' ? ' cols-3' : ''}">${items.map(i => `<div class="mod">${i.icon ? `<span class="ic">${iconSvg(i.icon)}</span>` : ''}<h3>${esc(i.title)}</h3><p>${nl2br(i.text)}</p></div>`).join('')}</div>`;
    }
    return `<section class="${bg(b)}" id="${esc(b.id)}"><div class="wrap">${head(b)}${grid}</div></section>`;
  },

  steps(b) {
    const items = (b.items || []).filter(Boolean);
    return `<section class="${b.bg ? bg(b) : 'pp-steps'}" id="${esc(b.id)}"><div class="wrap">${head(b)}<div class="stp">${items.map(t => `<div><p>${esc(t)}</p></div>`).join('')}</div></div></section>`;
  },

  faq(b) {
    return `<section class="faq" id="${esc(b.id)}"><div class="wrap">
  <div class="sec-head" style="margin-bottom:0">${b.eyebrow ? `<span class="eyebrow">${esc(b.eyebrow)}</span>` : ''}<h2>${nl2br(b.title)}</h2></div>
  <div>${(b.items || []).map((i, n) => `<details${n === 0 ? ' open' : ''}><summary>${esc(i.q)}</summary><p>${nl2br(i.a)}</p></details>`).join('')}</div>
</div></section>`;
  },

  contact(b, ctx) {
    const s = ctx.content.site;
    const cats = visibleCats(ctx.content);
    const info = [['Correo', s.email], ['Teléfono', s.phone], ['Horario', s.hours]].filter(x => x[1]);
    return `<section class="contact" id="${esc(b.id)}"><div class="wrap">
  <div>
    ${b.eyebrow ? `<span class="eyebrow">${esc(b.eyebrow)}</span>` : ''}
    <h2 style="margin-top:12px">${nl2br(b.title)}</h2>
    ${b.lead ? `<p class="lead" style="margin-top:14px">${nl2br(b.lead)}</p>` : ''}
    ${info.length ? `<ul>${info.map(([k, v]) => `<li><strong>${k}:</strong> ${esc(v)}</li>`).join('')}</ul>` : ''}
  </div>
  ${b.showForm === false ? '<div></div>' : `<form id="demo-form" data-ok="${esc(b.success || '¡Gracias! Te contactaremos pronto.')}" novalidate>
    <div class="row">
      <label for="f-nombre">Nombre<input id="f-nombre" name="nombre" autocomplete="name" required maxlength="120"></label>
      <label for="f-cargo">Cargo<input id="f-cargo" name="cargo" maxlength="120"></label>
    </div>
    <label for="f-inst">Institución<input id="f-inst" name="institucion" maxlength="160"></label>
    <div class="row">
      <label for="f-correo">Correo<input id="f-correo" name="correo" type="email" autocomplete="email" required maxlength="160"></label>
      <label for="f-tel">Teléfono<input id="f-tel" name="telefono" type="tel" autocomplete="tel" maxlength="40"></label>
    </div>
    <label for="f-tipo">Producto de interés<select id="f-tipo" name="producto"><option value="">Elige una opción</option>${cats.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
    <label for="f-msg">¿Qué te gustaría resolver?<textarea id="f-msg" name="mensaje" rows="3" maxlength="2000"></textarea></label>
    <input type="text" name="empresa_web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
    <button class="btn btn-orange" type="submit" style="justify-self:start">${esc(b.button || 'Enviar')}</button>
    <p class="sent" id="sent" role="status" hidden></p>
  </form>`}
</div></section>`;
  },

  text(b) {
    const c = b.align === 'center' ? ' center' : '';
    return `<section class="${bg(b)}" id="${esc(b.id)}"><div class="wrap">${head(b, c)}<div class="rich${c}">${rich(b.body)}</div></div></section>`;
  },

  stat(b) {
    return `<section class="${bg(b)}" id="${esc(b.id)}" style="padding-top:56px"><div class="wrap years"><b>${esc(b.number)}</b><div><p>${rich(b.body)}</p>${b.body2 ? `<p>${nl2br(b.body2)}</p>` : ''}</div></div></section>`;
  },

  image(b) {
    if (!b.image) return '';
    const fig = `<figure class="figure${b.full ? ' full' : ''}"><img src="${esc(safeUrl(b.image))}" alt="${esc(b.alt)}" loading="lazy">${b.caption ? `<figcaption${b.full ? ' class="wrap"' : ''}>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    return `<section class="${bg(b)}" id="${esc(b.id)}"${b.full ? ' style="padding-block:0"' : ''}>${b.full ? fig : `<div class="wrap">${fig}</div>`}</section>`;
  },

  chips(b, ctx) {
    return `<section class="${bg(b)}" id="${esc(b.id)}"><div class="wrap">${b.title ? `<h3>${esc(b.title)}</h3>` : ''}<div class="chips">${chips(ctx.content, ctx.skip)}</div></div></section>`;
  },

  cta(b) {
    return `<section style="padding-top:0" id="${esc(b.id)}"><div class="wrap"><div class="cta-box"><h2>${nl2br(b.title)}</h2>${btn(b.button, b.href, 'btn-orange')}</div></div></section>`;
  },

  note(b) {
    return b.text ? `<section style="padding-top:0" id="${esc(b.id)}"><div class="wrap"><div class="note">${nl2br(b.text)}</div></div></section>` : '';
  },
};

function bg(b) { return b.bg ? `bg-${b.bg}` : ''; }
function head(b, extra = '') {
  if (!b.eyebrow && !b.title && !b.lead) return '';
  return `<div class="sec-head${extra}">${b.eyebrow ? `<span class="eyebrow">${esc(b.eyebrow)}</span>` : ''}${b.title ? `<h2>${nl2br(b.title)}</h2>` : ''}${b.lead ? `<p class="lead">${nl2br(b.lead)}</p>` : ''}</div>`;
}
function chips(content, skip) {
  return visibleCats(content).filter(c => c.slug !== skip).map(c => `<a href="${productUrl(c)}">${esc(c.name)}</a>`).join('');
}

export function renderBlocks(blocks, ctx) {
  return (blocks || []).filter(b => b && !b.hidden && R[b.type]).map(b => {
    try { return R[b.type](b, ctx); } catch (e) { return `<!-- bloque ${esc(b.type)} con error -->`; }
  }).join('\n');
}

/* ---------- estructura de la página ---------- */
function themeCss(t, site) {
  const vars = [];
  for (const [k] of COLOR_TOKENS) { const v = hex(t.colors?.[k]); if (v) vars.push(`--${k}:${v}`); }
  const disp = FONTS[t.fontDisplay] ? t.fontDisplay : 'DM Serif Display';
  const body = FONTS[t.fontBody] ? t.fontBody : 'Jost';
  const dw = FONTS[disp].w.includes(Number(t.displayWeight)) ? Number(t.displayWeight) : FONTS[disp].w[0];
  const sc = (v, a, b) => Math.min(Math.max(Number(v) || 100, a), b) / 100;
  vars.push(`--serif:${fontStack(disp)}`, `--sans:${fontStack(body)}`, `--serif-w:${dw}`);
  vars.push(`--ts:${sc(t.titleScale, 75, 130)}`, `--bs:${sc(t.bodyScale, 85, 120)}`);
  vars.push(`--radius:${Math.min(Math.max(Number(t.radius ?? 18), 0), 32)}px`);
  if (site.logo) vars.push(`--logo-url:${cssUrl(site.logo)}`);
  const ratio = Number(site.logoRatio);
  if (ratio > 0.2 && ratio < 30) vars.push(`--logo-ratio:${ratio}`);
  const links = [fontHref(disp, [dw]), fontHref(body, [400, 500, 600, 700])].filter(Boolean);
  return { css: `:root{${vars.join(';')}}`, links: [...new Set(links)] };
}

function logo(site, cls = 'logo') {
  const label = esc(site.name || 'Inicio');
  const inner = site.logoMode === 'original' || !site.logo
    ? (site.logo ? `<img class="logo-img" src="${esc(safeUrl(site.logo))}" alt="${label}">` : `<strong>${label}</strong>`)
    : `<span class="logo-mark"></span>`;
  return `<a class="${cls}" href="/" aria-label="${label}, inicio">${inner}</a>`;
}

function layout(content, { title, description, body, path, preview, origin }) {
  const s = content.site;
  const { css, links } = themeCss(content.theme || {}, s);
  const cats = visibleCats(content);
  const navLinks = (content.nav || []).filter(n => n.label).map(n => `<a href="${esc(safeUrl(n.href))}">${esc(n.label)}</a>`).join('');
  const ogImg = content.home?.blocks?.find(b => b.type === 'hero')?.image;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${ogImg && origin ? `<meta property="og:image" content="${esc(origin + safeUrl(ogImg))}">` : ''}
${path && origin ? `<link rel="canonical" href="${esc(origin + path)}">` : ''}
<link rel="icon" href="${esc(safeUrl(s.favicon || s.logo || '/favicon.ico'))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${links.map(l => `<link rel="stylesheet" href="${esc(l)}">`).join('\n')}
<link rel="stylesheet" href="/site.css?v=${content.__assetVersion || 1}">
<style id="tema">${css}</style>
</head>
<body${preview ? ' data-preview="1"' : ''}>
<header class="top">
  <div class="wrap">
    ${logo(s)}
    <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav">Menú</button>
    <nav class="nav" id="nav" aria-label="Principal">${navLinks}</nav>
    ${btn(s.ctaLabel, s.ctaHref, 'btn-orange')}
  </div>
</header>
<main id="contenido">
${body}
</main>
<footer class="foot">
  <div class="wrap">
    <div>
      ${logo(s, 'brand')}
      ${s.footerText ? `<p style="margin-top:14px;max-width:36ch">${nl2br(s.footerText)}</p>` : ''}
    </div>
    <div>${cats.length ? `<h4>${esc(s.footerProductsTitle || 'Productos')}</h4>${cats.map(c => `<a href="${productUrl(c)}">${esc(c.name)}</a>`).join('')}` : ''}</div>
    <div><h4>${esc(s.footerContactTitle || 'Contacto')}</h4>${(s.footerLinks || []).map(l => `<a href="${esc(safeUrl(l.href))}">${esc(l.label)}</a>`).join('')}</div>
    ${s.legal ? `<div class="legal">${esc(s.legal)}</div>` : ''}
  </div>
</footer>
${preview ? '<div class="preview-bar">Vista previa · los cambios aún no están publicados</div>' : ''}
<script src="/site.js?v=${content.__assetVersion || 1}" defer></script>
</body>
</html>`;
}

/* ---------- páginas ---------- */
export function renderHome(content, opts = {}) {
  const s = content.site;
  return layout(content, { title: s.title || s.name, description: s.description, body: renderBlocks(content.home?.blocks, { content }), path: '/', ...opts });
}

export function renderCategory(content, c, opts = {}) {
  const p = content.categoryPage || {};
  const crumb = `<a href="/#productos">${esc(p.crumb || 'Productos')}</a> / ${esc(c.name)}`;
  const blocks = [
    { id: 'encabezado', type: 'pageHero', icon: c.icon, title: c.name, lead: c.lead, image: c.image, alt: c.alt, pos: c.pos, veil: c.veil,
      cta1Label: p.cta1Label, cta1Href: '/#contacto', cta2Label: p.cta2Label, cta2Href: '/#productos' },
    (c.features || []).length && { id: 'funciones', type: 'cards', style: 'number', eyebrow: c.name, title: p.featuresTitle, items: c.features },
    (c.steps || []).filter(Boolean).length && { id: 'pasos', type: 'steps', title: p.stepsTitle, items: c.steps },
    { id: 'otros', type: 'chips', title: p.othersTitle },
    p.ctaTitle && { id: 'cta', type: 'cta', title: p.ctaTitle, button: content.site.ctaLabel || 'Agenda una demo', href: '/#contacto' },
  ].filter(Boolean);
  const body = renderBlocks(blocks, { content, crumb, skip: c.slug });
  return layout(content, { title: `${c.name} | ${content.site.name}`, description: c.lead || c.short, body, path: productUrl(c), ...opts });
}

export function renderPage(content, page, opts = {}) {
  const crumb = `<a href="/">Inicio</a> / ${esc(page.title)}`;
  const body = renderBlocks(page.blocks, { content, crumb });
  return layout(content, { title: `${page.title} | ${content.site.name}`, description: page.seoDescription || content.site.description, body, path: pageUrl(page), ...opts });
}

export function renderNotFound(content, opts = {}) {
  const body = `<section class="notfound"><div class="wrap"><span class="eyebrow">Error 404</span><h1>No encontramos esta página</h1><p class="lead">Puede que la dirección haya cambiado o que la página ya no exista.</p><a class="btn btn-orange" href="/">Volver al inicio</a></div></section>`;
  return layout(content, { title: `Página no encontrada | ${content.site.name}`, description: content.site.description, body, ...opts });
}

// Resuelve una ruta pública a su HTML (o null si no existe)
export function renderPath(content, pathname, opts = {}) {
  const path = decodeURIComponent(pathname.replace(/\/+$/, '') || '/');
  if (path === '/') return renderHome(content, opts);
  let m = path.match(/^\/productos\/([^/]+)$/);
  if (m) {
    const c = (content.categories || []).find(x => x.slug === m[1] && (!x.hidden || opts.preview));
    return c ? renderCategory(content, c, opts) : null;
  }
  m = path.match(/^\/([^/]+)$/);
  if (m) {
    const p = (content.pages || []).find(x => x.slug === m[1] && (!x.hidden || opts.preview));
    return p ? renderPage(content, p, opts) : null;
  }
  return null;
}
