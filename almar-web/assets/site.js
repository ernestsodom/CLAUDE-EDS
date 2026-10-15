(() => {
document.documentElement.classList.add('js');
const REMOTE = 'https://www.almarfoto.cl/wp-content/uploads/';
const { GAL, BIG } = window.ALMAR_DATA;
const DEF = {};
window.ALMAR_SCHEMA.forEach((g) => g.fields.forEach((f) => { DEF[f.k] = f.d; }));
let OVR = {};
let GCFG = {};

/* ---------- Textos ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const raw = (k) => (k in OVR ? OVR[k] : DEF[k] ?? '');
// Texto en línea: escapa y convierte *texto* en destacado
const T = (k) => esc(raw(k)).replace(/\*([^*]+)\*/g, '<em class="it" style="color:var(--rose)">$1</em>').replace(/\n+/g, '<br>');
// Párrafos: una línea en blanco separa párrafos
const TP = (k, cls = '') => raw(k).split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p${cls ? ` class="${cls}"` : ''}>${esc(p.trim()).replace(/\*([^*]+)\*/g, '<em class="it" style="color:var(--rose)">$1</em>').replace(/\n/g, '<br>')}</p>`).join('');
const has = (k) => raw(k).trim() !== '';

/* ---------- Galerías ---------- */
function galleries() {
  return window.ALMAR_GALLERIES.map((m, i) => {
    const c = GCFG[m.k] || {};
    const hidden = new Set(c.hidden || []);
    const items = GAL[m.k].filter((it) => !hidden.has(it[1])).concat((c.extra || []).map((u) => [u, u, 3, 2, 1]));
    return { ...m, t: c.title || m.t, intro: c.intro || '', visible: c.visible !== false, order: c.order ?? i, coverPath: c.cover, items };
  }).filter((g) => g.visible).sort((a, b) => a.order - b.order);
}
const isUrl = (p) => /^https:\/\//.test(p);
const frameNo = (p) => { if (isUrl(p)) return ''; const m = p.match(/-(\d+[A-Z]?)(?=$|[-.])/) || p.match(/_(\d+)/); return m ? m[1] : ''; };
function I(dir, rel, alt, attrs = '') {
  if (isUrl(rel)) return `<img src="${esc(rel)}" alt="${esc(alt)}" loading="lazy" decoding="async" ${attrs}>`;
  return `<img src="/${dir}/${rel}" data-r="${rel}" alt="${esc(alt || '')}" loading="lazy" decoding="async" ${attrs}>`;
}
const big = (k, alt, a) => I('big', BIG[k], alt, a);
function findThumb(name) { for (const g in GAL) for (const it of GAL[g]) if (it[1].includes(name + '.') || it[1].includes(name + '-')) return it; return null; }
const th = (name, alt, a) => { const it = findThumb(name); return it ? I('img', it[0], alt, a) : ''; };
const coverOf = (g) => { if (g.coverPath) { const it = g.items.find((x) => x[1] === g.coverPath || x[0] === g.coverPath); if (it) return I('img', it[0], g.t); } return th(g.cover, g.t); };
document.addEventListener('error', (e) => { const t = e.target; if (t.tagName === 'IMG' && t.dataset.r && !t.dataset.f) { t.dataset.f = '1'; t.src = REMOTE + t.dataset.r; } }, true);

/* ---------- Contacto ---------- */
const waNumber = () => raw('whatsapp').replace(/\D/g, '');
const waLink = (msg) => waNumber() ? `https://wa.me/${waNumber()}?text=${encodeURIComponent(msg || raw('whatsapp_msg'))}` : '#contacto';
const igUser = () => raw('instagram').replace(/^@/, '').trim();
const igLink = () => `https://www.instagram.com/${encodeURIComponent(igUser())}/`;
const waSvg = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C8.86 3 3.03 8.83 3.03 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A12.95 12.95 0 0 0 16.04 29C23.2 29 29 23.17 29 16S23.2 3 16.04 3Zm0 23.66c-2.03 0-4.02-.55-5.75-1.58l-.41-.25-3.96 1.04 1.06-3.86-.27-.4a10.6 10.6 0 0 1-1.63-5.6c0-5.88 4.79-10.66 10.68-10.66 5.88 0 10.65 4.78 10.65 10.66 0 5.87-4.78 10.65-10.37 10.65Zm5.85-7.98c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.51-.16-.72.16-.21.32-.83 1.04-1.01 1.25-.19.22-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.6-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.1-.22.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.08 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.82.67.76.24 1.46.21 2.01.13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/></svg>';
const igSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>';
const mailSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>';

/* ---------- Bloques compartidos ---------- */
function band(imgHtml, tk, xk) { return `<section class="band">${imgHtml}<div class="wrap fade"><span class="eyebrow" style="color:#fff">Hablemos</span><h2>${T(tk)}</h2><p style="max-width:44ch;font-size:var(--step-1)">${T(xk)}</p><div class="cbtns"><a class="btn light" href="#contacto">Cotizar mi evento</a>${waNumber() ? `<a class="btn light" href="${waLink()}" target="_blank" rel="noopener" data-track="whatsapp">${waSvg} WhatsApp</a>` : ''}</div></div></section>`; }
function preview(key, n, start = 0) {
  const g = galleries().find((x) => x.k === key); if (!g || !g.items.length) return '';
  const pick = []; const step = Math.max(1, Math.floor(g.items.length / n));
  for (let i = 0; i < Math.min(n, g.items.length); i++) pick.push(g.items[(start + i * step) % g.items.length]);
  return `<div class="mosaic wrap">${pick.map((it) => `<a href="#${g.slug}" aria-label="Ver galería ${esc(g.t)}">${I('img', it[0], '')}</a>`).join('')}</div>`;
}
function phero(imgHtml, title) { return `<div class="phero">${imgHtml}<div class="t"><div class="wrap"><div class="crumbs"><a href="#inicio">Inicio</a> / ${title}</div><h1>${title}</h1></div></div></div>`; }
function igStrip() {
  if (!igUser()) return '';
  const names = ['WEB_MATRIMONIOS_-131', 'WEB_EVENTOS-50', 'BAUTIZO_CLEMENTE-43', 'WEB_CORPORATIVO-36', 'IMG_7419', 'WEB_MATRIMONIOS_-44'];
  return `<section class="tight"><div class="wrap sec-head" style="max-width:1440px"><h2 style="font-size:var(--step-2)">En Instagram <em class="it">@${esc(igUser())}</em></h2><a class="link" href="${igLink()}" target="_blank" rel="noopener" data-track="instagram">Seguir</a></div><div class="igs">${names.map((n) => `<a href="${igLink()}" target="_blank" rel="noopener" data-track="instagram" aria-label="Abrir Instagram">${th(n, '')}</a>`).join('')}</div></section>`;
}

/* ---------- Páginas ---------- */
const P = {};
P.inicio = () => {
  const slides = [['2026/09/WEB_MATRIMONIOS_-101.jpg', 'Matrimonio en jardín', '101'], ['2026/10/WEB_MATRIMONIOS_-86-e1791244716655.jpg', 'Ceremonia', '86'], ['2026/10/WEB_EVENTOS-24-scaled.jpg', 'Celebración', '24'], ['2026/10/WEB_MATRIMONIOS_-131.jpg', 'Primer baile', '131']];
  const testis = [1, 2, 3].filter((i) => has(`testi${i}_text`));
  const faqs = [1, 2, 3, 4, 5].filter((i) => has(`faq${i}_q`));
  return `
 <div class="hero" id="hero">
  ${slides.map((s, i) => `<div class="slide${i ? '' : ' on'}" data-no="${s[2]}">${big(s[0], s[1], i ? '' : 'loading="eager" fetchpriority="high"')}</div>`).join('')}
  <div class="frame-no" id="frameno">Fotograma Nº 101</div>
  <div class="hero-in"><div class="wrap">
    <span class="eyebrow" style="color:#fff">${T('home_eyebrow')}</span>
    <h1>${T('home_title')}</h1>
    <div class="sub"><p>${T('home_sub')}</p>
    <div class="dots" id="dots">${slides.map((s, i) => `<button type="button" class="${i ? '' : 'on'}" aria-label="Foto ${i + 1}"></button>`).join('')}</div></div>
  </div></div>
 </div>

 <section class="statement"><div class="wrap fade">
  <h2>${T('home_statement')}</h2>
  <div class="prose"><p class="lede">${T('home_lede')}</p>${TP('home_intro')}<p><a class="link" href="#galerias">Ver galerías</a></p></div>
 </div></section>

 <div class="verbs"><div class="wrap">
  ${[1, 2, 3].map((i) => `<div><i>${['I', 'II', 'III'][i - 1]}</i><b>${T(`verb${i}_t`)}</b><span>${T(`verb${i}_d`)}</span></div>`).join('')}
 </div></div>

 <section><div class="wrap sec-head" style="max-width:1440px"><div><span class="eyebrow">Servicios</span><h2>${T('services_title')}</h2></div><a class="link" href="#contacto">Cotizar</a></div>
 <div class="wrap tri">
  <a class="tile" href="#matrimonios">${big('2026/09/BOTON_MATRIMONIOS-11-e1791349189364.jpg', 'Matrimonio')}<div class="cap"><span>${T('svc_mat')}</span><h3>${T('mat_title')}</h3></div></a>
  <a class="tile" href="#otros-eventos">${big('2026/09/BOTON_OTROS_EVENTOS-2.jpg', 'Celebración')}<div class="cap"><span>${T('svc_otr')}</span><h3>${T('otr_title')}</h3></div></a>
  <a class="tile" href="#corporativas">${th('WEB_CORPORATIVO-43', 'Fotografía corporativa')}<div class="cap"><span>${T('svc_corp')}</span><h3>${T('corp_title')}</h3></div></a>
 </div></section>

 <section class="about" style="padding-top:0"><div class="wrap">
  <div class="portrait fade">${big('2026/10/magda4-e1791172624797.jpg', 'Magdalena Domínguez con su cámara')}</div>
  <div class="text fade"><span class="eyebrow">Sobre mí</span>
   <h2>${T('about_title')}</h2>
   <div class="prose">${TP('about_text')}</div>
   <div class="sig">${T('about_sig')}</div>
  </div>
 </div></section>

 <section class="book"><div class="wrap">
  <figure class="a fade">${big('2026/10/IMG_7846-scaled-e1791180411100.jpg', 'Libro de fotografías abierto')}<figcaption><span>El libro</span><span>Diseño editorial</span></figcaption></figure>
  <div class="b fade"><span class="eyebrow">${T('book_eyebrow')}</span>
   <h2>${T('book_title')}</h2>
   <div class="prose">${TP('book_text')}</div>
   ${big('2026/09/BOTON_INICIO-4-scaled-e1791210213407.jpg', 'Páginas del libro de fotografías')}
  </div>
 </div></section>

 <section><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Cómo trabajo</span><h2>${T('process_title')}</h2></div></div>
  <div class="steps">${[1, 2, 3, 4].map((i) => `<div class="step"><i>0${i}</i><h3>${T(`step${i}_t`)}</h3><p>${T(`step${i}_d`)}</p></div>`).join('')}</div>
 </div></section>

 <section style="padding-top:0"><div class="wrap sec-head" style="max-width:1440px"><div><span class="eyebrow">Portafolio</span><h2>${T('recent_title')}</h2></div><a class="link" href="#galerias">Todas las galerías</a></div>
 ${preview('matrimonios', 7, 8)}</section>

 ${testis.length ? `<section style="background:var(--paper-2)"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Testimonios</span><h2>${T('testi_title')}</h2></div></div>
  <div class="quotes">${testis.map((i) => `<div class="q"><p>“${T(`testi${i}_text`)}”</p><small>${T(`testi${i}_author`)}</small></div>`).join('')}</div>
 </div></section>` : ''}

 ${faqs.length ? `<section class="faq"><div class="wrap">
  <div><span class="eyebrow">Preguntas frecuentes</span><h2 style="margin-top:12px">${T('faq_title')}</h2></div>
  <div>${faqs.map((i, n) => `<details${n ? '' : ' open'}><summary>${T(`faq${i}_q`)}</summary>${TP(`faq${i}_a`)}</details>`).join('')}</div>
 </div></section>` : ''}

 ${band(big('2026/09/BOTON_MATRIMONIOS-33.jpg', ''), 'home_band_title', 'home_band_text')}
 ${igStrip()}`;
};

function servicePage(o) {
  const p = o.p;
  return `${phero(o.hero, T(p + '_title'))}
 <section class="statement"><div class="wrap fade"><div><span class="eyebrow">${T(p + '_title')}</span><h2 style="margin-top:14px">${T(p + '_h')}</h2></div><div class="prose"><p class="lede">${T(p + '_lede')}</p>${TP(p + '_p')}</div></div></section>
 <section class="split" style="padding-top:0"><div class="wrap">
  <div class="media duo fade">${o.duo}</div>
  <div class="text fade"><span class="eyebrow">${T(p + '_s2e')}</span><h2>${T(p + '_s2h')}</h2><div class="prose">${TP(p + '_s2p')}</div></div>
 </div></section>
 ${o.extra || ''}
 <section class="split rev" style="padding-top:0"><div class="wrap">
  <figure class="media fade">${o.wide}<figcaption><span>${o.cap}</span><span>Almar fotografía</span></figcaption></figure>
  <div class="text fade"><span class="eyebrow">${T(p + '_s3e')}</span><h2>${T(p + '_s3h')}</h2><div class="prose">${TP(p + '_s3p')}</div><div><a class="btn" href="#${o.gslug}">Ver galería completa</a></div></div>
 </div></section>
 <section style="padding-top:0"><div class="wrap sec-head" style="max-width:1440px"><div><span class="eyebrow">Galería</span><h2>${o.gtitle}</h2></div><a class="link" href="#${o.gslug}">Ver galería</a></div>${o.prev}</section>
 ${band(o.bandImg, p + '_band_title', p + '_band_text')}`;
}
P.matrimonios = () => servicePage({
  p: 'mat', hero: big('2026/10/WEB_MATRIMONIOS_-86-e1791244716655.jpg', 'Ceremonia de matrimonio', 'loading="eager"'),
  duo: th('WEB_MATRIMONIOS_-60', 'Novios') + th('WEB_MATRIMONIOS_-91', 'Detalle del matrimonio'),
  wide: big('2026/10/WEB_MATRIMONIOS_-131.jpg', 'Primer baile'), cap: 'Fotograma Nº 131',
  gslug: 'galeria-matrimonios', gtitle: 'Matrimonios <em class="it">reales</em>', prev: preview('matrimonios', 7, 30),
  bandImg: big('2026/09/BOTON_MATRIMONIOS-33.jpg', '')
});
P['otros-eventos'] = () => servicePage({
  p: 'otr', hero: big('2026/09/WEB_EVENTOS-56.jpg', 'Celebración en la playa', 'loading="eager"'),
  duo: big('2026/09/BOTON_OTROS_EVENTOS-2.jpg', 'Celebración familiar') + big('2026/10/WEB_EVENTOS-174.jpg', 'Invitados en celebración'),
  extra: `<div class="verbs" style="margin-bottom:clamp(72px,11vw,150px)"><div class="wrap">${[1, 2, 3].map((i) => `<div><i>${['Familia', 'Celebrar', 'Cultura'][i - 1]}</i><b>${T(`otr_v${i}_t`)}</b><span>${T(`otr_v${i}_d`)}</span></div>`).join('')}</div></div>`,
  wide: big('2026/10/WEB_EVENTOS-24-scaled.jpg', 'Concierto'), cap: 'Fotograma Nº 24',
  gslug: 'galeria-eventos', gtitle: 'Eventos <em class="it">y celebraciones</em>', prev: preview('bautizos', 7, 3),
  bandImg: th('WEB_EVENTOS-90', '')
});
P.corporativas = () => servicePage({
  p: 'corp', hero: big('2026/09/WEB_EVENTOS-84.jpg', 'Equipo de trabajo', 'loading="eager"'),
  duo: th('WEB_CORPORATIVO-43', 'Fachada institucional') + big('2026/10/WEB_CORPORATIVO-81.jpg', 'Retrato corporativo'),
  extra: `<section style="padding-top:0"><div class="wrap"><div class="uses">${[1, 2, 3, 4].map((i) => `<div><b>${T(`corp_u${i}_t`)}</b><span>${T(`corp_u${i}_d`)}</span></div>`).join('')}</div></div></section>`,
  wide: big('2026/10/WEB_CORPORATIVO-26.jpg', 'Productos de emprendimiento'), cap: 'Fotograma Nº 26',
  gslug: 'galeria-corporativas', gtitle: 'Corporativas <em class="it">y marcas</em>', prev: preview('emprendimientos', 7, 5),
  bandImg: th('WEB_CORPORATIVO-36', '')
});
P.galerias = () => {
  const gs = galleries();
  return `
 <div class="ghead"><div class="wrap"><div class="crumbs"><a href="#inicio">Inicio</a> / ${T('gal_title')}</div><h1>${T('gal_title')}</h1>
 <div class="meta"><p class="lede" style="max-width:46ch">${T('gal_intro')}</p><span class="count">${gs.reduce((s, g) => s + g.items.length, 0)} fotografías · ${gs.length} galerías</span></div></div></div>
 <section style="padding-top:0"><div class="wrap gidx">
 ${gs.map((g) => `<a class="gcard fade" href="#${g.slug}"><div class="im">${coverOf(g)}</div><div class="row"><h3>${esc(g.t)}</h3><em>${g.items.length} fotos</em></div></a>`).join('')}
 </div></section>`;
};

const PAGE = 24; let gState = null;
function galleryPage(g) {
  const gs = galleries(); const idx = gs.indexOf(g); const prev = gs[(idx + gs.length - 1) % gs.length], next = gs[(idx + 1) % gs.length];
  return `<div class="ghead"><div class="wrap"><div class="crumbs"><a href="#inicio">Inicio</a> / <a href="#galerias">Galerías</a> / ${esc(g.t)}</div><h1>${esc(g.t)}</h1>
 ${g.intro ? `<p class="lede" style="max-width:52ch">${esc(g.intro)}</p>` : ''}
 <div class="meta"><div class="chips">${gs.map((x) => `<a class="chip${x === g ? ' on' : ''}" href="#${x.slug}">${esc(x.t)}</a>`).join('')}</div><span class="count" id="gcount"></span></div></div></div>
 <div class="wrap"><div class="masonry" id="masonry"></div><div class="more"><button class="btn" id="moreBtn" type="button">Cargar más fotografías</button></div></div>
 ${gs.length > 1 ? `<div class="gnext" style="margin-top:clamp(48px,6vw,80px)"><div class="wrap"><a href="#${prev.slug}"><span class="eyebrow">← Anterior</span><b>${esc(prev.t)}</b></a><a href="#${next.slug}"><span class="eyebrow">Siguiente →</span><b>${esc(next.t)}</b></a></div></div>` : ''}`;
}
function mountGallery(g) {
  const items = g.items; gState = { g, items, shown: 0 };
  const box = document.getElementById('masonry'), btn = document.getElementById('moreBtn'), cnt = document.getElementById('gcount');
  function more() {
    const end = Math.min(items.length, gState.shown + PAGE); let h = '';
    for (let i = gState.shown; i < end; i++) { const it = items[i]; h += `<a href="#${g.slug}" data-i="${i}" aria-label="Abrir fotografía ${i + 1}">${I('img', it[0], g.t + ' ' + (i + 1), `width="${it[2]}" height="${it[3]}"`)}${frameNo(it[1]) ? `<span>Nº ${frameNo(it[1])}</span>` : ''}</a>`; }
    box.insertAdjacentHTML('beforeend', h); gState.shown = end; cnt.textContent = `${end} de ${items.length} fotografías`; btn.hidden = end >= items.length;
  }
  btn.onclick = more; more();
  box.addEventListener('click', (e) => { const a = e.target.closest('a[data-i]'); if (!a) return; e.preventDefault(); openLB(+a.dataset.i); });
}

P.contacto = () => `
 <section class="contact" style="padding-top:clamp(40px,6vw,80px)"><div class="wrap">
  <div class="side">
   <div class="crumbs"><a href="#inicio">Inicio</a> / ${T('contact_title')}</div>
   <h1>${T('contact_title')}</h1>
   <h2 style="font-size:var(--step-2);font-style:italic;color:var(--rose)">${T('contact_sub')}</h2>
   <div class="prose" style="color:var(--ink-soft)">${TP('contact_text')}</div>
   <div class="cbtns">
    ${waNumber() ? `<a class="btn solid" href="${waLink()}" target="_blank" rel="noopener" data-track="whatsapp">${waSvg} WhatsApp</a>` : ''}
    ${has('email') ? `<a class="btn" href="mailto:${esc(raw('email'))}" data-track="email">${mailSvg} Correo</a>` : ''}
   </div>
   ${big('2026/09/WEB_MATRIMONIOS_-101.jpg', 'Novios en un jardín')}
   <dl>
    ${waNumber() ? `<div><dt>WhatsApp</dt><dd><a class="link" style="text-transform:none;letter-spacing:.02em;font-size:1rem" href="${waLink()}" target="_blank" rel="noopener" data-track="whatsapp">+${esc(waNumber())}</a></dd></div>` : ''}
    ${has('email') ? `<div><dt>Correo</dt><dd><a class="link" style="text-transform:none;letter-spacing:.02em;font-size:1rem" href="mailto:${esc(raw('email'))}" data-track="email">${esc(raw('email'))}</a></dd></div>` : ''}
    ${igUser() ? `<div><dt>Instagram</dt><dd><a class="link" style="text-transform:none;letter-spacing:.02em;font-size:1rem" href="${igLink()}" target="_blank" rel="noopener" data-track="instagram">@${esc(igUser())}</a></dd></div>` : ''}
    <div><dt>Fotógrafa</dt><dd>Magdalena Domínguez</dd></div>
   </dl>
  </div>
  <form id="cform" novalidate>
   <h2>${T('form_title')}</h2>
   <div class="f"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" required autocomplete="name"></div>
   <div class="f"><label for="f-email">Correo electrónico</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
   <div class="f"><label for="f-wa">Whatsapp</label><input id="f-wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="+56 9"></div>
   <div class="f"><label for="f-fecha">Fecha</label><input id="f-fecha" name="fecha" type="date"></div>
   <fieldset class="f full"><legend>Tipo de evento</legend><div class="radios">
    <input type="radio" name="tipo" id="t1" value="Matrimonio" checked><label for="t1">Matrimonio</label>
    <input type="radio" name="tipo" id="t2" value="Otros eventos"><label for="t2">Otros eventos</label>
    <input type="radio" name="tipo" id="t3" value="Corporativo"><label for="t3">Corporativo</label>
   </div></fieldset>
   <div class="f full"><label for="f-lugar">Lugar</label><input id="f-lugar" name="lugar"></div>
   <div class="f full"><label for="f-msg">Mensaje</label><textarea id="f-msg" name="mensaje" placeholder="Cuéntame sobre lo que estás organizando"></textarea></div>
   <div class="hp" aria-hidden="true"><label for="f-web">Web</label><input id="f-web" name="web" tabindex="-1" autocomplete="off"></div>
   <div class="full" style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:16px;align-items:center"><button class="btn solid" type="submit" id="fsend">Enviar</button><span class="count" id="ferr" role="alert"></span></div>
  </form>
 </div></section>
 ${igStrip()}`;

/* ---------- Medición de visitas (propia, sin cookies de terceros) ---------- */
const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); s.setItem(k, v); } catch { return null; } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const noTrack = store(localStorage, 'almar_notrack') === '1';
let vid = store(localStorage, 'almar_vid'); if (!vid) { vid = uid(); store(localStorage, 'almar_vid', vid); }
let sid = store(sessionStorage, 'almar_sid'); let src;
if (!sid) {
  sid = uid(); store(sessionStorage, 'almar_sid', sid);
  const q = new URLSearchParams(location.search);
  src = { ref: document.referrer || '', utm: q.get('utm_source') || '', click: q.has('gclid') ? 'gclid' : q.has('fbclid') ? 'fbclid' : '' };
  store(sessionStorage, 'almar_src', JSON.stringify(src));
} else { try { src = JSON.parse(store(sessionStorage, 'almar_src') || '{}'); } catch { src = {}; } }
function send(ev) {
  if (noTrack) return;
  const data = JSON.stringify({ ...ev, sid, vid, src });
  if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([data], { type: 'text/plain' }))) return;
  fetch('/api/track', { method: 'POST', body: data, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}
let curPath = null, curStart = 0;
function leave() { if (curPath && curStart) { send({ type: 'leave', path: curPath, duration: Date.now() - curStart }); curStart = 0; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); else if (curPath) curStart = Date.now(); });
document.addEventListener('click', (e) => { const a = e.target.closest('[data-track]'); if (a) send({ type: 'click', path: curPath, label: a.dataset.track }); });

/* ---------- Router ---------- */
const app = document.getElementById('app');
const BASE = ['inicio', 'matrimonios', 'otros-eventos', 'corporativas', 'galerias', 'contacto'];
let heroTimer = null;
function render() {
  let r = (location.hash || '#inicio').slice(1);
  const g = galleries().find((x) => x.slug === r);
  if (!g && !BASE.includes(r)) r = 'inicio';
  clearInterval(heroTimer); closeDrawer(); closeLB();
  app.innerHTML = g ? galleryPage(g) : P[r]();
  app.style.animation = 'none'; void app.offsetWidth; app.style.animation = '';
  document.body.classList.toggle('over-hero', !!app.querySelector('.hero,.phero'));
  document.querySelectorAll('.nav [data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === r || (a.dataset.r === 'galerias' && (r === 'galerias' || !!g))));
  document.querySelectorAll('#dnav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + r));
  document.title = r === 'inicio' ? 'Almar Fotografía · Matrimonios, eventos y fotografía corporativa' : `${g ? g.t + ' · Galerías' : app.querySelector('h1')?.textContent} · Almar Fotografía`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (g) mountGallery(g);
  if (r === 'inicio') startHero();
  if (r === 'contacto') mountForm();
  observeFades(); onScroll();
  if (r !== curPath) { leave(); curPath = r; curStart = Date.now(); send({ type: 'pageview', path: r }); }
}
function chrome() {
  const gs = galleries();
  document.getElementById('ddmenu').innerHTML = gs.map((g) => `<a href="#${g.slug}">${esc(g.t)}<em>${g.items.length}</em></a>`).join('');
  document.getElementById('fgal').innerHTML = gs.map((g) => `<li><a href="#${g.slug}">${esc(g.t)}</a></li>`).join('');
  document.getElementById('dnav').innerHTML = [['inicio', 'Inicio'], ['matrimonios', raw('mat_title')], ['otros-eventos', raw('otr_title')], ['corporativas', raw('corp_title')], ['galerias', raw('gal_title')]].map(([h, t]) => `<a href="#${h}">${esc(t)}</a>`).join('') + gs.map((g) => `<a class="sub" href="#${g.slug}">${esc(g.t)}</a>`).join('') + '<a href="#contacto">Contacto</a>';
  document.getElementById('ftag').innerHTML = T('footer_tagline');
  document.getElementById('year').textContent = new Date().getFullYear();
  const ig = document.getElementById('hdrIg'); ig.href = igLink(); ig.hidden = !igUser(); ig.setAttribute('aria-label', 'Instagram @' + igUser());
  document.getElementById('dfoot').textContent = igUser() ? '@' + igUser() + ' · Almar Foto Litoral' : 'Almar Foto Litoral';
  document.getElementById('fcontact').innerHTML = [
    waNumber() ? `<li><a href="${waLink()}" target="_blank" rel="noopener" data-track="whatsapp">WhatsApp · +${esc(waNumber())}</a></li>` : '',
    has('email') ? `<li><a href="mailto:${esc(raw('email'))}" data-track="email">${esc(raw('email'))}</a></li>` : '',
    igUser() ? `<li><a href="${igLink()}" target="_blank" rel="noopener" data-track="instagram">Instagram · @${esc(igUser())}</a></li>` : ''
  ].join('');
  const wa = document.getElementById('wa');
  wa.href = waLink();
  if (waNumber()) { wa.target = '_blank'; wa.dataset.tip = 'Escríbeme por WhatsApp'; } else { wa.removeAttribute('target'); wa.dataset.tip = 'Escríbeme'; }
}
function startHero() {
  const slides = [...document.querySelectorAll('#hero .slide')], dots = [...document.querySelectorAll('#dots button')], no = document.getElementById('frameno'); let i = 0;
  const go = (n) => { slides[i].classList.remove('on'); dots[i].classList.remove('on'); i = n; slides[i].classList.add('on'); dots[i].classList.add('on'); no.textContent = 'Fotograma Nº ' + slides[i].dataset.no; };
  const restart = () => { clearInterval(heroTimer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) heroTimer = setInterval(() => go((i + 1) % slides.length), 5500); };
  dots.forEach((d, n) => { d.onclick = () => { go(n); restart(); }; });
  restart();
}
function mountForm() {
  const f = document.getElementById('cform'), err = document.getElementById('ferr'), btn = document.getElementById('fsend');
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const data = Object.fromEntries(new FormData(f).entries());
    if (!data.nombre.trim()) { err.textContent = 'Escribe tu nombre para continuar.'; f.nombre.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) { err.textContent = 'Revisa el correo: falta un formato como nombre@correo.cl.'; f.email.focus(); return; }
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, src }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No pudimos enviar tu mensaje.');
      send({ type: 'click', path: 'contacto', label: 'formulario_enviado' });
      f.innerHTML = `<div class="form-ok"><b>Gracias, ${esc(data.nombre.trim())}.</b><span style="color:var(--ink-soft)">${T('form_ok')}</span>${waNumber() ? `<span style="margin-top:10px"><a class="link" href="${waLink()}" target="_blank" rel="noopener" data-track="whatsapp">¿Prefieres hablar ahora? Escríbeme por WhatsApp</a></span>` : ''}</div>`;
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Enviar'; }
  });
}
let io;
function observeFades() {
  if (!('IntersectionObserver' in window)) return;
  io?.disconnect();
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.fade').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top > innerHeight) { el.classList.add('pre'); io.observe(el); } });
}
const hdr = document.getElementById('hdr');
function onScroll() { hdr.classList.toggle('scrolled', scrollY > 40); }
addEventListener('scroll', onScroll, { passive: true });
addEventListener('hashchange', render);

const drawer = document.getElementById('drawer'), burger = document.getElementById('burger');
function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); }
burger.onclick = () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true'); };
document.getElementById('dclose').onclick = closeDrawer;
drawer.addEventListener('click', (e) => { if (e.target.closest('a')) closeDrawer(); });

/* Visor: intenta la foto en alta resolución; si no carga, usa la versión local */
const lb = document.getElementById('lb'), lbimg = document.getElementById('lbimg'), lbinfo = document.getElementById('lbinfo'); let lbi = 0;
function showLB() {
  const it = gState.items[lbi]; lbimg.dataset.f = '';
  lbimg.onerror = () => { if (!lbimg.dataset.f) { lbimg.dataset.f = '1'; lbimg.src = isUrl(it[0]) ? it[0] : '/img/' + it[0]; } };
  lbimg.src = isUrl(it[1]) ? it[1] : REMOTE + it[1].replace(/-\d+x\d+(?=\.\w+$)/, ''); lbimg.alt = gState.g.t + ' ' + (lbi + 1);
  lbinfo.textContent = `${gState.g.t} · ${lbi + 1} / ${gState.items.length}${frameNo(it[1]) ? ' · Nº ' + frameNo(it[1]) : ''}`;
}
function openLB(i) { lbi = i; showLB(); lb.classList.add('open'); document.body.style.overflow = 'hidden'; lb.querySelector('.x').focus(); }
function closeLB() { lb.classList.remove('open'); document.body.style.overflow = ''; }
const step = (d) => { lbi = (lbi + d + gState.items.length) % gState.items.length; showLB(); };
lb.querySelector('.x').onclick = closeLB; lb.querySelector('.pv').onclick = () => step(-1); lb.querySelector('.nx').onclick = () => step(1);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLB(); closeDrawer(); } if (!lb.classList.contains('open')) return; if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
let tx = null; lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); tx = null; });

/* Arranque: carga los textos guardados (máx. 2,5 s) y luego dibuja */
const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
fetch('/api/site', { signal: ctl.signal }).then((r) => r.json()).then((d) => { OVR = d.content || {}; GCFG = d.galleries || {}; }).catch(() => {}).finally(() => { chrome(); render(); });
})();
