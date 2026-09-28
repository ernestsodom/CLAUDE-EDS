// Convierte src/template.html (la maqueta aprobada) en la plantilla editable del sitio:
// - marca cada texto con data-k para poder editarlo desde el back office
// - extrae los contenidos iniciales (textos, productos, Nosotros, carrusel, colores)
// - deja el JS de la página leyendo los datos desde window.SITE
// Genera lib/template.js y lib/defaults.js. Ejecutar: npm run prepare-template
import { readFileSync, writeFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const src = readFileSync(new URL('../src/template.html', import.meta.url), 'utf8');
let html = src;

// ---------- 1. Productos: extraer el objeto P del JS ----------
const pStart = html.indexOf('  var P={');
const pEnd = html.indexOf('\n  };', pStart) + '\n  };'.length;
const pLiteral = html.slice(pStart + '  var P='.length, pEnd - 1);
const products = Function('return ' + pLiteral)();
html = html.slice(0, pStart) + "  var SITE=window.SITE||{};\n  var P=SITE.products||{};" + html.slice(pEnd);

// ---------- 2. Reemplazar render() y renderAbout() por versiones que leen SITE ----------
const rStart = html.indexOf('  function render(k){');
const rEnd = html.indexOf('  function route(){');
const newRender = String.raw`  function imgUrl(k){return (SITE.images&&SITE.images[k])||('/img/'+k)}
  var HID=SITE.hidden||[]; function vis(k){return k&&HID.indexOf(k)<0}
  var PP=SITE.pp||{}, AB=SITE.about||{};
  function render(k){
    var d=P[k], c='var('+d.c+')', imgs=(d.img||[]).filter(function(i){return vis(i[0])});
    var bgMode=d.layout==='background'&&vis(d.bg);
    var pics=imgs.map(function(i){return '<img src="'+esc(imgUrl(i[0]))+'" alt="'+esc(i[1]||'')+'">'}).join('');
    var feats=(d.f||[]).map(function(f,i){return '<div class="feat" style="--c:'+c+'"><span class="fn">'+(i+1)+'</span><h3>'+esc(f[0])+'</h3><p>'+esc(f[1])+'</p></div>'}).join('');
    var steps=(d.s||[]).map(function(t){return '<div style="--c:'+c+'"><p>'+esc(t)+'</p></div>'}).join('');
    var more=Object.keys(P).filter(function(x){return x!==k}).map(function(x){return '<a href="#p-'+x+'" style="--c:var('+P[x].c+')">'+esc(P[x].n)+'</a>'}).join('');
    pp.innerHTML=
      (bgMode
        ? '<section class="pp-hero bg" style="--c:'+c+';--pp-bg:url('+esc(imgUrl(d.bg))+');--pp-pos:'+esc(d.bgPos||'center')+';--pp-o:'+(Math.min(Math.max(Number(d.bgDark)||60,0),90)/100)+'"><div class="wrap"><div class="pp-copy">'
        : '<section class="pp-hero" style="--c:'+c+'"><div class="wrap"><div class="pp-copy">')+
        '<div class="crumb"><a href="#productos">'+esc(PP.crumb)+'</a> / '+esc(d.n)+'</div>'+
        '<h1>'+esc(d.n)+'</h1><p class="lead">'+esc(d.lead)+'</p>'+
        '<div class="hero-ctas"><a class="btn btn-white" href="#contacto">'+esc(PP.demo)+'</a><a class="btn btn-line" href="#productos">'+esc(PP.all)+'</a></div>'+
      '</div>'+(!bgMode&&imgs.length?'<div class="pp-pics" style="--n:'+imgs.length+'">'+pics+'</div>':'')+'</div></section>'+
      '<section class="pp-feat"><div class="wrap"><div class="sec-head"><span class="eyebrow">'+esc(d.tag)+'</span><h2>'+esc(PP.feat)+'</h2></div><div class="feat-grid">'+feats+'</div></div></section>'+
      '<section class="pp-steps"><div class="wrap"><div class="sec-head"><h2>'+esc(PP.steps)+'</h2></div><div class="stp">'+steps+'</div></div></section>'+
      '<section class="pp-cta"><div class="wrap"><div class="box" style="--c:'+c+'"><h2>'+esc(PP.cta)+'</h2><a class="btn btn-orange" href="#contacto">'+esc(PP.ctaBtn)+'</a></div></div></section>'+
      '<section class="pp-more"><div class="wrap"><h3>'+esc(PP.more)+'</h3><div class="chips-row">'+more+'</div></div></section>';
  }
  function renderAbout(){
    var chips=Object.keys(P).map(function(x){return '<a href="#p-'+x+'" style="--c:var('+P[x].c+')">'+esc(P[x].n)+'</a>'}).join('');
    var ico={
      code:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
      sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
      clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
    };
    var doIco=[ico.code,ico.sliders,ico.clock], doCol=['var(--blue)','var(--orange)','var(--p-mayores)'];
    var valCol=['var(--blue)','var(--orange)','var(--p-seminarios)','var(--p-mayores)'];
    var dos=(AB.do||[]).map(function(x,i){return '<div class="do" style="--c:'+doCol[i%3]+'"><span class="ic">'+doIco[i%3]+'</span><h3>'+esc(x.t)+'</h3><p>'+esc(x.d)+'</p></div>'}).join('');
    var vals=(AB.val||[]).map(function(x,i){return '<div class="val" style="--c:'+valCol[i%4]+'"><h3>'+esc(x.t)+'</h3><p>'+esc(x.d)+'</p></div>'}).join('');
    pp.innerHTML=
      '<section class="ab-hero" aria-label="Nosotros"'+(vis(AB.image)?' style="--ab-img:url('+esc(imgUrl(AB.image))+')"':'')+'><div class="wrap">'+
        '<div class="crumb"><a href="#inicio">Inicio</a> / '+esc(AB.eyebrow)+'</div>'+
        '<span class="eyebrow" style="color:#FFB27F">'+esc(AB.eyebrow)+'</span>'+
        '<h1>'+esc(AB.title)+'</h1>'+
        '<p class="lead">'+esc(AB.lead)+'</p>'+
      '</div></section>'+
      '<section class="ab-intro"><div class="wrap">'+
        '<div class="ab-years" aria-hidden="true"><div><b>'+esc(AB.yearsNum)+'</b><span>'+esc(AB.yearsLabel)+'</span></div></div>'+
        '<div><p><strong style="color:var(--navy)">'+esc(AB.introStrong)+'</strong> '+esc(AB.introRest)+'</p>'+
        '<p>'+esc(AB.intro2)+'</p></div>'+
      '</div></section>'+
      '<section class="ab-do"><div class="wrap"><div class="sec-head"><span class="eyebrow">'+esc(AB.doEyebrow)+'</span><h2>'+esc(AB.doTitle)+'</h2></div><div class="do-grid">'+dos+'</div></div></section>'+
      '<section class="ab-val"><div class="wrap"><div class="sec-head"><span class="eyebrow">'+esc(AB.valEyebrow)+'</span><h2>'+esc(AB.valTitle)+'</h2></div><div class="val-grid">'+vals+'</div></div></section>'+
      '<section class="ab-who"><div class="wrap"><h3>'+esc(AB.whoTitle)+'</h3><div class="chips-row">'+chips+'</div>'+
        (AB.note?'<div class="ab-note">'+esc(AB.note)+'</div>':'')+
      '</div></section>'+
      '<section class="pp-cta" style="padding-top:0"><div class="wrap"><div class="box" style="--c:var(--blue)"><h2>'+esc(AB.ctaTitle)+'</h2><a class="btn btn-orange" href="#contacto">'+esc(AB.ctaBtn)+'</a></div></div></section>';
  }
`;
html = html.slice(0, rStart) + newRender + html.slice(rEnd);

// La imagen de fondo de Nosotros pasa a ser editable
html = html.replace('.ab-hero::before{content:"";position:absolute;inset:0;background:url("img/hero-contrabajos.webp") center 45%/cover no-repeat}',
  '.ab-hero::before{content:"";position:absolute;inset:0;background:var(--ab-img) center 45%/cover no-repeat}');

// ---------- 3. Formulario: guardar la solicitud en la base de datos ----------
html = html.replace(`  // Formulario de maqueta
  document.getElementById('demo-form').addEventListener('submit',function(e){
    e.preventDefault(); document.getElementById('sent').hidden=false;
  });`, String.raw`  // Formulario de demo: se guarda en la base de datos
  var form=document.getElementById('demo-form'), sent=document.getElementById('sent');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var data={}; new FormData(form).forEach(function(v,k){data[k]=v});
    if(!data.nombre||!data.correo||!/.+@.+\..+/.test(data.correo)){sent.hidden=false;sent.className='sent err';sent.textContent='Revisa tu nombre y correo antes de enviar.';return}
    var b=form.querySelector('button[type=submit]'); b.disabled=true;
    fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      .then(function(r){if(!r.ok)throw 0; sent.className='sent'; sent.textContent=(SITE.formOk||'¡Gracias! Te contactaremos pronto.'); sent.hidden=false; form.reset(); if(window.__track)window.__track('lead',{label:data.producto||''})})
      .catch(function(){sent.className='sent err'; sent.textContent='No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.'; sent.hidden=false})
      .then(function(){b.disabled=false});
  });`);
html = html.replace('.sent{background:#E3F5EA;color:#0E6B31;border-radius:10px;padding:12px 14px;font-weight:600}',
  '.sent{background:#E3F5EA;color:#0E6B31;border-radius:10px;padding:12px 14px;font-weight:600}\n.sent.err{background:#FDE8EA;color:#9F1D2E}');
// El formulario de la maqueta venía con datos de ejemplo cargados: en el sitio real parte vacío
html = html.replace(/(<input id="f-[a-z]+"[^>]*?) value="[^"]*"/g, '$1').replace(/(<textarea id="f-msg"[^>]*>)[^<]*(<\/textarea>)/, '$1$2');
html = html.replace('<input id="f-nombre" name="nombre" autocomplete="name" required>', '<input id="f-nombre" name="nombre" autocomplete="name" required placeholder="María González">');

// Intervalo del carrusel editable
html = html.replace('timer=setInterval(function(){go(cur+1)},6000)', 'timer=setInterval(function(){go(cur+1)},((window.SITE&&window.SITE.carouselSeconds)||6)*1000)');
if (!html.includes('carouselSeconds')) throw new Error('No se encontró el intervalo del carrusel');

// ---------- 4. Puntos de inserción para el servidor ----------
html = html.replace('</head>', '<!--SITE_HEAD-->\n</head>');
html = html.replace('<script>\n(function(){', '<!--SITE_DATA-->\n<script>\n(function(){');
html = html.replace('</body>', '<!--SITE_TRACK-->\n</body>');

// ---------- 5. Marcar los textos editables ----------
const { document } = parseHTML(html);
const SECTION_NAMES = {
  header: 'Menú superior', hero: 'Portada (carrusel)', productos: 'Productos', beneficios: 'Beneficios',
  integraciones: 'La Plataforma: diagrama', modulos: 'La Plataforma: módulos', preguntas: 'Preguntas frecuentes',
  contacto: 'Contacto', footer: 'Pie de página',
};
const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'svg', 'NOSCRIPT', 'TEMPLATE']);
const COMPLEX = 'svg,img,input,select,textarea,div,section,article,ul,form,iframe,table';
const texts = {}; const meta = []; const counters = {};

function sectionOf(el) {
  let e = el;
  while (e && e.tagName) {
    if (e.tagName === 'HEADER') return 'header';
    if (e.tagName === 'FOOTER') return 'footer';
    if (e.tagName === 'SECTION' && e.id) return e.id;
    e = e.parentElement;
  }
  return 'otros';
}
function newKey(sec) { counters[sec] = (counters[sec] || 0) + 1; return sec + '.' + String(counters[sec]).padStart(2, '0'); }
function hasDirectText(el) { return [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); }
function add(el, labelEl) {
  const sec = sectionOf(el);
  const k = newKey(sec);
  el.setAttribute('data-k', k);
  texts[k] = el.innerHTML.trim();
  meta.push({ k, section: sec, sectionName: SECTION_NAMES[sec] || sec, tag: (labelEl || el).tagName.toLowerCase(),
    preview: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) });
}
function walk(el) {
  if (SKIP.has(el.tagName) || el.closest?.('svg')) return;
  if (el.id === 'producto' || el.id === 'rep-tip' || el.id === 'car-dots') return;
  if (hasDirectText(el) && /[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(el.textContent)) {
    if (el.querySelector(COMPLEX)) {
      // Contiene controles o bloques: se vuelve editable cada fragmento de texto por separado
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const span = document.createElement('span');
          span.textContent = n.textContent.trim();
          const lead = n.textContent.match(/^\s*/)[0], trail = n.textContent.match(/\s*$/)[0];
          el.insertBefore(document.createTextNode(lead), n);
          el.insertBefore(span, n);
          el.insertBefore(document.createTextNode(trail), n);
          el.removeChild(n);
          add(span, el);
        }
      }
      for (const c of [...el.children]) if (!c.hasAttribute('data-k')) walk(c);
    } else {
      add(el);
    }
    return;
  }
  for (const c of [...el.children]) walk(c);
}
walk(document.querySelector('header.top'));
walk(document.querySelector('main#inicio'));
walk(document.querySelector('footer.foot'));

// ---------- 6. Carrusel ----------
const carousel = [...document.querySelectorAll('#hero .slide')].map(s => {
  const st = s.getAttribute('style');
  return {
    img: (st.match(/img\/([\w.-]+)/) || [])[1],
    pos: (st.match(/background-position:([^;"]+)/) || [])[1] || 'center',
    alt: s.getAttribute('aria-label') || '',
  };
});

// ---------- 7. Colores (variables CSS de :root) ----------
const rootCss = html.slice(html.indexOf(':root{'), html.indexOf('}', html.indexOf(':root{')));
const theme = {};
for (const m of rootCss.matchAll(/--([\w-]+):(#[0-9A-Fa-f]{3,8});/g)) theme[m[1]] = m[2];
const THEME_LABELS = {
  navy: 'Azul corporativo (logo)', 'navy-2': 'Azul oscuro (fondos)', blue: 'Azul de acción', 'blue-600': 'Azul de acción (hover)',
  cyan: 'Celeste de apoyo', sky: 'Fondo celeste claro', 'sky-2': 'Celeste medio', orange: 'Naranjo (acento)', 'orange-2': 'Naranjo oscuro',
  line: 'Bordes', ink: 'Texto principal', muted: 'Texto secundario', white: 'Blanco', ok: 'Verde (confirmación)',
  'p-cursos': 'Producto: Cursos y Talleres', 'p-seminarios': 'Producto: Seminarios', 'p-infantil': 'Producto: Infantil',
  'p-mayores': 'Producto: 3.ª Edad', 'p-teatro': 'Producto: Teatro', 'p-orquesta': 'Producto: Orquesta', 'p-ferias': 'Producto: Ferias',
};

// ---------- 8. Imágenes usadas ----------
const outHtml = document.toString();
const imageKeys = [...new Set([...outHtml.matchAll(/img\/([\w-]+\.(?:webp|png|jpe?g|svg))/g)].map(m => m[1]))];
for (const p of Object.values(products)) for (const i of p.img) if (!imageKeys.includes(i[0])) imageKeys.push(i[0]);
const IMAGE_LABELS = {
  'logo-proexsi.png': 'Logo Proexsi', 'hero-marionetas.webp': 'Carrusel: marionetas', 'hero-contrabajos.webp': 'Carrusel: contrabajos / fondo Nosotros',
  'hero-jazz.webp': 'Carrusel: banda de jazz', 'beneficios-celular.webp': 'Franja de Beneficios',
  'cursos-ceramica.webp': 'Cursos: cerámica', 'cursos-ninos-pintura.webp': 'Cursos: taller de pintura', 'cursos-acrilicos.webp': 'Cursos: acrílicos',
  'infantil-maquillaje.webp': 'Infantil', 'teatro-sala.webp': 'Teatro', 'orquesta-violines.webp': 'Orquesta y Sala de Música',
  'seminarios-conferencia.webp': 'Seminarios y Conferencias', 'mayores-danza.webp': 'Actividades 3.ª Edad', 'ferias-feria.webp': 'Ferias y Eventos Masivos',
};

const about = {
  eyebrow: 'Nosotros',
  title: 'Tecnología hecha para la cultura',
  lead: 'Somos Proexsi, una empresa chilena de TI que desarrolla sistemas de venta y gestión para organizaciones culturales, artísticas y de entretenimiento.',
  image: 'hero-contrabajos.webp',
  yearsNum: '+20', yearsLabel: 'años',
  introStrong: 'Empresa de TI con más de 20 años desarrollando sistemas customizados de venta y gestión cultural.',
  introRest: 'Optimizamos la gestión y eficiencia de organizaciones cuyo foco está en el mundo de la cultura, las artes y el entretenimiento.',
  intro2: 'Conocemos las reglas de negocio de teatros, centros culturales, orquestas, escuelas de arte y ferias, y las llevamos a una plataforma que tu equipo administra con autonomía.',
  doEyebrow: 'Qué hacemos', doTitle: 'Desarrollamos, integramos y operamos contigo',
  do: [
    { t: 'Sistemas a la medida', d: 'Adaptamos la plataforma a tus salas, precios, perfiles de público y forma de trabajar.' },
    { t: 'Autoadministrable', d: 'Tu equipo crea actividades, precios y cupos sin depender de nosotros para el día a día.' },
    { t: 'Operación 24/7', d: 'Venta segura y expedita las 24 horas del día, los 365 días del año.' },
  ],
  valEyebrow: 'Cómo trabajamos', valTitle: 'Lo que nos importa',
  val: [
    { t: 'Tu oferta es tuya', d: 'Vendes desde tu sitio y con tu marca, sin compartir tu programación en un portal ajeno.' },
    { t: 'Autonomía', d: 'Herramientas simples para que tu equipo decida y opere sin intermediarios.' },
    { t: 'Integración completa', d: 'Medios de pago, boleta electrónica, fidelización y dispositivos de acceso en un solo sistema.' },
    { t: 'Cercanía', d: 'Un equipo en Chile que conoce la gestión cultural y te acompaña en cada temporada.' },
  ],
  whoTitle: 'A quiénes acompañamos',
  note: 'Espacio reservado para la historia de Proexsi, el equipo y los logos de clientes. Contenido por definir.',
  ctaTitle: '¿Conversamos sobre tu programación?', ctaBtn: 'Agenda una demo gratuita →',
};
const pp = {
  crumb: 'Productos', demo: 'Agenda una demo →', all: 'Ver todos los productos', feat: 'Qué puedes hacer',
  steps: 'Así funciona', cta: '¿Lo vemos con tu programación?', ctaBtn: 'Agenda una demo gratuita →', more: 'Otros productos',
};

const DEFAULTS = {
  seo: { title: 'Proexsi · Ticketera para la cultura', description: 'Venta online y presencial, check in con QR e informes en tiempo real para corporaciones culturales de Chile.' },
  theme: { ...theme, fontDisplay: 'Red Hat Display', fontBody: 'Red Hat Text' },
  texts, carousel, products, about, pp, images: {},
  formOk: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.',
  carouselSeconds: 6,
};
const META = { texts: meta, sections: SECTION_NAMES, themeLabels: THEME_LABELS, imageKeys, imageLabels: IMAGE_LABELS };

writeFileSync(new URL('../lib/template.js', import.meta.url),
  '// Generado por scripts/prepare-template.mjs. No editar a mano.\nexport default ' + JSON.stringify(outHtml) + ';\n');
writeFileSync(new URL('../lib/defaults.js', import.meta.url),
  '// Generado por scripts/prepare-template.mjs. No editar a mano.\nexport const DEFAULTS = ' + JSON.stringify(DEFAULTS, null, 1) +
  ';\nexport const META = ' + JSON.stringify(META, null, 1) + ';\n');
console.log(`Textos editables: ${meta.length} · Imágenes: ${imageKeys.length} · Productos: ${Object.keys(products).length} · Slides: ${carousel.length}`);
