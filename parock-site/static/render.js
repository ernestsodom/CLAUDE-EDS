// Renderizador del sitio PAROCK. Funciona igual en el servidor (Vercel) y en el
// navegador (vista previa del back office). No usa APIs de Node.

const SERIF = ['Playfair Display', 'Lora', 'DM Serif Display', 'Cormorant Garamond'];
export const FONT_AXES = {
  'Montserrat': 'wght@300;500;700;800', 'Poppins': 'wght@300;500;700;800', 'Raleway': 'wght@300;500;700;800',
  'Outfit': 'wght@300;500;700;800', 'Plus Jakarta Sans': 'wght@300;500;700;800', 'Playfair Display': 'wght@400;500;700;800',
  'Lora': 'wght@400;500;700', 'Oswald': 'wght@300;500;700', 'Josefin Sans': 'wght@300;500;700',
  'Inter': 'wght@400;500;600;700', 'Open Sans': 'wght@400;500;600;700', 'Lato': 'wght@400;700', 'Nunito Sans': 'wght@400;600;700',
  'Source Sans 3': 'wght@400;600;700', 'Work Sans': 'wght@400;500;600;700', 'DM Sans': 'wght@400;500;600;700', 'Roboto': 'wght@400;500;700'
};

export const ICONS = {
  layers: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  handshake: '<path d="M8 12l3 3 5-6"/><path d="M12 3l2.5 2 3.2-.3.8 3.1 2.7 1.8-1.2 3 1.2 3-2.7 1.8-.8 3.1-3.2-.3L12 21l-2.5-2-3.2.3-.8-3.1-2.7-1.8 1.2-3-1.2-3 2.7-1.8.8-3.1 3.2.3z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19l8-8"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  waves: '<path d="M8 4c-2 3 2 5 0 8s2 5 0 8M12 4c-2 3 2 5 0 8s2 5 0 8M16 4c-2 3 2 5 0 8s2 5 0 8"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/>',
  dust: '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="19" r="1.3"/><circle cx="7" cy="7" r="1"/><circle cx="17" cy="17" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="7" cy="17" r="1"/>',
  fish: '<path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z"/><circle cx="8" cy="11" r=".8"/>',
  bone: '<path d="M7 9a2.5 2.5 0 11-2-4 2.5 2.5 0 114 2l8 8a2.5 2.5 0 112 4 2.5 2.5 0 11-4-2z"/>',
  bowl: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  paw: '<ellipse cx="12" cy="15" rx="4.5" ry="4"/><circle cx="6" cy="10" r="1.8"/><circle cx="9.5" cy="6" r="1.8"/><circle cx="14.5" cy="6" r="1.8"/><circle cx="18" cy="10" r="1.8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  gift: '<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z"/>',
  truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<path d="M5 12l5 5 9-10"/>'
};
export const ICON_NAMES = {
  layers: 'Capas', user: 'Persona', chart: 'Gráfico', handshake: 'Sello / alianza', shield: 'Escudo', heart: 'Corazón', leaf: 'Hoja',
  drop: 'Gota', waves: 'Aroma', flower: 'Flor', dust: 'Partículas', fish: 'Pez', bone: 'Hueso', bowl: 'Plato', paw: 'Huella', star: 'Estrella',
  home: 'Casa', clock: 'Reloj', cart: 'Carro', phone: 'Celular', gift: 'Regalo', truck: 'Camión', target: 'Objetivo', pin: 'Ubicación', mail: 'Correo', check: 'Check'
};

// ---------- utilidades ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const paras = (s) => String(s ?? '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p>${md(p.trim())}</p>`).join('');
const src = (im) => (im && (im.src || (typeof im === 'string' ? im : ''))) || '';
const alt = (im) => esc((im && im.alt) || '');
const arr = (a) => (Array.isArray(a) ? a : []);
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.check}</svg>`;
const safeHref = (h) => { const v = String(h || '#').trim(); return /^(javascript|data):/i.test(v) ? '#' : v; };
const img = (im, extra = '') => (src(im) ? `<img src="${esc(src(im))}" alt="${alt(im)}" loading="lazy" ${extra}>` : '');
const btn = (b, cls = 'btn-gold') => (b && b.label ? `<a href="${esc(safeHref(b.href))}" class="btn ${cls}">${esc(b.label)}</a>` : '');
const styleCls = (s) => ({ gold: 'btn-gold', line: 'btn-line', light: 'btn-light' }[s] || 'btn-gold');
const eyebrow = (t) => (t ? `<div class="eyebrow">${esc(t)}</div>` : '');
const moreBtn = (m, fallback, cls = 'btn-line') => (m && m.href ? `<a class="btn ${cls} more" href="${esc(safeHref(m.href))}">${esc(m.label || fallback)}<span aria-hidden="true">→</span></a>` : '');

export function allProducts(c) {
  const out = [];
  for (const b of arr(c.portfolio?.brands)) for (const p of arr(b.products)) out.push({ brand: b, product: p });
  return out;
}

function carousel(images, { cls = '', auto = 0, caption = false } = {}) {
  const list = arr(images).filter((i) => src(i));
  if (!list.length) return '';
  if (list.length === 1) return `<div class="car single ${cls}">${img(list[0])}</div>`;
  return `<div class="car ${cls}" data-auto="${Number(auto) || 0}">
    <div class="car-track">${list.map((im, i) => `<figure class="car-slide${i ? '' : ' on'}">${img(im)}${caption && im.alt ? `<figcaption>${esc(im.alt)}</figcaption>` : ''}</figure>`).join('')}</div>
    <button class="car-prev" aria-label="Foto anterior">‹</button><button class="car-next" aria-label="Foto siguiente">›</button>
    <div class="car-dots">${list.map((_, i) => `<button aria-label="Ir a la foto ${i + 1}"${i ? '' : ' class="on"'}></button>`).join('')}</div>
  </div>`;
}

// ---------- CSS ----------
function themeVars(t = {}) {
  const c = t.colors || {};
  const head = t.fontHead || 'Montserrat', body = t.fontBody || 'Inter';
  const vars = Object.entries(c).map(([k, v]) => `--${k}:${v}`).join(';');
  const hs = `'${head}',${SERIF.includes(head) ? "Georgia,'Times New Roman',serif" : "'Helvetica Neue',Arial,sans-serif"}`;
  return `:root{${vars};--font-head:${hs};--font-body:'${body}',system-ui,-apple-system,'Segoe UI',sans-serif}`;
}
function fontLink(t = {}) {
  const fams = [...new Set([t.fontHead || 'Montserrat', t.fontBody || 'Inter'])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:${FONT_AXES[f] || 'wght@400;700'}`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${fams}&display=swap" rel="stylesheet">`;
}

const CSS = `
:root{--navy:#0F1D2B;--gold:#A9864E;--gold-2:#C9A86B;--gold-soft:#E9DCC4;--cream:#F7F3EC;--paper:#FFFFFF;--ink:#1B2430;--muted:#5E6875;--line:#E6DFD3;--accent:#E8743B;--on-dark:#C4CCD6;--radius:20px;--shadow:0 18px 40px -18px rgba(15,29,43,.28);--wrap:1180px}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:90px}
body{font-family:var(--font-body);color:var(--ink);background:var(--paper);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
h1,h2,h3,h4{font-family:var(--font-head);line-height:1.15;color:var(--navy);text-wrap:balance}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 24px}
.eyebrow{font-family:var(--font-head);font-weight:500;font-size:.78rem;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:14px}
.eyebrow::before{content:"";width:36px;height:1px;background:var(--gold)}
.center .eyebrow{justify-content:center}.center .eyebrow::after{content:"";width:36px;height:1px;background:var(--gold)}
.title{font-weight:300;font-size:clamp(2rem,4vw,3.1rem);letter-spacing:-.01em;margin:14px 0 18px}.title b{font-weight:800}
.lead{font-size:1.1rem;color:var(--muted);max-width:660px}.center{text-align:center}.center .lead{margin:0 auto}
.prose p{color:var(--muted);font-size:1.05rem;margin-bottom:14px;max-width:68ch}
section{padding:100px 0;position:relative}
.btn{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-head);font-weight:700;font-size:.9rem;letter-spacing:.04em;padding:15px 28px;border-radius:999px;text-decoration:none;border:2px solid transparent;transition:.25s;cursor:pointer;background:none}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold-2));color:#fff;box-shadow:0 10px 24px -10px rgba(169,134,78,.8)}.btn-gold:hover{transform:translateY(-2px)}
.btn-line{border-color:var(--navy);color:var(--navy)}.btn-line:hover{background:var(--navy);color:#fff}
.btn-light{border-color:rgba(255,255,255,.55);color:#fff}.btn-light:hover{background:#fff;color:var(--navy)}
.more{margin-top:34px}.more span{transition:.2s}.more:hover span{transform:translateX(4px)}
.more-row{display:flex;justify-content:center;margin-top:44px}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
/* header */
header.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;justify-content:space-between;height:76px}
.nav .logo img{height:38px;width:auto}
.menu{display:flex;gap:30px;list-style:none;align-items:center}
.menu a{text-decoration:none;font-family:var(--font-head);font-weight:500;font-size:.9rem;color:var(--navy);position:relative;padding:6px 0}
.menu a:not(.btn)::after{content:"";position:absolute;left:0;bottom:0;width:0;height:2px;background:var(--gold);transition:.25s}
.menu a:not(.btn):hover::after,.menu a.active::after{width:100%}
.menu .btn{padding:10px 20px;color:#fff}
.burger{display:none;background:none;border:0;width:44px;height:44px;cursor:pointer}
.burger span{display:block;width:24px;height:2px;background:var(--navy);margin:5px auto;transition:.3s}
/* hero */
.hero{min-height:min(820px,92vh);padding:70px 0;background:var(--cream);overflow:hidden;display:flex;align-items:center}
.hero .pet{position:absolute;top:0;bottom:0;width:30vw;max-width:440px}
.hero .pet img{width:100%;height:100%;object-fit:cover}
.hero .pet.left{left:0;clip-path:ellipse(100% 62% at 0% 55%)}.hero .pet.right{right:0;clip-path:ellipse(100% 62% at 100% 45%)}
.swoosh{position:absolute;pointer-events:none}.swoosh.tl{top:0;left:0;width:46vw;max-width:620px}.swoosh.br{bottom:0;right:0;width:46vw;max-width:620px;transform:rotate(180deg)}
.paw{position:absolute;opacity:.12;width:70px;color:var(--gold)}
.hero-inner{position:relative;z-index:2;text-align:center;max-width:620px;margin:0 auto}
.hero-logo{width:min(420px,80%);margin:0 auto 34px}
.hero h1{font-weight:300;font-size:clamp(1.9rem,3.6vw,2.9rem);margin-bottom:18px}.hero h1 b{font-weight:800}
.hero p{color:var(--muted);font-size:1.08rem;margin-bottom:34px}
.ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.brands-strip{margin-top:50px}.brands-strip .eyebrow{justify-content:center;font-size:.72rem;color:var(--navy)}
.brands-strip .eyebrow::before,.brands-strip .eyebrow::after{content:"";width:60px;height:1px;background:var(--navy);opacity:.4}
.brands-logos{display:flex;align-items:center;justify-content:center;gap:34px;margin-top:18px;flex-wrap:wrap}
.brands-logos a{display:block;transition:.2s}.brands-logos a:hover{transform:translateY(-3px)}
.brands-logos img{height:62px;width:auto;mix-blend-mode:multiply}.brands-logos i{width:1px;height:50px;background:var(--line)}
/* hero carousel */
.hero-car{position:relative;height:min(720px,86vh);background:var(--navy);overflow:hidden}
.hero-car .hs{position:absolute;inset:0;opacity:0;transition:opacity .9s ease;display:flex;align-items:center}
.hero-car .hs.on{opacity:1;z-index:1}
.hero-car .hs>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-car .hs::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,29,43,.92) 0%,rgba(15,29,43,.7) 45%,rgba(15,29,43,.1) 85%)}
.hero-car .hs .wrap{position:relative;z-index:2;width:100%}
.hero-car .hs-box{max-width:560px;color:#fff}
.hero-car h1,.hero-car h2{color:#fff;font-weight:300;font-size:clamp(2rem,4vw,3.2rem);margin-bottom:16px}.hero-car h1 b,.hero-car h2 b{font-weight:800;color:var(--gold-2)}
.hero-car p{color:#E2E7ED;font-size:1.1rem;margin-bottom:28px}
.hero-car .hlogo{height:46px;width:auto;margin-bottom:26px}
.hero-car .car-dots{z-index:3}.hero-car .car-prev,.hero-car .car-next{z-index:3}
/* generic carousel */
.car{position:relative;border-radius:var(--radius);overflow:hidden;background:var(--cream);aspect-ratio:4/3;max-width:100%}
.car.single img{width:100%;height:100%;object-fit:cover}
.car-track{position:absolute;inset:0}
.car-slide{position:absolute;inset:0;opacity:0;transition:opacity .7s ease}.car-slide.on{opacity:1;z-index:1}
.car-slide img{width:100%;height:100%;object-fit:cover}
.car-slide figcaption{position:absolute;left:16px;bottom:44px;background:rgba(15,29,43,.8);color:#fff;font-size:.8rem;padding:6px 12px;border-radius:999px}
.car-prev,.car-next{z-index:2;position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.88);color:var(--navy);font-size:1.6rem;line-height:1;cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 16px -6px rgba(0,0,0,.4)}
.car-prev{left:14px}.car-next{right:14px}
.car-dots{z-index:2;position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:8px}
.car-dots button{width:9px;height:9px;border-radius:50%;border:0;background:rgba(255,255,255,.6);cursor:pointer;padding:0}
.car-dots button.on{background:var(--gold-2);width:24px;border-radius:5px}
/* about */
.about-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:70px;align-items:center}
.about-photo{position:relative;box-shadow:var(--shadow);border-radius:var(--radius)}
.about-photo .car{aspect-ratio:4/3;max-width:100%}
.about-photo .badge{position:absolute;left:22px;bottom:22px;z-index:4;background:rgba(15,29,43,.9);color:#fff;padding:16px 20px;border-radius:14px;font-size:.85rem;border-left:3px solid var(--gold);max-width:80%}
.about-photo .badge strong{display:block;font-family:var(--font-head);font-size:1.02rem}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:34px}
.fact{border-top:2px solid var(--gold);padding-top:14px}.fact strong{font-family:var(--font-head);font-weight:800;font-size:1.8rem;color:var(--navy);display:block}.fact span{font-size:.85rem;color:var(--muted)}
.team{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px;margin-top:70px}
.person{display:flex;gap:22px;background:var(--cream);padding:28px;border-radius:var(--radius);align-items:flex-start}
.person>img{width:96px;height:96px;border-radius:50%;object-fit:cover;flex:none;border:3px solid #fff;box-shadow:0 0 0 2px var(--gold-soft)}
.person h3,.person h4{font-size:1.1rem;color:var(--gold);font-weight:700}
.person .role{font-family:var(--font-head);font-weight:700;color:var(--navy);font-size:.95rem;margin:2px 0 8px}
.person p{font-size:.92rem;color:var(--muted)}
.person ul{list-style:none;margin-top:14px;display:grid;gap:10px}.person li strong{display:block;color:var(--navy);font-size:.92rem}.person li span{font-size:.88rem;color:var(--muted)}
/* proposal */
.cream{background:var(--cream)}
.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin-top:56px}
.pillar{background:#fff;border-radius:var(--radius);padding:34px 26px;box-shadow:var(--shadow);transition:.3s;border-bottom:3px solid transparent}
.pillar:hover{transform:translateY(-6px);border-color:var(--gold)}
.ico{width:58px;height:58px;border-radius:50%;background:var(--navy);display:grid;place-items:center;margin-bottom:20px;flex:none}
.ico svg{width:26px;height:26px;stroke:var(--gold-2);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pillar h3{font-size:1.15rem;margin:0 0 10px}.pillar p{font-size:.92rem;color:var(--muted)}.pillar .long{margin-top:12px;color:var(--ink)}
/* vision */
.dark{background:var(--navy);color:#fff;overflow:hidden}.dark h2,.dark h3{color:#fff}.dark .lead,.dark .prose p{color:var(--on-dark)}
.vision-grid{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center}
.quote{font-family:var(--font-head);font-weight:300;font-size:clamp(1.5rem,2.6vw,2.1rem);line-height:1.3;border-left:3px solid var(--gold);padding-left:24px;margin:20px 0 26px}.quote b{font-weight:700;color:var(--gold-2)}
.vision-photo .car{aspect-ratio:3/2}
.trends{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:64px}
.trend{border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:28px;background:rgba(255,255,255,.03)}
.trend .k{font-family:var(--font-head);font-weight:800;font-size:2.4rem;color:var(--gold-2);line-height:1}.trend .k small{font-size:.9rem;font-weight:500;color:var(--on-dark);margin-left:6px}
.trend h3{font-size:1.1rem;margin:16px 0 8px}.trend p{font-size:.9rem;color:var(--on-dark)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:56px;border-top:1px solid rgba(255,255,255,.14)}
.stat{padding:30px 20px 0;text-align:center;border-right:1px solid rgba(255,255,255,.14)}.stat:last-child{border:0}
.stat strong{font-family:var(--font-head);font-weight:800;font-size:2.2rem;color:#fff;display:block}.stat span{font-size:.85rem;color:var(--on-dark)}
.source{font-size:.74rem;color:#8995A3;margin-top:22px;text-align:right}
/* why */
.why-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:70px;align-items:center}
.why-list{list-style:none;counter-reset:w}
.why-list li{counter-increment:w;display:flex;gap:22px;align-items:flex-start;padding:18px 0;border-bottom:1px solid var(--line)}
.why-list li::before{content:counter(w,decimal-leading-zero);font-family:var(--font-head);font-weight:800;color:var(--gold);font-size:.9rem;width:42px;height:42px;border-radius:50%;border:1.5px solid var(--gold);display:grid;place-items:center;flex:none}
.why-list strong{display:block;font-family:var(--font-head);font-weight:600;font-size:1.06rem;color:var(--navy)}.why-list span{font-size:.9rem;color:var(--muted)}
.why-cat img{max-height:440px;margin:0 auto}
/* portfolio summary */
.lineup{margin-top:50px;box-shadow:var(--shadow);border-radius:var(--radius)}.lineup .car{aspect-ratio:2/1}
.brand-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-top:40px}
.brand-card{background:#fff;border-radius:var(--radius);padding:30px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:14px}
.brand-card>img{height:58px;width:auto;align-self:flex-start;mix-blend-mode:multiply}
.brand-card p{color:var(--muted);font-size:.95rem}
.mini-list{display:grid;gap:10px;margin-top:6px}
.mini{display:flex;align-items:center;gap:14px;text-decoration:none;padding:10px;border-radius:14px;border:1px solid var(--line);transition:.2s}
.mini:hover{border-color:var(--gold);transform:translateX(3px)}
.mini img{width:58px;height:58px;object-fit:contain;background:var(--cream);border-radius:10px;flex:none}
.mini strong{display:block;font-family:var(--font-head);color:var(--navy);font-size:.95rem}.mini span{font-size:.8rem;color:var(--muted)}
.mini i{margin-left:auto;font-style:normal;color:var(--gold);font-weight:700}
.tag{display:inline-block;font-family:var(--font-head);font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;padding:7px 14px;border-radius:999px;background:var(--cream);color:var(--navy);border:1px solid var(--line)}
.coming{margin-top:60px;border:2px dashed var(--gold-soft);border-radius:var(--radius);padding:34px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;background:rgba(255,255,255,.6)}
.coming h3{font-size:1.2rem}.coming p{color:var(--muted);font-size:.95rem}
/* page hero (subpages) */
.page-hero{background:var(--navy);color:#fff;padding:0;overflow:hidden;position:relative}
.page-hero .ph{display:grid;grid-template-columns:1.1fr .9fr;align-items:stretch;min-height:380px}
.page-hero .ph-txt{padding:70px 40px 70px 0;display:flex;flex-direction:column;justify-content:center}
.page-hero h1{color:#fff;font-weight:300;font-size:clamp(2.1rem,4.4vw,3.4rem);margin:14px 0 16px}.page-hero h1 b{font-weight:800;color:var(--gold-2)}
.page-hero p{color:var(--on-dark);font-size:1.1rem;max-width:560px}
.page-hero .ph-img{position:relative;min-height:260px}
.page-hero .ph-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:ellipse(95% 100% at 100% 50%)}
.crumbs{font-size:.82rem;color:var(--on-dark);display:flex;gap:8px;flex-wrap:wrap}.crumbs a{text-decoration:none;color:var(--gold-2)}
.gold-rule{height:4px;background:linear-gradient(90deg,var(--navy),var(--gold),var(--gold-2),var(--gold),var(--navy))}
.two{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
.mv{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.mv div{background:var(--cream);border-radius:var(--radius);padding:28px}.mv h3{font-size:1.05rem;margin-bottom:8px;color:var(--gold)}.mv p{color:var(--ink)}
.values{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin-top:40px}
.value{display:flex;flex-direction:column;gap:8px}.value h3{font-size:1.05rem}.value p{color:var(--muted);font-size:.92rem}
.gallery .car{aspect-ratio:16/9}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin-top:44px;counter-reset:s}
.step{counter-increment:s;position:relative;padding:30px 24px;border-radius:var(--radius);background:#fff;box-shadow:var(--shadow)}
.step::before{content:counter(s);font-family:var(--font-head);font-weight:800;font-size:2.6rem;color:var(--gold-soft);line-height:1;display:block;margin-bottom:10px}
.step h3{font-size:1.05rem;margin-bottom:8px}.step p{font-size:.9rem;color:var(--muted)}
.pillar-rows{display:grid;gap:22px;margin-top:44px}
.pillar-row{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start;background:#fff;border-radius:var(--radius);padding:28px;box-shadow:var(--shadow)}
.pillar-row h3{font-size:1.2rem;margin-bottom:6px}.pillar-row p{color:var(--muted)}
.trend-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;margin-top:44px}
.tcard{border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:30px;background:rgba(255,255,255,.03)}
.tcard .top{display:flex;gap:16px;align-items:center;margin-bottom:14px}
.tcard .ico{background:rgba(255,255,255,.08);margin:0}
.tcard h3{font-size:1.15rem}.tcard q{display:block;font-style:italic;color:var(--gold-2);margin-bottom:14px}
.tcard .k{font-family:var(--font-head);font-weight:800;font-size:2.2rem;color:#fff;line-height:1}.tcard .kl{color:var(--on-dark);font-size:.88rem;margin:6px 0 14px}
.tcard ul{list-style:none;display:grid;gap:8px}.tcard li{padding-left:22px;position:relative;color:var(--on-dark);font-size:.9rem}
.tcard li::before{content:"";position:absolute;left:2px;top:9px;width:9px;height:5px;border-left:2px solid var(--gold-2);border-bottom:2px solid var(--gold-2);transform:rotate(-45deg)}
.market{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:40px}
.mcard{background:#fff;border-radius:var(--radius);padding:30px;box-shadow:var(--shadow)}
.mcard h3{font-size:1.3rem;margin-bottom:12px}.mcard .big{font-family:var(--font-head);font-weight:800;font-size:2.6rem;color:var(--gold);line-height:1}
.mcard dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin-top:18px;font-size:.92rem}.mcard dt{color:var(--muted)}.mcard dd{font-weight:600;color:var(--navy)}
.bars{display:grid;gap:14px;margin-top:30px;max-width:820px}
.bar{display:grid;grid-template-columns:170px 1fr 56px;gap:16px;align-items:center;font-size:.95rem}
.bar .t{height:18px;background:var(--line);border-radius:999px;overflow:hidden}.bar .f{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-2));border-radius:999px}
.bar b{font-family:var(--font-head);color:var(--navy);text-align:right;font-variant-numeric:tabular-nums}
/* portfolio page & product */
.brand-sec{padding:80px 0;border-top:1px solid var(--line)}
.brand-head{display:flex;align-items:center;gap:22px;margin-bottom:24px;flex-wrap:wrap}
.brand-head img{height:64px;width:auto;mix-blend-mode:multiply}
.brand-head p{flex-basis:100%;color:var(--muted);max-width:760px}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px;margin-top:30px}
.pcard{background:#fff;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:.3s;text-decoration:none}
.pcard:hover{transform:translateY(-6px)}
.pcard .pi{height:240px;background:var(--cream);display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden}.pcard .pi img{max-height:204px;max-width:100%;width:auto;object-fit:contain}
.pcard .pt{padding:22px;display:flex;flex-direction:column;flex:1;gap:6px}
.cat{font-family:var(--font-head);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--accent)}
.pcard h3{font-size:1.15rem}.pcard p{font-size:.88rem;color:var(--muted)}
.checks{list-style:none;margin:8px 0;font-size:.86rem;display:grid;gap:6px}
.checks li{padding-left:22px;position:relative}.checks li::before{content:"";position:absolute;left:2px;top:7px;width:10px;height:6px;border-left:2px solid var(--gold);border-bottom:2px solid var(--gold);transform:rotate(-45deg)}
.fmt{margin-top:auto;font-family:var(--font-head);font-weight:700;font-size:.82rem;color:var(--navy);background:var(--cream);border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;gap:10px}.fmt span{color:var(--muted);font-weight:500}
.pcard .go{font-family:var(--font-head);font-weight:700;font-size:.85rem;color:var(--gold);margin-top:10px}
.prod-detail{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;margin-top:30px;background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:30px}
.prod-detail .car{aspect-ratio:1/1;background:var(--cream)}.prod-detail .car img{object-fit:contain}
.prod-detail h3{font-size:1.5rem;margin:6px 0 10px}
.claim{font-family:var(--font-head);font-weight:300;font-size:1.35rem;line-height:1.3;margin:6px 0 16px;color:var(--navy)}.claim b{font-weight:800;color:var(--gold)}
.feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}
.feat{display:flex;gap:12px;align-items:flex-start;background:var(--cream);border-radius:14px;padding:14px}
.feat .ico{width:40px;height:40px;margin:0}.feat .ico svg{width:20px;height:20px}
.feat strong{display:block;font-size:.92rem;color:var(--navy);font-family:var(--font-head)}.feat span{font-size:.84rem;color:var(--muted)}
.specs{width:100%;border-collapse:collapse;margin-top:14px;font-size:.92rem}
.specs th,.specs td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}.specs th{width:40%;color:var(--muted);font-weight:500}.specs td{font-weight:600;color:var(--navy)}
.variants{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px;margin-top:20px}
.variant{background:var(--cream);border-radius:14px;padding:12px;text-align:center}.variant img{height:150px;width:auto;margin:0 auto 8px;object-fit:contain}.variant span{font-size:.85rem;font-weight:600;color:var(--navy)}
.benefits{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:rgba(255,255,255,.14);margin-top:40px;border-radius:var(--radius);overflow:hidden}
.benefits div{background:var(--navy);padding:26px;display:flex;gap:14px;align-items:center;color:#fff;font-family:var(--font-head);font-weight:600}
.benefits svg{width:28px;height:28px;stroke:var(--gold-2);fill:none;stroke-width:1.8;flex:none}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.chip{font-size:.78rem;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--cream);color:var(--navy);border:1px solid var(--line)}
.prod-top{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:start}
.prod-top .car{aspect-ratio:1/1;background:var(--cream);box-shadow:var(--shadow)}.prod-top .car img{object-fit:contain;padding:20px}
.related{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;margin-top:30px}
/* contact */
.contact-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:60px;align-items:start}
.contact-info{background:var(--navy);color:#fff;border-radius:var(--radius);padding:44px;position:relative;overflow:hidden}
.contact-info h3{color:#fff;font-size:1.5rem;font-weight:300;margin-bottom:24px}.contact-info h3 b{font-weight:800}
.ci{display:flex;gap:16px;margin-bottom:22px;font-size:.95rem;color:#D4DAE1}
.ci svg{width:22px;height:22px;flex:none;stroke:var(--gold-2);fill:none;stroke-width:1.8;margin-top:2px}
.ci strong{display:block;color:#fff;font-family:var(--font-head);font-size:.82rem;letter-spacing:.06em;text-transform:uppercase}.ci a{color:#fff}
form.cf{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}
.field label{font-family:var(--font-head);font-weight:700;font-size:.78rem;letter-spacing:.06em;color:var(--navy)}
.cf input,.cf textarea{font:inherit;padding:14px 16px;border:1.5px solid var(--line);border-radius:12px;background:#fff;color:var(--ink)}
.cf input:focus,.cf textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px rgba(169,134,78,.15)}
.cf textarea{min-height:150px;resize:vertical}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.consent{grid-column:1/-1;font-size:.85rem;color:var(--muted);display:flex;gap:10px;align-items:flex-start}.consent input{margin-top:4px}
.form-msg{grid-column:1/-1;border-radius:12px;padding:14px 16px;font-size:.92rem}.form-msg.ok{background:#EEF6EC;color:#2F6B2A}.form-msg.err{background:#FCEDEC;color:#9B2C2C}
/* footer */
footer{background:var(--navy);color:#AEB8C4;padding:70px 0 30px;font-size:.9rem}
.foot{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:40px}
.foot img{height:42px;width:auto;margin-bottom:18px}
.foot h5{font-family:var(--font-head);color:#fff;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;margin-bottom:14px}
.foot ul{list-style:none}.foot li{margin-bottom:8px}.foot a{text-decoration:none}.foot a:hover{color:var(--gold-2)}
.legal{border-top:1px solid rgba(255,255,255,.1);margin-top:50px;padding-top:24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:.8rem}
@media (max-width:1024px){
 .pillars,.values,.steps{grid-template-columns:repeat(2,1fr)}
 .about-grid,.vision-grid,.why-grid,.contact-grid,.two,.prod-detail,.prod-top{grid-template-columns:1fr;gap:40px}
 .stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(2){border-right:0}.stat{padding-bottom:24px}
 .why-cat{display:none}.trend-cards,.market{grid-template-columns:1fr}
 .page-hero .ph{grid-template-columns:1fr}.page-hero .ph-txt{padding:50px 0 30px}.page-hero .ph-img{min-height:240px;margin:0 -24px}.page-hero .ph-img img{clip-path:none}
}
@media (max-width:860px){
 .burger{display:block}
 .menu{position:absolute;top:76px;left:0;right:0;flex-direction:column;gap:0;background:#fff;padding:10px 24px 24px;border-bottom:1px solid var(--line);transform:translateY(-8px);opacity:0;visibility:hidden;transition:.25s;align-items:stretch}
 .menu.open{transform:none;opacity:1;visibility:visible}
 .menu li a{display:block;padding:14px 0;border-bottom:1px solid var(--line)}.menu .btn{margin-top:14px;justify-content:center;border-bottom:0}
 .burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}.burger.open span:nth-child(2){opacity:0}.burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
 .hero{padding:40px 0 60px;flex-direction:column}
 .pets-m{display:flex;gap:8%;justify-content:center;width:100%;margin-bottom:28px}
 .hero .pet{position:relative;top:auto;bottom:auto;width:150px;height:150px;border-radius:50%;overflow:hidden;clip-path:none!important;box-shadow:0 0 0 4px #fff,0 0 0 6px var(--gold-soft)}
 .swoosh{width:70vw}
 .trends,.facts,.mv,.feat-grid{grid-template-columns:1fr}
 .person{flex-direction:column}
 form.cf{grid-template-columns:1fr}.foot{grid-template-columns:1fr}
 .bar{grid-template-columns:110px 1fr 48px;gap:10px;font-size:.85rem}
 .hero-car .hs::after{background:linear-gradient(0deg,rgba(15,29,43,.92) 10%,rgba(15,29,43,.4) 70%,rgba(15,29,43,.15))}
 .hero-car .hs{align-items:flex-end;padding-bottom:70px}
}
@media (max-width:560px){
 section{padding:72px 0}.wrap{padding:0 16px}
 .pillars,.values,.steps,.stats{grid-template-columns:1fr}
 .stat{border-right:0;border-bottom:1px solid rgba(255,255,255,.14)}
 .brands-logos{gap:16px}.brands-logos img{height:46px}
 .contact-info{padding:32px 24px}.prod-detail{padding:18px}
 .page-hero .ph-img{margin:0 -16px}
}
@media (min-width:861px){.pets-m{display:contents}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const SVG_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="g-gold" x1="0" x2="1"><stop offset="0" style="stop-color:var(--gold-2)"/><stop offset=".5" style="stop-color:var(--gold-soft)"/><stop offset="1" style="stop-color:var(--gold)"/></linearGradient>
<symbol id="paw" viewBox="0 0 64 64"><ellipse cx="32" cy="42" rx="14" ry="12" fill="currentColor"/><ellipse cx="14" cy="26" rx="6" ry="8" fill="currentColor"/><ellipse cx="26" cy="15" rx="6" ry="8" fill="currentColor"/><ellipse cx="40" cy="15" rx="6" ry="8" fill="currentColor"/><ellipse cx="52" cy="26" rx="6" ry="8" fill="currentColor"/></symbol>
<symbol id="swoosh" viewBox="0 0 600 300"><path d="M0 0h600C470 40 330 70 210 140 130 186 60 240 0 300Z" style="fill:var(--navy)"/><path d="M600 0C470 40 330 70 210 140 130 186 60 240 0 300" fill="none" stroke="url(#g-gold)" stroke-width="7"/></symbol>
</defs></svg>`;

const JS = `(()=>{
const m=document.querySelector('.menu'),b=document.querySelector('.burger');
if(b)b.addEventListener('click',()=>{const o=m.classList.toggle('open');b.classList.toggle('open',o);b.setAttribute('aria-expanded',o)});
if(m)m.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{m.classList.remove('open');b&&b.classList.remove('open')}));
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.car:not(.single),.hero-car').forEach(c=>{
 const s=[...c.querySelectorAll(':scope .car-slide,:scope>.hs')],d=[...c.querySelectorAll(':scope>.car-dots button')];if(s.length<2)return;
 let i=0,t;const go=n=>{s[i].classList.remove('on');d[i]&&d[i].classList.remove('on');i=(n+s.length)%s.length;s[i].classList.add('on');d[i]&&d[i].classList.add('on')};
 const auto=+c.dataset.auto||0,start=()=>{clearInterval(t);if(auto&&!rm)t=setInterval(()=>go(i+1),auto*1000)};
 c.querySelector(':scope>.car-prev')?.addEventListener('click',()=>{go(i-1);start()});
 c.querySelector(':scope>.car-next')?.addEventListener('click',()=>{go(i+1);start()});
 d.forEach((x,k)=>x.addEventListener('click',()=>{go(k);start()}));
 let x0=null;c.addEventListener('touchstart',e=>x0=e.touches[0].clientX,{passive:true});
 c.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){go(i+(dx<0?1:-1));start()}x0=null});
 start();
});
const f=document.querySelector('form.cf');
if(f)f.addEventListener('submit',async e=>{e.preventDefault();const msg=f.querySelector('.form-msg');
 if(!f.checkValidity()){f.reportValidity();return}
 if(window.__PREVIEW__){msg.className='form-msg ok';msg.hidden=false;msg.textContent=f.dataset.success+' (vista previa: no se envió)';return}
 const btn=f.querySelector('button[type=submit]');btn.disabled=true;
 try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
  if(!r.ok)throw 0;msg.className='form-msg ok';msg.textContent=f.dataset.success;f.reset()}
 catch(_){msg.className='form-msg err';msg.textContent='No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por correo.'}
 msg.hidden=false;btn.disabled=false});
})();`;

// ---------- layout ----------
function layout(c, { title, description, body, path, preview }) {
  const site = c.site || {};
  const navItems = arr(c.nav?.items);
  const isActive = (href) => (href === path || (path !== '/' && href.replace('/#', '/') === path)) ? ' class="active"' : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || site.metaTitle || site.name)}</title>
<meta name="description" content="${esc(description || site.metaDescription || '')}">
<meta property="og:title" content="${esc(title || site.metaTitle || site.name)}"><meta property="og:description" content="${esc(description || site.metaDescription || '')}">
${src(c.portfolio?.images?.[0]) ? `<meta property="og:image" content="${esc(src(c.portfolio.images[0]))}">` : ''}
<link rel="icon" href="${esc(src(site.logo))}">
${fontLink(c.theme)}
<style>${CSS}${themeVars(c.theme)}</style>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: 'https://www.parock.cl', email: c.contact?.email, address: c.contact?.address }).replace(/</g, '\\u003c')}</script>
${preview ? '<script>window.__PREVIEW__=true</script>' : ''}
</head><body>${SVG_DEFS}
<header class="top"><div class="wrap nav">
<a class="logo" href="/" aria-label="${esc(site.name)} — inicio">${img(site.logo)}</a>
<button class="burger" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>
<ul class="menu">${navItems.map((n) => `<li><a href="${esc(safeHref(n.href))}"${isActive(n.href)}>${esc(n.label)}</a></li>`).join('')}
${c.nav?.cta?.label ? `<li><a href="${esc(safeHref(c.nav.cta.href))}" class="btn btn-gold">${esc(c.nav.cta.label)}</a></li>` : ''}</ul>
</div></header>
<main>${body}</main>
<div class="gold-rule"></div>
<footer><div class="wrap"><div class="foot">
<div>${img(site.logoWhite)}<p>${md(c.footer?.tagline)}</p></div>
<div><h5>Navegación</h5><ul>${navItems.map((n) => `<li><a href="${esc(safeHref(n.href))}">${esc(n.label)}</a></li>`).join('')}${c.nav?.cta?.label ? `<li><a href="${esc(safeHref(c.nav.cta.href))}">${esc(c.nav.cta.label)}</a></li>` : ''}</ul></div>
<div><h5>Contacto</h5><ul>${String(c.contact?.address || '').split('\n').map((l) => `<li>${esc(l)}</li>`).join('')}${c.contact?.email ? `<li><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></li>` : ''}${c.contact?.phone ? `<li><a href="tel:${esc(c.contact.phone.replace(/\s/g, ''))}">${esc(c.contact.phone)}</a></li>` : ''}</ul></div>
</div><div class="legal"><span>${esc(c.footer?.copyright)}</span><span><a href="/privacidad">${esc(c.footer?.privacyLabel || 'Política de privacidad')}</a></span></div></div></footer>
<script>${JS}</script></body></html>`;
}

// ---------- secciones de la one page ----------
function heroSection(c) {
  const h = c.hero || {};
  if (h.mode === 'carousel' && arr(h.slides).length) {
    const slides = arr(h.slides);
    return `<section class="hero-car" id="inicio" data-auto="${Number(h.autoplay) || 0}" style="padding:0">
${slides.map((s, i) => `<div class="hs${i ? '' : ' on'}">${src(s.image) ? `<img src="${esc(src(s.image))}" alt="${alt(s.image)}">` : ''}<div class="wrap"><div class="hs-box">
${i === 0 && h.showLogo ? `<img class="hlogo" src="${esc(src(c.site?.logoWhite))}" alt="${esc(c.site?.name)}">` : ''}
${i === 0 ? `<h1>${md(s.title)}</h1>` : `<h2>${md(s.title)}</h2>`}${s.text ? `<p>${md(s.text)}</p>` : ''}${btn(s.button, 'btn-gold')}</div></div></div>`).join('')}
${slides.length > 1 ? `<button class="car-prev" aria-label="Diapositiva anterior">‹</button><button class="car-next" aria-label="Diapositiva siguiente">›</button><div class="car-dots">${slides.map((_, i) => `<button aria-label="Ir a la diapositiva ${i + 1}"${i ? '' : ' class="on"'}></button>`).join('')}</div>` : ''}
</section>`;
  }
  const brands = arr(c.portfolio?.brands);
  return `<section class="hero" id="inicio">
<svg class="swoosh tl" aria-hidden="true"><use href="#swoosh"/></svg><svg class="swoosh br" aria-hidden="true"><use href="#swoosh"/></svg>
<svg class="paw" style="top:16%;left:31%" aria-hidden="true"><use href="#paw"/></svg><svg class="paw" style="bottom:24%;right:30%;width:52px" aria-hidden="true"><use href="#paw"/></svg>
<div class="pets-m">${src(h.leftImage) ? `<div class="pet left">${img(h.leftImage)}</div>` : ''}${src(h.rightImage) ? `<div class="pet right">${img(h.rightImage)}</div>` : ''}</div>
<div class="wrap hero-inner">
${h.showLogo && src(c.site?.logo) ? `<img class="hero-logo" src="${esc(src(c.site.logo))}" alt="${esc(c.site.name)}">` : ''}
<h1>${md(h.title)}</h1>${h.subtitle ? `<p>${md(h.subtitle)}</p>` : ''}
<div class="ctas">${arr(h.buttons).map((b) => btn(b, styleCls(b.style))).join('')}</div>
${h.showBrands && brands.length ? `<div class="brands-strip"><div class="eyebrow">${esc(h.brandsLabel)}</div><div class="brands-logos">${brands.map((b, i) => `${i ? '<i></i>' : ''}<a href="/portafolio#${esc(b.slug)}">${img(b.logo)}</a>`).join('')}</div></div>` : ''}
</div></section>`;
}

function aboutSection(c, more) {
  const a = c.about || {};
  return `<section id="nosotros"><div class="wrap"><div class="about-grid">
<div>${eyebrow(a.eyebrow)}<h2 class="title">${md(a.title)}</h2><p class="lead">${md(a.lead1)}</p>${a.lead2 ? `<p class="lead" style="margin-top:14px">${md(a.lead2)}</p>` : ''}
<div class="facts">${arr(a.facts).map((f) => `<div class="fact"><strong>${esc(f.value)}</strong><span>${esc(f.label)}</span></div>`).join('')}</div>
${more ? moreBtn(a.more, c.site?.moreLabel) : ''}</div>
<div class="about-photo">${carousel(a.images, { auto: 5 })}${a.badgeTitle ? `<div class="badge"><strong>${esc(a.badgeTitle)}</strong>${esc(a.badgeText)}</div>` : ''}</div>
</div>
<div class="team">${arr(a.team).map((p) => `<article class="person">${img(p.photo)}<div><h3>${esc(p.name)}</h3><div class="role">${esc(p.role)}</div><p>${md(p.bio)}</p></div></article>`).join('')}</div>
</div></section>`;
}

function proposalSection(c, more) {
  const p = c.proposal || {};
  return `<section class="cream" id="propuesta"><div class="wrap"><div class="center">${eyebrow(p.eyebrow)}<h2 class="title">${md(p.title)}</h2><p class="lead">${md(p.lead)}</p></div>
<div class="pillars">${arr(p.pillars).map((x) => `<article class="pillar"><div class="ico">${icon(x.icon)}</div><h3>${esc(x.title)}</h3><p>${md(x.text)}</p></article>`).join('')}</div>
${more ? `<div class="more-row">${moreBtn(p.more, c.site?.moreLabel)}</div>` : ''}</div></section>`;
}

function visionSection(c, more) {
  const v = c.vision || {};
  return `<section class="dark" id="vision"><div class="wrap"><div class="vision-grid">
<div>${eyebrow(v.eyebrow)}<blockquote class="quote">“${md(v.quote)}”</blockquote><p class="lead">${md(v.lead)}</p></div>
<div class="vision-photo">${carousel(v.images, { auto: 5 })}</div></div>
<div class="trends">${arr(v.trends).map((t) => `<article class="trend"><div class="k">${esc(t.kpi)}<small>${esc(t.kpiLabel)}</small></div><h3>${esc(t.title)}</h3><p>${md(t.text)}</p></article>`).join('')}</div>
<div class="stats">${arr(v.stats).map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join('')}</div>
${v.source ? `<p class="source">${esc(v.source)}</p>` : ''}
${more ? `<div class="more-row">${moreBtn(v.more, c.site?.moreLabel, 'btn-light')}</div>` : ''}</div></section>`;
}

function whySection(c) {
  const w = c.why || {};
  return `<section id="por-que"><div class="wrap why-grid"><div>${eyebrow(w.eyebrow)}<h2 class="title">${md(w.title)}</h2>
<ul class="why-list">${arr(w.items).map((i) => `<li><div><strong>${esc(i.title)}</strong>${i.text ? `<span>${md(i.text)}</span>` : ''}</div></li>`).join('')}</ul>
${w.button?.label ? `<div style="margin-top:34px">${btn(w.button)}</div>` : ''}</div>
<div class="why-cat">${img(w.image)}</div></div></section>`;
}

const productUrl = (p) => `/portafolio/${encodeURIComponent(p.slug)}`;

function portfolioSection(c, more) {
  const p = c.portfolio || {};
  return `<section class="cream" id="portafolio"><div class="wrap">
<div class="center">${eyebrow(p.eyebrow)}<h2 class="title">${md(p.title)}</h2><p class="lead">${md(p.lead)}</p></div>
<div class="lineup">${carousel(p.images, { auto: 6 })}</div>
<div class="brand-cards">${arr(p.brands).map((b) => `<article class="brand-card">${img(b.logo)}<span class="tag">${esc(b.tag)}</span><p>${md(b.description)}</p>
<div class="mini-list">${arr(b.products).map((pr) => `<a class="mini" href="${productUrl(pr)}">${img(pr.image)}<div><strong>${esc(pr.name)}</strong><span>${esc(pr.category)}</span></div><i>→</i></a>`).join('')}</div></article>`).join('')}</div>
${more ? `<div class="more-row">${moreBtn(p.more, c.site?.moreLabel)}</div>` : ''}
</div></section>`;
}

function contactSection(c, id = 'contacto') {
  const k = c.contact || {}, L = k.labels || {};
  return `<section id="${id}"><div class="wrap">
<div class="center" style="margin-bottom:56px">${eyebrow(k.eyebrow)}<h2 class="title">${md(k.title)}</h2><p class="lead">${md(k.lead)}</p></div>
<div class="contact-grid"><aside class="contact-info"><h3>${md(k.company)}</h3>
${k.address ? `<div class="ci">${icon('pin')}<div><strong>Dirección</strong>${md(k.address)}${k.mapUrl ? `<br><a href="${esc(safeHref(k.mapUrl))}" target="_blank" rel="noopener">Ver en el mapa</a>` : ''}</div></div>` : ''}
${k.email ? `<div class="ci">${icon('mail')}<div><strong>Correo comercial</strong><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></div></div>` : ''}
${k.phone ? `<div class="ci">${icon('phone')}<div><strong>Teléfono</strong><a href="tel:${esc(k.phone.replace(/\s/g, ''))}">${esc(k.phone)}</a></div></div>` : ''}
${k.email && k.mailButton ? `<a class="btn btn-gold" href="mailto:${esc(k.email)}?subject=${encodeURIComponent('Contacto comercial desde parock.cl')}">${esc(k.mailButton)}</a>` : ''}
</aside>
<form class="cf" novalidate data-success="${esc(k.success)}">
<div class="field"><label for="f-nombre">${esc(L.nombre || 'Nombre')}</label><input id="f-nombre" name="nombre" required autocomplete="name" maxlength="120"></div>
<div class="field"><label for="f-empresa">${esc(L.empresa || 'Empresa')}</label><input id="f-empresa" name="empresa" required autocomplete="organization" maxlength="160"></div>
<div class="field full"><label for="f-email">${esc(L.email || 'Correo electrónico')}</label><input id="f-email" name="email" type="email" required autocomplete="email" maxlength="160"></div>
<div class="field full"><label for="f-msg">${esc(L.mensaje || 'Mensaje')}</label><textarea id="f-msg" name="mensaje" required maxlength="4000"></textarea></div>
<div class="hp" aria-hidden="true"><label for="f-web">No completar</label><input id="f-web" name="website" tabindex="-1" autocomplete="off"></div>
<label class="consent"><input type="checkbox" required><span>${md(k.consent)} <a href="/privacidad">Ver política</a>.</span></label>
<div><button class="btn btn-gold" type="submit">${esc(k.submit || 'Enviar')}</button></div>
<div class="form-msg" role="status" hidden></div>
</form></div></div></section>`;
}

function pageHero(c, { crumbs = [], eyebrowText, title, intro, image }) {
  return `<section class="page-hero"><div class="wrap ph"><div class="ph-txt">
<nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a>${crumbs.map((x) => ` / ${x.href ? `<a href="${esc(x.href)}">${esc(x.label)}</a>` : `<span>${esc(x.label)}</span>`}`).join('')}</nav>
${eyebrowText ? `<div class="eyebrow" style="margin-top:22px">${esc(eyebrowText)}</div>` : ''}<h1>${md(title)}</h1>${intro ? `<p>${md(intro)}</p>` : ''}</div>
<div class="ph-img">${src(image) ? `<img src="${esc(src(image))}" alt="${alt(image)}">` : ''}</div></div></section>`;
}

// ---------- páginas ----------
function homePage(c) {
  return heroSection(c) + aboutSection(c, true) + proposalSection(c, true) + visionSection(c, true) + whySection(c) + portfolioSection(c, true) + contactSection(c);
}

function aboutPage(c) {
  const a = c.about || {}, p = c.aboutPage || {};
  return pageHero(c, { crumbs: [{ label: 'Nosotros' }], eyebrowText: a.eyebrow, title: p.title, intro: p.intro, image: p.heroImage }) +
`<section><div class="wrap two"><div>${eyebrow(p.storyTitle)}<div class="prose" style="margin-top:18px">${paras(p.story)}</div>
<div class="facts">${arr(a.facts).map((f) => `<div class="fact"><strong>${esc(f.value)}</strong><span>${esc(f.label)}</span></div>`).join('')}</div></div>
<div class="gallery">${carousel(p.gallery, { auto: 5, caption: false })}</div></div></section>
<section class="cream"><div class="wrap"><div class="mv"><div><h3>Misión</h3><p>${md(p.mission)}</p></div><div><h3>Visión</h3><p>${md(p.vision)}</p></div></div>
<h2 class="title" style="margin-top:70px">${md(p.valuesTitle)}</h2>
<div class="values">${arr(p.values).map((v) => `<div class="value"><div class="ico">${icon(v.icon)}</div><h3>${esc(v.title)}</h3><p>${md(v.text)}</p></div>`).join('')}</div></div></section>
<section><div class="wrap">${eyebrow(p.teamTitle)}<div class="team" style="margin-top:30px">${arr(a.team).map((m) => `<article class="person">${img(m.photo)}<div><h3>${esc(m.name)}</h3><div class="role">${esc(m.role)}</div><p>${md(m.bio)}</p>
${arr(m.highlights).length ? `<ul>${arr(m.highlights).map((h) => `<li><strong>✓ ${esc(h.title)}</strong><span>${md(h.text)}</span></li>`).join('')}</ul>` : ''}</div></article>`).join('')}</div></div></section>
${p.allianceTitle ? `<section class="dark"><div class="wrap center"><h2 class="title">${md(p.allianceTitle)}</h2><p class="lead">${md(p.allianceText)}</p><div class="more-row"><a class="btn btn-gold" href="/#contacto">${esc(c.nav?.cta?.label || 'Contacto')}</a></div></div></section>` : ''}`;
}

function proposalPage(c) {
  const p = c.proposal || {}, q = c.proposalPage || {}, w = c.why || {};
  return pageHero(c, { crumbs: [{ label: 'Nuestra propuesta' }], eyebrowText: p.eyebrow, title: q.title, intro: q.intro, image: q.heroImage }) +
`<section class="cream"><div class="wrap"><div class="center">${eyebrow('Nuestros pilares')}<h2 class="title">${md(p.title)}</h2><p class="lead">${md(p.lead)}</p></div>
<div class="pillar-rows">${arr(p.pillars).map((x) => `<article class="pillar-row"><div class="ico">${icon(x.icon)}</div><div><h3>${esc(x.title)}</h3><p><strong>${md(x.text)}</strong></p>${x.long ? `<p style="margin-top:8px">${md(x.long)}</p>` : ''}</div></article>`).join('')}</div></div></section>
<section><div class="wrap"><div class="center">${eyebrow(q.processTitle)}</div><div class="steps">${arr(q.process).map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${md(s.text)}</p></div>`).join('')}</div></div></section>
<section class="dark" id="tendencias"><div class="wrap"><div class="center">${eyebrow(c.vision?.eyebrow)}<h2 class="title">${md(q.trendsTitle)}</h2><blockquote class="quote" style="max-width:760px;margin:20px auto;text-align:left">“${md(c.vision?.quote)}”</blockquote></div>
<div class="trend-cards">${arr(q.trends).map((t) => `<article class="tcard"><div class="top"><div class="ico">${icon(t.icon)}</div><h3>${esc(t.title)}</h3></div>${t.quote ? `<q>${esc(t.quote)}</q>` : ''}<div class="k">${esc(t.kpi)}</div><div class="kl">${esc(t.kpiLabel)}</div><ul>${arr(t.points).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></article>`).join('')}</div>
${q.trendsSource ? `<p class="source">${esc(q.trendsSource)}</p>` : ''}</div></section>
<section class="cream"><div class="wrap">${eyebrow('Datos de mercado')}<h2 class="title">${md(q.marketTitle)}</h2>
<div class="market">${arr(q.market).map((m) => `<article class="mcard"><h3>${esc(m.title)}</h3><div class="big">${esc(m.households)}</div><p style="color:var(--muted)">${esc(m.householdsLabel)}</p><dl><dt>Crecimiento anual 2020–2025</dt><dd>${esc(m.cagr1)}</dd><dt>Crecimiento anual 2025–2030</dt><dd>${esc(m.cagr2)}</dd><dt>Volumen de alimento</dt><dd>${esc(m.volumes)}</dd></dl></article>`).join('')}</div>
<h3 style="margin-top:60px;font-size:1.4rem">${esc(q.penetrationTitle)}</h3><p style="color:var(--muted)">${esc(q.penetrationLead)}</p>
<div class="bars">${arr(q.penetration).map((b) => { const v = Math.max(0, Math.min(100, Number(b.value) || 0)); return `<div class="bar"><span>${esc(b.label)}</span><div class="t"><div class="f" style="width:${v}%"></div></div><b>${v}%</b></div>`; }).join('')}</div>
${q.marketSource ? `<p class="source" style="color:var(--muted)">${esc(q.marketSource)}</p>` : ''}</div></section>
${whySection(c)}`;
}

function productCard(pr) {
  const fmt = arr(pr.specs).find((s) => /formato$/i.test(s.label)) || arr(pr.specs)[0];
  return `<a class="pcard" href="${productUrl(pr)}"><div class="pi">${img(pr.image)}</div><div class="pt"><span class="cat">${esc(pr.category)}</span><h3>${esc(pr.name)}</h3><p>${md(pr.short)}</p>
<ul class="checks">${arr(pr.features).slice(0, 3).map((f) => `<li>${esc(f.title)}</li>`).join('')}</ul>${fmt ? `<div class="fmt">${esc(fmt.value)}</div>` : ''}<span class="go">Ver ficha completa →</span></div></a>`;
}

function featuresGrid(pr) {
  return `<div class="feat-grid">${arr(pr.features).map((f) => `<div class="feat"><div class="ico">${icon(f.icon)}</div><div><strong>${esc(f.title)}</strong><span>${md(f.text)}</span></div></div>`).join('')}</div>`;
}
const specsTable = (pr) => (arr(pr.specs).length ? `<table class="specs"><tbody>${arr(pr.specs).map((s) => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join('')}</tbody></table>` : '');

function portfolioPage(c) {
  const p = c.portfolio || {};
  return pageHero(c, { crumbs: [{ label: 'Portafolio' }], eyebrowText: p.eyebrow, title: p.pageTitle || p.title, intro: p.pageIntro || p.lead, image: p.images?.[0] }) +
  arr(p.brands).map((b) => `<section class="brand-sec" id="${esc(b.slug)}"><div class="wrap">
<div class="brand-head">${img(b.logo)}<span class="tag">${esc(b.tag)}</span><p>${md(b.longDescription || b.description)}</p></div>
${arr(b.products).map((pr) => `<article class="prod-detail" id="${esc(pr.slug)}"><div>${carousel([pr.image, ...arr(pr.gallery).filter((g) => src(g) !== src(pr.image))], { auto: 0 })}
${arr(pr.variants).length > 1 ? `<div class="variants">${arr(pr.variants).map((v) => `<div class="variant">${img(v.image)}<span>${esc(v.name)}</span></div>`).join('')}</div>` : ''}</div>
<div><span class="cat">${esc(pr.category)}</span><h3>${esc(pr.name)}</h3>${pr.claim ? `<p class="claim">${md(pr.claim)}</p>` : ''}<p style="color:var(--muted)">${md(pr.description)}</p>
${featuresGrid(pr)}${specsTable(pr)}
${arr(pr.chips).length ? `<div class="chips">${arr(pr.chips).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
<div class="ctas" style="justify-content:flex-start;margin-top:24px"><a class="btn btn-gold" href="${productUrl(pr)}">Ver ficha del producto</a><a class="btn btn-line" href="/#contacto">Solicitar información</a></div></div></article>`).join('')}
</div></section>`).join('') +
  (p.coming?.title ? `<section style="padding-top:0"><div class="wrap"><div class="coming"><div><h3>${esc(p.coming.title)}</h3><p>${md(p.coming.text)}</p></div>${btn(p.coming.button, 'btn-line')}</div></div></section>` : '');
}

function productPage(c, brand, pr) {
  const others = allProducts(c).filter((x) => x.product.slug !== pr.slug).slice(0, 4);
  const gal = [pr.image, ...arr(pr.gallery).filter((g) => src(g) !== src(pr.image)), ...arr(pr.variants).map((v) => v.image)];
  return pageHero(c, { crumbs: [{ label: 'Portafolio', href: '/portafolio' }, { label: brand.name, href: `/portafolio#${brand.slug}` }, { label: pr.name }], eyebrowText: pr.category, title: pr.claim || pr.name, intro: pr.short, image: pr.gallery?.[1] || pr.image }) +
`<section><div class="wrap prod-top"><div>${carousel(gal, { auto: 0 })}</div>
<div>${img(brand.logo, 'style="height:54px;width:auto;mix-blend-mode:multiply;margin-bottom:14px"')}<span class="cat">${esc(pr.category)}</span><h2 class="title" style="font-weight:800;margin-top:8px">${esc(pr.name)}</h2>
<div class="prose">${paras(pr.description)}</div>${specsTable(pr)}
${arr(pr.chips).length ? `<div class="chips">${arr(pr.chips).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
<div class="ctas" style="justify-content:flex-start;margin-top:26px"><a class="btn btn-gold" href="/#contacto">Solicitar información comercial</a><a class="btn btn-line" href="/portafolio">Volver al portafolio</a></div></div></div></section>
<section class="cream"><div class="wrap">${eyebrow('Características')}<h2 class="title">Lo que hace <b>diferente</b> a ${esc(pr.name)}</h2>${featuresGrid(pr)}
${arr(pr.variants).length ? `<h3 style="margin-top:50px;font-size:1.3rem">Variedades disponibles</h3><div class="variants">${arr(pr.variants).map((v) => `<div class="variant">${img(v.image)}<span>${esc(v.name)}</span></div>`).join('')}</div>` : ''}
</div></section>
${arr(pr.benefits).length ? `<section class="dark" style="padding:0"><div class="benefits">${arr(pr.benefits).map((b, i) => `<div>${icon(['star', 'heart', 'shield', 'leaf'][i % 4])}<span>${esc(b)}</span></div>`).join('')}</div></section>` : ''}
${others.length ? `<section><div class="wrap">${eyebrow('También en nuestro portafolio')}<div class="related">${others.map((x) => productCard(x.product)).join('')}</div></div></section>` : ''}`;
}

function contactPage(c) {
  const k = c.contact || {};
  return pageHero(c, { crumbs: [{ label: 'Contacto' }], eyebrowText: k.eyebrow, title: k.title, intro: k.lead, image: c.about?.images?.[0] }) + contactSection(c, 'formulario');
}

function privacyPage(c) {
  return pageHero(c, { crumbs: [{ label: c.footer?.privacyLabel || 'Privacidad' }], title: c.footer?.privacyLabel || 'Política de privacidad' }) +
    `<section><div class="wrap prose">${paras(c.footer?.privacyText)}</div></section>`;
}

function notFound(c) {
  return pageHero(c, { title: 'Página **no encontrada**', intro: 'La página que buscas no existe o cambió de dirección.' }) +
    `<section><div class="wrap center"><a class="btn btn-gold" href="/">Volver al inicio</a></div></section>`;
}

// ---------- router ----------
export function renderPage(content, rawPath = '/', opts = {}) {
  const c = content || {};
  const path = ('/' + String(rawPath || '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '')).toLowerCase();
  const name = c.site?.name || 'PAROCK';
  const L = (title, body, description) => layout(c, { title, description, body, path, preview: opts.preview });
  if (path === '/' || path === '/inicio') return { status: 200, html: L(c.site?.metaTitle, homePage(c)) };
  if (path === '/nosotros') return { status: 200, html: L(`Nosotros — ${name}`, aboutPage(c), c.aboutPage?.intro) };
  if (path === '/propuesta') return { status: 200, html: L(`Nuestra propuesta — ${name}`, proposalPage(c), c.proposalPage?.intro) };
  if (path === '/portafolio') return { status: 200, html: L(`Portafolio — ${name}`, portfolioPage(c), c.portfolio?.pageIntro) };
  if (path === '/contacto') return { status: 200, html: L(`Contacto — ${name}`, contactPage(c), c.contact?.lead) };
  if (path === '/privacidad') return { status: 200, html: L(`${c.footer?.privacyLabel || 'Privacidad'} — ${name}`, privacyPage(c)) };
  const m = path.match(/^\/portafolio\/([^/]+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const hit = allProducts(c).find((x) => String(x.product.slug).toLowerCase() === slug);
    if (hit) return { status: 200, html: L(`${hit.product.name} — ${hit.brand.name} | ${name}`, productPage(c, hit.brand, hit.product), hit.product.short) };
    const brand = arr(c.portfolio?.brands).find((b) => String(b.slug).toLowerCase() === slug);
    if (brand) return { status: 302, location: `/portafolio#${brand.slug}` };
  }
  return { status: 404, html: L(`Página no encontrada — ${name}`, notFound(c)) };
}

export function listPages(c) {
  return [
    { path: '/', label: 'Página de inicio' }, { path: '/nosotros', label: 'Nosotros' }, { path: '/propuesta', label: 'Nuestra propuesta' },
    { path: '/portafolio', label: 'Portafolio completo' },
    ...allProducts(c).map((x) => ({ path: productUrl(x.product), label: `Producto: ${x.product.name}` })),
    { path: '/contacto', label: 'Contacto' }, { path: '/privacidad', label: 'Política de privacidad' }
  ];
}
