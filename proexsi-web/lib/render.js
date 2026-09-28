// Arma el HTML público a partir de la plantilla y del contenido guardado.
import { parseHTML } from 'linkedom';
import TEMPLATE from './template.js';
import { fontsHref, FONTS } from './fonts.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Los textos admiten formato simple (<br>, <em>, <strong>…); se quitan scripts y atributos de eventos.
export function sanitize(html) {
  return String(html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

const safeCss = v => String(v ?? '').replace(/[;{}<>]/g, '');

const TRACK = `<script>
(function(){
  try{
    if(navigator.webdriver||/bot|crawl|spider|preview/i.test(navigator.userAgent))return;
    function rid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
    function store(s,k,make){try{var v=s.getItem(k);if(!v){v=make();s.setItem(k,v)}return v}catch(e){return make()}}
    var vid=store(localStorage,'px_vid',rid), sid=store(sessionStorage,'px_sid',rid);
    var q=new URLSearchParams(location.search), first=true;
    function page(){var h=location.hash.slice(1);if(h==='nosotros')return '/nosotros';if(h.indexOf('p-')===0)return '/producto/'+h.slice(2);return '/'}
    function send(type,extra){
      var d={type:type,path:page(),visitor:vid,session:sid,referrer:first?document.referrer:'',
        utm_source:q.get('utm_source'),utm_medium:q.get('utm_medium'),utm_campaign:q.get('utm_campaign'),w:innerWidth};
      for(var k in extra)d[k]=extra[k];
      var body=JSON.stringify(d);
      if(navigator.sendBeacon){navigator.sendBeacon('/api/track',new Blob([body],{type:'application/json'}))}
      else{fetch('/api/track',{method:'POST',body:body,keepalive:true,headers:{'Content-Type':'application/json'}})}
    }
    window.__track=send;
    var lastPage=null, seen={};
    function pv(){var p=page();if(p===lastPage)return;lastPage=p;send('pageview',{});first=false;seen={}}
    pv(); addEventListener('hashchange',pv);
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){
        if(e.isIntersecting&&page()==='/'){var id=e.target.id;if(!seen[id]){seen[id]=1;send('section',{section:id})}}
      })},{threshold:0.35});
      document.querySelectorAll('main#inicio > section[id], #plataforma > section[id]').forEach(function(s){io.observe(s)});
    }
    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a.btn, .prod .more, .chips-row a, nav a');
      if(a)send('click',{label:(a.textContent||'').trim().slice(0,80),section:(a.getAttribute('href')||'')});
    });
  }catch(e){}
})();
</script>`;

export function renderPage(content, { preview = false } = {}) {
  const { document } = parseHTML(TEMPLATE);
  // Fotos ocultas o eliminadas desde el back office
  const hidden = new Set([
    ...Object.keys(content.hiddenImages || {}).filter(k => content.hiddenImages[k]),
    ...Object.keys(content.deletedImages || {}).filter(k => content.deletedImages[k]),
  ]);
  for (const img of document.querySelectorAll('img[src^="img/"]')) {
    if (hidden.has(img.getAttribute('src').slice(4))) img.remove();
  }

  // Textos
  const texts = content.texts || {};
  for (const el of document.querySelectorAll('[data-k]')) {
    const k = el.getAttribute('data-k');
    if (texts[k] !== undefined) el.innerHTML = sanitize(texts[k]);
  }

  // Carrusel
  const hero = document.getElementById('hero');
  const slides = (Array.isArray(content.carousel) ? content.carousel : []).filter(s => s && s.img && !s.hidden && !hidden.has(s.img));
  if (hero) {
    hero.querySelectorAll('.slide').forEach(s => s.remove());
    const wrap = hero.querySelector('.wrap');
    if (slides.length < 2) hero.querySelector('.car-ctl')?.setAttribute('style', 'display:none');
    slides.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slide' + (i === 0 ? ' on' : '');
      const url = `url('img/${safeCss(s.img).replace(/'/g, '')}')`;
      const x = { left: 'left', right: 'right' }[s.x] || 'center';
      const y = String(s.pos || 'center 50%').split(' ').slice(1).join(' ') || '50%';
      const zoom = Math.min(Math.max(Number(s.zoom) || 100, 20), 100);
      if (zoom < 100 && s.fill !== 'color') {
        const f = document.createElement('div'); f.className = 's-fill'; f.setAttribute('style', `background-image:${url}`); d.appendChild(f);
      }
      const im = document.createElement('div'); im.className = 's-img'; im.setAttribute('data-zoom', String(zoom));
      im.setAttribute('style', `background-image:${url};background-position:${safeCss(x + ' ' + y)}`); d.appendChild(im);
      d.setAttribute('role', 'img');
      d.setAttribute('aria-label', s.alt || '');
      hero.insertBefore(d, wrap);
    });
  }

  // SEO
  const seo = content.seo || {};
  const title = document.querySelector('title');
  if (title && seo.title) title.textContent = seo.title;

  let html = document.toString();

  // Tema: colores y tipografías
  const t = content.theme || {};
  const vars = Object.entries(t)
    .filter(([k, v]) => !k.startsWith('font') && /^#[0-9a-f]{3,8}$/i.test(v))
    .map(([k, v]) => `--${k}:${v}`);
  const disp = FONTS[t.fontDisplay] ? t.fontDisplay : 'Red Hat Display';
  const body = FONTS[t.fontBody] ? t.fontBody : 'Red Hat Text';
  vars.push(`--display:"${disp}","Segoe UI",system-ui,sans-serif`, `--body:"${body}","Segoe UI",system-ui,sans-serif`, `--mono:"${body}","Segoe UI",system-ui,sans-serif`);
  html = html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/, fontsHref(disp, body).replace(/&/g, '&amp;'));
  const head = `<meta name="description" content="${esc(seo.description)}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<style id="tema">:root{${vars.join(';')}}</style>`;
  html = html.replace('<!--SITE_HEAD-->', head);

  // Datos para páginas internas (productos, Nosotros)
  const images = content.images || {};
  const site = { products: content.products, about: content.about, pp: content.pp, images: {}, formOk: content.formOk, hidden: [...hidden], carouselSeconds: Math.min(Math.max(Number(content.carouselSeconds) || 6, 2), 30) };
  const imgUrl = k => images[k] || `/img/${k}`;
  for (const k of Object.keys(images)) site.images[k] = images[k];
  html = html.replace('<!--SITE_DATA-->', `<script>window.SITE=${JSON.stringify(site).replace(/</g, '\\u003c')};</script>`);

  // Imágenes: cada referencia img/archivo apunta a la versión subida desde el back office o a la original
  html = html.replace(/url\((["']?)img\/([\w-]+\.(?:webp|png|jpe?g|svg|gif))\1\)/g, (m, q, k) => (hidden.has(k) ? 'none' : m));
  html = html.replace(/(["'(])img\/([\w-]+\.(?:webp|png|jpe?g|svg|gif))/g, (m, pre, k) => pre + imgUrl(k));

  html = html.replace('<!--SITE_TRACK-->', preview ? '' : TRACK);
  if (preview) html = html.replace('<body>', '<body data-preview="1">');
  return html;
}
