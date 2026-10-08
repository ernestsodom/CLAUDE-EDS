import { renderPage, listPages, ICONS, ICON_NAMES, FONT_AXES } from './render.js';
import { DEFAULT_CONTENT } from './defaults.js';

// ---------------- utilidades ----------------
const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const get = (o, path) => (!path ? o : path.split('.').reduce((a, k) => (a == null ? a : a[k]), o));
function set(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks.at(-1)] = v;
}
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter((x) => x != null && x !== false));
const svg = (name) => h('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.check}</svg>`, style: 'display:contents' });
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
let toastT;
function toast(msg, err = false) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 3200);
}
async function api(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (r.status === 401) { showLogin('Tu sesión expiró. Ingresa la clave de nuevo; tus cambios siguen aquí.'); throw new Error('auth'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error del servidor');
  return j;
}

// ---------------- estado ----------------
let content = null, savedJSON = '', current = 'hero', previewPath = '/', previewAnchor = 'inicio';
const openItems = new WeakSet();
const dirty = () => JSON.stringify(content) !== savedJSON;
function changed({ rerender = false } = {}) {
  const d = dirty();
  $('save').disabled = !d;
  const st = $('status'); st.classList.toggle('dirty', d);
  st.querySelector('span').textContent = d ? 'Cambios sin guardar' : 'Todo guardado';
  try { d ? localStorage.setItem('parock-draft', JSON.stringify(content)) : localStorage.removeItem('parock-draft'); } catch {}
  if (rerender) renderEditor();
  schedulePreview();
}

// ---------------- campos ----------------
const linkTargets = () => [
  ['/#inicio', 'Inicio: portada'], ['/#nosotros', 'Inicio: sección Nosotros'], ['/#propuesta', 'Inicio: sección Propuesta'],
  ['/#vision', 'Inicio: visión de la categoría'], ['/#por-que', 'Inicio: ¿Por qué PAROCK?'], ['/#portafolio', 'Inicio: sección Portafolio'],
  ['/#contacto', 'Inicio: formulario de contacto'],
  ...listPages(content).filter((p) => p.path !== '/').map((p) => [p.path, 'Página: ' + p.label]),
  ['/propuesta#tendencias', 'Página Propuesta: tendencias']
];

function fText(f, ctx) {
  const id = 'f' + Math.random().toString(36).slice(2, 9);
  const multi = f.type === 'textarea';
  const inp = h(multi ? 'textarea' : 'input', { id, class: 'in', rows: f.rows || 3, placeholder: f.placeholder || '', type: f.type === 'number' ? 'number' : 'text', min: f.min, max: f.max });
  inp.value = get(ctx, f.key) ?? '';
  inp.dataset.key = f.key;
  inp.addEventListener('input', () => {
    const old = get(ctx, f.key);
    set(ctx, f.key, f.type === 'number' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value);
    f.onInput && f.onInput(ctx, inp.value, old, inp);
    changed({ rerender: false });
    if (f.retitle) f.retitle();
  });
  return h('div', { class: 'f' }, h('label', { for: id }, f.label), inp,
    f.bold ? h('div', { class: 'help', html: 'Tip: escribe <b>**así**</b> para poner palabras en <b>negrita</b>.' + (f.help ? ' ' + f.help : '') }) : f.help ? h('div', { class: 'help' }, f.help) : null);
}

function fToggle(f, ctx) {
  const inp = h('input', { type: 'checkbox' }); inp.checked = !!get(ctx, f.key);
  inp.addEventListener('change', () => { set(ctx, f.key, inp.checked); changed({ rerender: !!f.rerender }); });
  return h('div', { class: 'f' }, h('label', { class: 'switch' }, inp, f.label), f.help ? h('div', { class: 'help' }, f.help) : null);
}

function fChoice(f, ctx) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': f.label });
  for (const [v, l] of f.options) {
    const b = h('button', { type: 'button', class: get(ctx, f.key) === v ? 'on' : '' }, l);
    b.addEventListener('click', () => { set(ctx, f.key, v); changed({ rerender: true }); });
    wrap.append(b);
  }
  return h('div', { class: 'f' }, h('span', { class: 'lbl' }, f.label), wrap, f.help ? h('div', { class: 'help' }, f.help) : null);
}

function fIcon(f, ctx) {
  const wrap = h('div', { class: 'icons' });
  const draw = () => {
    wrap.innerHTML = '';
    for (const k of Object.keys(ICONS)) {
      const b = h('button', { type: 'button', title: ICON_NAMES[k] || k, 'aria-label': ICON_NAMES[k] || k, class: get(ctx, f.key) === k ? 'on' : '', html: `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>` });
      b.addEventListener('click', () => { set(ctx, f.key, k); draw(); changed(); });
      wrap.append(b);
    }
  };
  draw();
  return h('div', { class: 'f' }, h('span', { class: 'lbl' }, f.label || 'Ícono'), wrap);
}

function fButton(f, ctx) {
  if (f.key && !get(ctx, f.key)) set(ctx, f.key, { label: '', href: '' });
  const b = get(ctx, f.key);
  const id = 'b' + Math.random().toString(36).slice(2, 9);
  const label = h('input', { class: 'in', id, placeholder: 'Ej: Ver más' }); label.value = b.label || '';
  label.addEventListener('input', () => { b.label = label.value; changed(); f.retitle && f.retitle(); });
  const opts = linkTargets();
  const known = opts.some(([v]) => v === b.href);
  const sel = h('select', { class: 'in', 'aria-label': '¿A dónde lleva el botón?' },
    ...opts.map(([v, l]) => h('option', { value: v }, l)), h('option', { value: '__custom' }, 'Otra dirección (escribirla)…'));
  sel.value = known ? b.href : '__custom';
  const custom = h('input', { class: 'in custom', placeholder: 'https://… o mailto:correo@… o /pagina' }); custom.value = b.href || '';
  custom.hidden = known;
  sel.addEventListener('change', () => { if (sel.value === '__custom') { custom.hidden = false; custom.focus(); } else { custom.hidden = true; b.href = sel.value; custom.value = sel.value; changed(); } });
  custom.addEventListener('input', () => { b.href = custom.value; changed(); });
  const extra = [];
  if (f.styles) {
    const st = h('select', { class: 'in', 'aria-label': 'Estilo del botón' }, h('option', { value: 'gold' }, 'Estilo: dorado (principal)'), h('option', { value: 'line' }, 'Estilo: contorno'), h('option', { value: 'light' }, 'Estilo: blanco (sobre fondo oscuro)'));
    st.value = b.style || 'gold'; st.addEventListener('change', () => { b.style = st.value; changed(); });
    extra.push(st);
  }
  return h('div', { class: 'f' }, h('label', { for: id }, f.label || 'Botón'),
    h('div', { class: 'btnf' }, label, sel, custom, ...extra),
    h('div', { class: 'help' }, f.help || 'Escribe el texto del botón y elige a qué página o sección lleva. Si dejas el texto vacío, el botón no se muestra.'));
}

// ---- imágenes ----
async function compress(file) {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return readDataUrl(file);
  const bmp = await createImageBitmap(file);
  const max = 1800, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const type = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  let q = 0.86, out = cv.toDataURL(type, q);
  while (out.length > 2_800_000 && q > 0.4) { q -= 0.12; out = cv.toDataURL(type, q); }
  return out;
}
const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function upload(file) {
  if (!/^image\//.test(file.type)) throw new Error('Ese archivo no es una imagen.');
  const dataUrl = await compress(file);
  const { src } = await api('/api/upload', { method: 'POST', body: JSON.stringify({ dataUrl, name: file.name }) });
  return { src, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') };
}
function pickFiles(multiple) {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept: 'image/*', multiple });
    i.addEventListener('change', () => res([...i.files])); i.click();
  });
}
function dropZone(el, onFiles) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drag'); const fs = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type)); if (fs.length) onFiles(fs); });
}

function fImage(f, ctx) {
  const wrap = h('div', { class: 'f' });
  const draw = () => {
    const im = get(ctx, f.key) || { src: '', alt: '' };
    const thumb = h('div', { class: 'thumb' }, im.src ? h('img', { src: im.src, alt: '' }) : 'Arrastra una foto aquí');
    const busy = (on) => { if (on) thumb.append(h('div', { class: 'loading' }, 'Subiendo…')); };
    const doUpload = async (files) => {
      busy(true);
      try { const up = await upload(files[0]); set(ctx, f.key, { src: up.src, alt: im.alt || up.alt }); toast('Foto subida'); changed(); }
      catch (e) { if (e.message !== 'auth') toast(e.message, true); }
      draw();
    };
    dropZone(thumb, doUpload);
    const altIn = h('input', { class: 'in', placeholder: 'Describe la foto (para Google y accesibilidad)' }); altIn.value = im.alt || '';
    altIn.addEventListener('input', () => { set(ctx, f.key, { ...(get(ctx, f.key) || {}), alt: altIn.value }); changed(); });
    put(wrap, h('span', { class: 'lbl' }, f.label),
      h('div', { class: 'imgf' }, thumb, h('div', { class: 'acts' },
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { type: 'button', class: 'btn pri', onclick: async () => { const fs = await pickFiles(false); if (fs.length) doUpload(fs); } }, im.src ? 'Cambiar foto' : 'Subir foto'),
          im.src && f.optional ? h('button', { type: 'button', class: 'btn danger', onclick: () => { set(ctx, f.key, { src: '', alt: '' }); changed(); draw(); } }, 'Quitar') : null),
        altIn)),
      h('div', { class: 'help' }, f.help || 'JPG, PNG o WebP. La foto se optimiza automáticamente antes de subirla.'));
  };
  draw();
  return wrap;
}

function fGallery(f, ctx) {
  const wrap = h('div', { class: 'f' });
  const list = () => { let a = get(ctx, f.key); if (!Array.isArray(a)) { a = []; set(ctx, f.key, a); } return a; };
  const draw = () => {
    const a = list();
    const grid = h('div', { class: 'gal' });
    a.forEach((im, i) => {
      const altIn = h('input', { placeholder: 'Descripción', 'aria-label': `Descripción de la foto ${i + 1}` }); altIn.value = im.alt || '';
      altIn.addEventListener('input', () => { im.alt = altIn.value; changed(); });
      grid.append(h('div', { class: 'gi' }, h('div', { class: 'ph' }, h('img', { src: im.src, alt: '' })),
        h('div', { class: 'ga' },
          h('button', { type: 'button', title: 'Mover a la izquierda', 'aria-label': 'Mover a la izquierda', disabled: i === 0, onclick: () => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } }, '←'),
          h('button', { type: 'button', class: 'del', title: 'Quitar foto', 'aria-label': 'Quitar foto', onclick: () => { a.splice(i, 1); changed(); draw(); } }, '✕'),
          h('button', { type: 'button', title: 'Mover a la derecha', 'aria-label': 'Mover a la derecha', disabled: i === a.length - 1, onclick: () => { [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed(); draw(); } }, '→')),
        altIn));
    });
    const add = h('button', { type: 'button', class: 'gnew' }, '+ Agregar fotos', h('br'), h('small', { style: 'font-weight:400;color:var(--muted)' }, 'o arrástralas aquí'));
    const doUp = async (files) => {
      add.textContent = `Subiendo ${files.length}…`;
      for (const file of files) { try { a.push(await upload(file)); } catch (e) { if (e.message !== 'auth') toast(e.message, true); } }
      toast(files.length > 1 ? 'Fotos agregadas' : 'Foto agregada'); changed(); draw();
    };
    add.addEventListener('click', async () => { const fs = await pickFiles(true); if (fs.length) doUp(fs); });
    dropZone(add, doUp);
    grid.append(add);
    put(wrap, h('span', { class: 'lbl' }, f.label), grid,
      h('div', { class: 'help' }, f.help || (a.length > 1 ? `Con ${a.length} fotos se muestra como carrusel (pasa solo y con flechas).` : 'Con una foto se muestra fija. Agrega 2 o más para que sea un carrusel.')));
  };
  draw();
  return wrap;
}

function fStrings(f, ctx) {
  const wrap = h('div', { class: 'f' });
  const draw = () => {
    let a = get(ctx, f.key); if (!Array.isArray(a)) { a = []; set(ctx, f.key, a); }
    const box = h('div', { class: 'strs' });
    a.forEach((s, i) => {
      const inp = h('input', { class: 'in', 'aria-label': `${f.label} ${i + 1}` }); inp.value = s;
      inp.addEventListener('input', () => { a[i] = inp.value; changed(); });
      box.append(h('div', { class: 'sr' }, inp,
        h('button', { type: 'button', title: 'Subir', 'aria-label': 'Subir', disabled: !i, onclick: () => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } }, '↑'),
        h('button', { type: 'button', title: 'Quitar', 'aria-label': 'Quitar', style: 'color:var(--err)', onclick: () => { a.splice(i, 1); changed(); draw(); } }, '✕')));
    });
    box.append(h('button', { type: 'button', class: 'btn add', onclick: () => { a.push(''); changed(); draw(); wrap.querySelectorAll('input').forEach((x, k, all) => k === all.length - 1 && x.focus()); } }, `+ Agregar ${f.itemLabel || 'línea'}`));
    put(wrap, h('span', { class: 'lbl' }, f.label), box, f.help ? h('div', { class: 'help' }, f.help) : null);
  };
  draw();
  return wrap;
}

function confirmBtn(btn, label, onConfirm) {
  let armed = false, t;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!armed) { armed = true; btn.classList.add('confirm'); const old = btn.innerHTML; btn.textContent = label; t = setTimeout(() => { armed = false; btn.classList.remove('confirm'); btn.innerHTML = old; }, 3000); return; }
    clearTimeout(t); onConfirm();
  });
  return btn;
}

function fList(f, ctx) {
  const wrap = h('div', { class: 'f' });
  const draw = () => {
    let a = get(ctx, f.key); if (!Array.isArray(a)) { a = []; set(ctx, f.key, a); }
    const box = h('div', { class: 'list' });
    a.forEach((item, i) => {
      const ttl = h('span', { class: 'ttl' });
      const retitle = () => { ttl.textContent = (f.title ? f.title(item) : '') || `${f.itemLabel} ${i + 1}`; };
      retitle();
      const el = h('div', { class: 'item' + (openItems.has(item) ? ' open' : '') });
      const body = h('div', { class: 'body' });
      const fill = () => { body.replaceChildren(...f.fields.map((sf) => field({ ...sf, retitle }, item))); };
      if (openItems.has(item)) fill(); else body.hidden = true;
      const header = h('header', { role: 'button', tabindex: 0, 'aria-expanded': String(openItems.has(item)) },
        h('span', { class: 'chev' }, '▶'), h('span', { class: 'num' }, i + 1), ttl,
        h('span', { class: 'tools' },
          h('button', { type: 'button', title: 'Subir', 'aria-label': 'Subir', disabled: !i, onclick: (e) => { e.stopPropagation(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } }, '↑'),
          h('button', { type: 'button', title: 'Bajar', 'aria-label': 'Bajar', disabled: i === a.length - 1, onclick: (e) => { e.stopPropagation(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed(); draw(); } }, '↓'),
          h('button', { type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: (e) => { e.stopPropagation(); const cp = clone(item); if (cp.slug) cp.slug = cp.slug + '-copia'; a.splice(i + 1, 0, cp); openItems.add(cp); changed(); draw(); } }, '⧉'),
          confirmBtn(h('button', { type: 'button', class: 'del', title: 'Eliminar', 'aria-label': 'Eliminar' }, '✕'), '¿Eliminar?', () => { a.splice(i, 1); changed(); draw(); toast('Elemento eliminado. Puedes deshacerlo desde Historial si ya habías guardado.'); })));
      const toggle = () => {
        if (openItems.has(item)) { openItems.delete(item); el.classList.remove('open'); body.hidden = true; }
        else { openItems.add(item); el.classList.add('open'); fill(); body.hidden = false; }
        header.setAttribute('aria-expanded', String(openItems.has(item)));
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      el.append(header, body);
      box.append(el);
    });
    if (!f.max || a.length < f.max) box.append(h('button', { type: 'button', class: 'btn add', onclick: () => { const n = f.make ? f.make() : {}; a.push(n); openItems.add(n); changed(); draw(); } }, `+ Agregar ${f.itemLabel.toLowerCase()}`));
    put(wrap, h('span', { class: 'lbl' }, f.label), f.help ? h('div', { class: 'help', style: 'margin:-2px 0 10px' }, f.help) : null, box);
  };
  draw();
  return wrap;
}

function field(f, ctx) {
  if (f.showIf && !f.showIf(ctx)) return null;
  switch (f.type) {
    case 'group': return h('div', { class: 'card' }, h('h3', {}, f.label), f.help ? h('p', { class: 'help', style: 'margin:-8px 0 14px' }, f.help) : null, ...f.fields.map((x) => field({ ...x, retitle: x.retitle || f.retitle }, ctx)));
    case 'row': return h('div', { class: 'row2' }, ...f.fields.map((x) => field({ ...x, retitle: x.retitle || f.retitle }, ctx)));
    case 'toggle': return fToggle(f, ctx);
    case 'choice': return fChoice(f, ctx);
    case 'icon': return fIcon(f, ctx);
    case 'button': return fButton(f, ctx);
    case 'image': return fImage(f, ctx);
    case 'gallery': return fGallery(f, ctx);
    case 'strings': return fStrings(f, ctx);
    case 'list': return fList(f, ctx);
    default: return fText(f, ctx);
  }
}

// ---------------- esquema (qué se edita en cada sección) ----------------
const T = (key, label, extra = {}) => ({ type: 'text', key, label, ...extra });
const TA = (key, label, extra = {}) => ({ type: 'textarea', key, label, bold: true, ...extra });
const G = (label, fields, extra = {}) => ({ type: 'group', label, fields, ...extra });
const R = (...fields) => ({ type: 'row', fields });
const BTN = (key, label, extra = {}) => ({ type: 'button', key, label, ...extra });
const IMG = (key, label, extra = {}) => ({ type: 'image', key, label, ...extra });
const GAL = (key, label, extra = {}) => ({ type: 'gallery', key, label, ...extra });
const LIST = (key, label, itemLabel, fields, extra = {}) => ({ type: 'list', key, label, itemLabel, fields, ...extra });
const STR = (key, label, extra = {}) => ({ type: 'strings', key, label, ...extra });

const productFields = [
  G('Datos básicos', [
    T('name', 'Nombre del producto', { onInput: (p, v, old, inp) => { if (!p.slug || p.slug === slugify(old)) { p.slug = slugify(v); const s = inp.closest('.body')?.querySelector('[data-key="slug"]'); if (s) s.value = p.slug; } } }),
    T('slug', 'Dirección de su página', { help: 'Aparece en el enlace: parock.cl/portafolio/esta-direccion. Solo minúsculas y guiones.', onInput: (p, v, old, inp) => { p.slug = slugify(v); } }),
    T('category', 'Categoría (texto pequeño de color)', { placeholder: 'Ej: Alimento húmedo · Gatos' }),
    { type: 'toggle', key: 'featured', label: 'Producto destacado' }
  ]),
  G('Textos', [
    TA('short', 'Frase corta (aparece en tarjetas)', { rows: 2, bold: false }),
    TA('claim', 'Mensaje principal', { rows: 2 }),
    TA('description', 'Descripción completa', { rows: 5, help: 'Deja una línea en blanco para separar párrafos.' })
  ]),
  G('Fotos', [
    IMG('image', 'Foto principal del envase', { help: 'Usa el envase original, idealmente con fondo claro.' }),
    GAL('gallery', 'Fotos adicionales (carrusel en la ficha)')
  ]),
  G('Características', [
    LIST('features', 'Características destacadas', 'Característica', [{ type: 'icon', key: 'icon' }, T('title', 'Título'), TA('text', 'Detalle', { rows: 2, bold: false })], { title: (x) => x.title, make: () => ({ icon: 'check', title: '', text: '' }) }),
    STR('benefits', 'Beneficios (franja oscura de la ficha)', { itemLabel: 'beneficio' }),
    STR('chips', 'Etiquetas pequeñas', { itemLabel: 'etiqueta', help: 'Ej: "Sin conservantes", "3 sabores".' })
  ]),
  G('Variedades y ficha técnica', [
    LIST('variants', 'Variedades / sabores', 'Variedad', [T('name', 'Nombre'), IMG('image', 'Foto de la variedad')], { title: (x) => x.name, make: () => ({ name: '', image: { src: '', alt: '' } }) }),
    LIST('specs', 'Ficha técnica', 'Dato', [R(T('label', 'Dato (ej: Formato)'), T('value', 'Valor (ej: Lata 400 g)'))], { title: (x) => [x.label, x.value].filter(Boolean).join(': '), make: () => ({ label: '', value: '' }), help: 'El dato "Formato" se muestra también en la tarjeta del producto.' })
  ])
];

const newProduct = () => ({ slug: '', name: 'Nuevo producto', category: '', featured: false, claim: '', short: '', description: '', image: { src: '', alt: '' }, gallery: [], features: [], benefits: [], variants: [], specs: [{ label: 'Formato', value: '' }], chips: [] });

const SECTIONS = [
  { group: 'Página de inicio' },
  { id: 'hero', icon: 'home', title: 'Portada', desc: 'Lo primero que ve un visitante. Puedes usar la portada clásica (gato y perro) o un carrusel de fotos a pantalla completa.', pv: ['/', 'inicio'], fields: [
    { type: 'choice', key: 'hero.mode', label: 'Tipo de portada', options: [['classic', 'Clásica (gato y perro)'], ['carousel', 'Carrusel de fotos']] },
    G('Portada clásica', [
      R(IMG('hero.leftImage', 'Foto izquierda', { optional: true }), IMG('hero.rightImage', 'Foto derecha', { optional: true })),
      { type: 'toggle', key: 'hero.showLogo', label: 'Mostrar el logo grande' },
      TA('hero.title', 'Título principal', { rows: 2 }),
      TA('hero.subtitle', 'Texto bajo el título', { rows: 2, bold: false }),
      LIST('hero.buttons', 'Botones', 'Botón', [BTN('', 'Botón', { styles: true })], { title: (b) => b.label, make: () => ({ label: 'Nuevo botón', href: '/#contacto', style: 'line' }), max: 3 }),
      { type: 'toggle', key: 'hero.showBrands', label: 'Mostrar logos de las marcas' },
      T('hero.brandsLabel', 'Texto sobre los logos')
    ], { showIf: (c) => c.hero?.mode !== 'carousel' }),
    G('Carrusel de portada', [
      LIST('hero.slides', 'Diapositivas', 'Diapositiva', [IMG('image', 'Foto de fondo', { help: 'Foto horizontal grande (mínimo 1600 px de ancho).' }), TA('title', 'Título', { rows: 2 }), TA('text', 'Texto', { rows: 2, bold: false }), BTN('button', 'Botón')],
        { title: (s) => (s.title || '').replace(/\*\*/g, ''), make: () => ({ image: { src: '', alt: '' }, title: 'Nuevo título', text: '', button: { label: '', href: '/#contacto' } }) }),
      { type: 'number', key: 'hero.autoplay', label: 'Segundos entre diapositivas', min: 0, max: 30, help: 'Pon 0 para que no avance solo.' },
      { type: 'toggle', key: 'hero.showLogo', label: 'Mostrar el logo sobre la primera diapositiva' }
    ], { showIf: (c) => c.hero?.mode === 'carousel' })
  ] },
  { id: 'about', icon: 'user', title: 'Nosotros', desc: 'Resumen de la empresa en la página de inicio. El botón "Ver más" lleva a la página completa de Nosotros.', pv: ['/', 'nosotros'], fields: [
    G('Textos', [T('about.eyebrow', 'Etiqueta superior'), TA('about.title', 'Título', { rows: 2 }), TA('about.lead1', 'Párrafo 1', { bold: false }), TA('about.lead2', 'Párrafo 2', { bold: false })]),
    G('Cifras destacadas', [LIST('about.facts', 'Cifras', 'Cifra', [R(T('value', 'Número (ej: +30)'), T('label', 'Descripción'))], { title: (x) => `${x.value} ${x.label}`, make: () => ({ value: '', label: '' }) })]),
    G('Fotos y alianza', [GAL('about.images', 'Fotos (1 = fija, 2 o más = carrusel)'), T('about.badgeTitle', 'Recuadro sobre la foto: título', { help: 'Déjalo vacío para ocultar el recuadro.' }), T('about.badgeText', 'Recuadro sobre la foto: texto')]),
    G('Equipo', [LIST('about.team', 'Personas', 'Persona', [IMG('photo', 'Foto'), R(T('name', 'Nombre'), T('role', 'Cargo / experiencia')), TA('bio', 'Biografía corta', { bold: false }),
      LIST('highlights', 'Logros (solo en la página Nosotros)', 'Logro', [T('title', 'Título'), TA('text', 'Detalle', { rows: 2, bold: false })], { title: (x) => x.title, make: () => ({ title: '', text: '' }) })],
      { title: (x) => x.name, make: () => ({ photo: { src: '', alt: '' }, name: 'Nueva persona', role: '', bio: '', highlights: [] }) })]),
    G('Botón "Ver más"', [BTN('about.more', 'Botón hacia la página Nosotros')])
  ] },
  { id: 'proposal', icon: 'layers', title: 'Nuestra propuesta', desc: 'Los pilares de la propuesta de valor. El botón "Ver más" lleva a la página completa.', pv: ['/', 'propuesta'], fields: [
    G('Textos', [T('proposal.eyebrow', 'Etiqueta superior'), TA('proposal.title', 'Título', { rows: 2 }), TA('proposal.lead', 'Bajada', { bold: false })]),
    G('Pilares', [LIST('proposal.pillars', 'Pilares', 'Pilar', [{ type: 'icon', key: 'icon' }, T('title', 'Título'), TA('text', 'Texto corto (inicio)', { rows: 2, bold: false }), TA('long', 'Texto largo (página Propuesta)', { rows: 3, bold: false })], { title: (x) => x.title, make: () => ({ icon: 'check', title: 'Nuevo pilar', text: '', long: '' }) })]),
    G('Botón "Ver más"', [BTN('proposal.more', 'Botón hacia la página Propuesta')])
  ] },
  { id: 'vision', icon: 'chart', title: 'Visión de la categoría', desc: 'Franja oscura con la cita, tendencias y cifras de mercado.', pv: ['/', 'vision'], fields: [
    G('Textos', [T('vision.eyebrow', 'Etiqueta superior'), TA('vision.quote', 'Cita destacada', { rows: 2 }), TA('vision.lead', 'Texto', { bold: false }), GAL('vision.images', 'Fotos')]),
    G('Tendencias', [LIST('vision.trends', 'Tendencias', 'Tendencia', [R(T('kpi', 'Cifra (ej: 82%)'), T('kpiLabel', 'Texto junto a la cifra')), T('title', 'Título'), TA('text', 'Texto', { rows: 2, bold: false })], { title: (x) => x.title, make: () => ({ kpi: '', kpiLabel: '', title: '', text: '' }) })]),
    G('Cifras de mercado', [LIST('vision.stats', 'Cifras', 'Cifra', [R(T('value', 'Número'), T('label', 'Descripción'))], { title: (x) => `${x.value} ${x.label}`, make: () => ({ value: '', label: '' }) }), T('vision.source', 'Fuente de los datos')]),
    G('Botón "Ver más"', [BTN('vision.more', 'Botón hacia tendencias')])
  ] },
  { id: 'why', icon: 'star', title: '¿Por qué PAROCK?', desc: 'Lista de servicios que ofrecemos a nuestros clientes.', pv: ['/', 'por-que'], fields: [
    G('Textos', [T('why.eyebrow', 'Etiqueta superior'), TA('why.title', 'Título', { rows: 2 })]),
    G('Servicios', [LIST('why.items', 'Servicios', 'Servicio', [T('title', 'Servicio'), T('text', 'Detalle (opcional)')], { title: (x) => x.title, make: () => ({ title: 'Nuevo servicio', text: '' }) })]),
    G('Foto y botón', [IMG('why.image', 'Foto lateral', { optional: true }), BTN('why.button', 'Botón')])
  ] },
  { id: 'portfolio', icon: 'gift', title: 'Portafolio (resumen)', desc: 'En el inicio se muestra un resumen sencillo: carrusel, marcas y lista de productos. Los productos se editan en "Marcas y productos".', pv: ['/', 'portafolio'], fields: [
    G('Textos del inicio', [T('portfolio.eyebrow', 'Etiqueta superior'), TA('portfolio.title', 'Título', { rows: 2 }), TA('portfolio.lead', 'Bajada', { bold: false })]),
    G('Carrusel de productos', [GAL('portfolio.images', 'Fotos del portafolio', { help: 'Fotos horizontales. Con 2 o más se muestra como carrusel.' })]),
    G('Botón "Ver más"', [BTN('portfolio.more', 'Botón hacia el portafolio completo')])
  ] },
  { id: 'contact', icon: 'mail', title: 'Contacto', desc: 'Datos de contacto y formulario. Los mensajes que llegan se ven en "Mensajes recibidos".', pv: ['/', 'contacto'], fields: [
    G('Textos', [T('contact.eyebrow', 'Etiqueta superior'), TA('contact.title', 'Título', { rows: 2 }), TA('contact.lead', 'Bajada', { bold: false })]),
    G('Datos', [T('contact.company', 'Nombre en el recuadro', { bold: true }), TA('contact.address', 'Dirección', { rows: 2, bold: false }), R(T('contact.email', 'Correo comercial'), T('contact.phone', 'Teléfono (opcional)')), T('contact.mapUrl', 'Enlace al mapa (Google Maps)'), T('contact.mailButton', 'Texto del botón de correo', { help: 'Déjalo vacío para ocultar el botón.' })]),
    G('Formulario', [R(T('contact.labels.nombre', 'Etiqueta: nombre'), T('contact.labels.empresa', 'Etiqueta: empresa')), R(T('contact.labels.email', 'Etiqueta: correo'), T('contact.labels.mensaje', 'Etiqueta: mensaje')),
      TA('contact.consent', 'Texto de aceptación', { rows: 2, bold: false }), T('contact.submit', 'Texto del botón Enviar'), TA('contact.success', 'Mensaje al enviar', { rows: 2, bold: false })])
  ] },
  { group: 'Subpáginas' },
  { id: 'aboutPage', icon: 'user', title: 'Página Nosotros', desc: 'Página completa /nosotros. El equipo y las cifras se editan en la sección "Nosotros".', pv: ['/nosotros', ''], fields: [
    G('Encabezado', [TA('aboutPage.title', 'Título', { rows: 2 }), TA('aboutPage.intro', 'Bajada', { rows: 2, bold: false }), IMG('aboutPage.heroImage', 'Foto del encabezado')]),
    G('Historia', [T('aboutPage.storyTitle', 'Título'), TA('aboutPage.story', 'Texto', { rows: 6, help: 'Deja una línea en blanco para separar párrafos.' }), GAL('aboutPage.gallery', 'Galería de fotos (carrusel)')]),
    G('Misión, visión y valores', [TA('aboutPage.mission', 'Misión', { bold: false }), TA('aboutPage.vision', 'Visión', { bold: false }), TA('aboutPage.valuesTitle', 'Título de valores', { rows: 1 }),
      LIST('aboutPage.values', 'Valores', 'Valor', [{ type: 'icon', key: 'icon' }, T('title', 'Título'), TA('text', 'Texto', { rows: 2, bold: false })], { title: (x) => x.title, make: () => ({ icon: 'check', title: '', text: '' }) })]),
    G('Equipo y alianza', [T('aboutPage.teamTitle', 'Título del equipo'), TA('aboutPage.allianceTitle', 'Título de la alianza', { rows: 1, help: 'Déjalo vacío para ocultar este bloque.' }), TA('aboutPage.allianceText', 'Texto de la alianza', { bold: false })])
  ] },
  { id: 'proposalPage', icon: 'target', title: 'Página Propuesta', desc: 'Página completa /propuesta: pilares, proceso, tendencias y datos de mercado.', pv: ['/propuesta', ''], fields: [
    G('Encabezado', [TA('proposalPage.title', 'Título', { rows: 2 }), TA('proposalPage.intro', 'Bajada', { rows: 2, bold: false }), IMG('proposalPage.heroImage', 'Foto del encabezado')]),
    G('Cómo trabajamos', [T('proposalPage.processTitle', 'Título'), LIST('proposalPage.process', 'Pasos', 'Paso', [T('title', 'Título'), TA('text', 'Texto', { rows: 2, bold: false })], { title: (x) => x.title, make: () => ({ title: '', text: '' }) })]),
    G('Tendencias', [TA('proposalPage.trendsTitle', 'Título', { rows: 1 }), LIST('proposalPage.trends', 'Tendencias', 'Tendencia', [{ type: 'icon', key: 'icon' }, T('title', 'Título'), T('quote', 'Frase del consumidor'), R(T('kpi', 'Cifra'), T('kpiLabel', 'Explicación de la cifra')), STR('points', 'Puntos', { itemLabel: 'punto' })], { title: (x) => x.title, make: () => ({ icon: 'check', title: '', quote: '', kpi: '', kpiLabel: '', points: [] }) }), T('proposalPage.trendsSource', 'Fuente')]),
    G('Mercado', [TA('proposalPage.marketTitle', 'Título', { rows: 1 }), LIST('proposalPage.market', 'Tarjetas de mercado', 'Tarjeta', [T('title', 'Título'), R(T('households', 'Cifra grande'), T('householdsLabel', 'Explicación')), R(T('cagr1', 'Crecimiento 2020–2025'), T('cagr2', 'Crecimiento 2025–2030')), T('volumes', 'Volumen')], { title: (x) => x.title, make: () => ({ title: '' }) }),
      T('proposalPage.penetrationTitle', 'Título del gráfico'), T('proposalPage.penetrationLead', 'Explicación del gráfico'),
      LIST('proposalPage.penetration', 'Barras del gráfico', 'Barra', [R(T('label', 'Categoría'), { type: 'number', key: 'value', label: 'Porcentaje (0 a 100)', min: 0, max: 100 })], { title: (x) => `${x.label} — ${x.value}%`, make: () => ({ label: '', value: 50 }) }),
      T('proposalPage.marketSource', 'Fuente')])
  ] },
  { id: 'brands', icon: 'paw', title: 'Marcas y productos', desc: 'Todas las marcas y sus productos. Cada producto tiene su propia página con ficha completa, y aparece automáticamente en el inicio y en el portafolio.', pv: ['/portafolio', ''], fields: [
    G('Página del portafolio completo', [TA('portfolio.pageTitle', 'Título', { rows: 1 }), TA('portfolio.pageIntro', 'Bajada', { rows: 2, bold: false })]),
    LIST('portfolio.brands', 'Marcas', 'Marca', [
      G('Marca', [R(T('name', 'Nombre de la marca'), T('slug', 'Identificador (sin espacios)')), IMG('logo', 'Logo de la marca', { help: 'Idealmente PNG con fondo transparente.' }), T('tag', 'Categoría (etiqueta)'), TA('description', 'Descripción corta', { rows: 2, bold: false }), TA('longDescription', 'Descripción larga (página portafolio)', { rows: 3, bold: false })]),
      LIST('products', 'Productos de esta marca', 'Producto', productFields, { title: (p) => p.name, make: newProduct })
    ], { title: (b) => `${b.name} (${(b.products || []).length} productos)`, make: () => ({ slug: 'nueva-marca', name: 'Nueva marca', logo: { src: '', alt: '' }, tag: '', description: '', longDescription: '', products: [] }) }),
    G('Bloque "Nuevas marcas"', [T('portfolio.coming.title', 'Título', { help: 'Déjalo vacío para ocultar el bloque.' }), TA('portfolio.coming.text', 'Texto', { rows: 2, bold: false }), BTN('portfolio.coming.button', 'Botón')])
  ] },
  { group: 'Diseño y general' },
  { id: 'theme', icon: 'flower', title: 'Colores y tipografías', desc: 'Cambia la paleta y las fuentes de todo el sitio. Mira el resultado en la vista previa antes de guardar.', pv: ['/', 'inicio'], custom: themeEditor },
  { id: 'menu', icon: 'layers', title: 'Menú y logos', desc: 'Logos del sitio, opciones del menú superior y el botón de contacto.', pv: ['/', 'inicio'], fields: [
    G('Logos', [R(IMG('site.logo', 'Logo (fondo claro)'), IMG('site.logoWhite', 'Logo (fondo oscuro, pie de página)')), T('site.name', 'Nombre de la empresa')]),
    G('Menú superior', [LIST('nav.items', 'Opciones del menú', 'Opción', [BTN('', 'Opción')], { title: (x) => x.label, make: () => ({ label: 'Nueva opción', href: '/' }) }), BTN('nav.cta', 'Botón destacado del menú')]),
    G('Textos generales', [T('site.moreLabel', 'Texto por defecto de los botones "Ver más"')])
  ] },
  { id: 'footer', icon: 'shield', title: 'Pie de página, SEO y privacidad', desc: 'Lo que aparece al final de cada página, lo que muestra Google y la política de privacidad.', pv: ['/privacidad', ''], fields: [
    G('Google y redes sociales', [T('site.metaTitle', 'Título en Google', { help: 'Recomendado: menos de 60 caracteres.' }), TA('site.metaDescription', 'Descripción en Google', { rows: 3, bold: false, help: 'Recomendado: entre 120 y 160 caracteres.' })]),
    G('Pie de página', [TA('footer.tagline', 'Frase', { rows: 2, bold: false }), T('footer.copyright', 'Derechos reservados')]),
    G('Política de privacidad', [T('footer.privacyLabel', 'Nombre del enlace'), TA('footer.privacyText', 'Texto completo', { rows: 10, bold: false, help: 'Deja una línea en blanco para separar párrafos.' })])
  ] },
  { id: 'messages', icon: 'mail', title: 'Mensajes recibidos', desc: 'Mensajes enviados desde el formulario de contacto del sitio.', pv: ['/', 'contacto'], custom: messagesView },
  { id: 'history', icon: 'clock', title: 'Historial de versiones', desc: 'Cada vez que guardas se crea una versión. Puedes volver a cualquiera de las últimas 30.', pv: null, custom: historyView }
];

// ---------------- colores y tipografías ----------------
const COLOR_INFO = [
  ['navy', 'Color principal', 'Menú, franjas oscuras y títulos'], ['gold', 'Dorado', 'Botones, etiquetas y detalles'], ['gold-2', 'Dorado claro', 'Degradado de botones y cifras'],
  ['gold-soft', 'Dorado suave', 'Bordes y fondos sutiles'], ['cream', 'Fondo crema', 'Fondo de secciones alternas'], ['ink', 'Texto', 'Color de los textos'],
  ['muted', 'Texto secundario', 'Bajadas y descripciones'], ['accent', 'Acento de productos', 'Categorías de producto']
];
const PRESETS = [
  ['Original PAROCK', DEFAULT_CONTENT.theme.colors],
  ['Marino y cobre', { navy: '#14213D', gold: '#B5653A', 'gold-2': '#D98E5F', 'gold-soft': '#F1D9C8', cream: '#F8F2EC', ink: '#1A1F2B', muted: '#5D6473', accent: '#D9534F' }],
  ['Verde bosque', { navy: '#173A2F', gold: '#B08D57', 'gold-2': '#D2B57E', 'gold-soft': '#EADFC8', cream: '#F4F3EC', ink: '#1C2622', muted: '#5B6862', accent: '#E07A3F' }],
  ['Grafito y coral', { navy: '#23262D', gold: '#E26D5A', 'gold-2': '#F29483', 'gold-soft': '#F8D5CD', cream: '#F6F4F2', ink: '#1F2126', muted: '#62666F', accent: '#2E86AB' }],
  ['Azul petróleo', { navy: '#0E3B4A', gold: '#C59B3C', 'gold-2': '#E0BE6A', 'gold-soft': '#F0E2BE', cream: '#F3F6F5', ink: '#13262D', muted: '#566A71', accent: '#E8743B' }],
  ['Vino y arena', { navy: '#3A1424', gold: '#B89062', 'gold-2': '#D6B488', 'gold-soft': '#EFE1CC', cream: '#F7F1EA', ink: '#2A1820', muted: '#6B5A60', accent: '#C8383A' }]
];
const HEAD_FONTS = ['Montserrat', 'Poppins', 'Raleway', 'Outfit', 'Plus Jakarta Sans', 'Playfair Display', 'Lora', 'Oswald', 'Josefin Sans'];
const BODY_FONTS = ['Inter', 'Open Sans', 'Lato', 'Nunito Sans', 'Source Sans 3', 'Work Sans', 'DM Sans', 'Roboto'];
(function loadPickerFonts() {
  const fams = [...new Set([...HEAD_FONTS, ...BODY_FONTS])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:${(FONT_AXES[f] || 'wght@400;700').replace(/wght@.*/, 'wght@400;700')}`).join('&');
  document.head.append(h('link', { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${fams}&display=swap` }));
})();

function themeEditor() {
  const t = content.theme; t.colors = { ...DEFAULT_CONTENT.theme.colors, ...(t.colors || {}) };
  const same = (c) => COLOR_INFO.every(([k]) => String(c[k]).toUpperCase() === String(t.colors[k]).toUpperCase());
  const presets = h('div', { class: 'presets' }, ...PRESETS.map(([n, c]) => h('button', { type: 'button', class: 'preset' + (same(c) ? ' on' : ''), onclick: () => { t.colors = { ...c }; changed({ rerender: true }); } },
    h('span', { class: 'sw' }, ...['navy', 'gold', 'gold-2', 'cream', 'accent'].map((k) => h('i', { style: `background:${c[k]}` }))), n)));
  const colors = h('div', { class: 'colors' }, ...COLOR_INFO.map(([k, n, d]) => {
    const pick = h('input', { type: 'color', 'aria-label': n }); pick.value = t.colors[k];
    const hex = h('input', { class: 'in', 'aria-label': `Código de ${n}`, maxlength: 7, spellcheck: 'false' }); hex.value = t.colors[k].toUpperCase();
    pick.addEventListener('input', () => { t.colors[k] = pick.value.toUpperCase(); hex.value = t.colors[k]; changed(); });
    hex.addEventListener('change', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { t.colors[k] = v.toUpperCase(); pick.value = v; changed(); } else { hex.value = t.colors[k]; toast('Usa un código como #A9864E', true); } });
    return h('div', { class: 'crow' }, pick, h('div', {}, h('strong', {}, n), h('small', {}, d)), hex);
  }));
  const fonts = (list, key, sample) => h('div', { class: 'fontpick' }, ...list.map((f) => h('button', { type: 'button', class: t[key] === f ? 'on' : '', onclick: () => { t[key] = f; changed({ rerender: true }); } },
    h('b', { style: `font-family:'${f}'` }, sample), h('span', {}, f))));
  return [
    h('div', { class: 'card' }, h('h3', {}, 'Paletas listas para usar'), presets),
    h('div', { class: 'card' }, h('h3', {}, 'Colores uno por uno'), colors),
    h('div', { class: 'card' }, h('h3', {}, 'Tipografía de títulos'), fonts(HEAD_FONTS, 'fontHead', 'Conectamos marcas')),
    h('div', { class: 'card' }, h('h3', {}, 'Tipografía de textos'), fonts(BODY_FONTS, 'fontBody', 'Desarrollo comercial')),
    h('div', { class: 'card' }, h('button', { type: 'button', class: 'btn', onclick: () => { content.theme = clone(DEFAULT_CONTENT.theme); changed({ rerender: true }); toast('Colores y fuentes originales restablecidos'); } }, 'Volver a los colores y fuentes originales'))
  ];
}

// ---------------- mensajes ----------------
let unread = 0;
async function loadUnread() {
  try { const { messages } = await api('/api/contact'); unread = messages.filter((m) => !m.leido).length; drawSide(); } catch {}
}
function messagesView() {
  const box = h('div', {}, h('div', { class: 'empty' }, 'Cargando mensajes…'));
  (async () => {
    try {
      const { messages } = await api('/api/contact');
      unread = messages.filter((m) => !m.leido).length; drawSide();
      if (!messages.length) return put(box, h('div', { class: 'empty' }, 'Aún no llegan mensajes. Cuando alguien complete el formulario de contacto, aparecerá aquí.'));
      put(box, ...messages.map((m) => {
        const el = h('article', { class: 'msg' + (m.leido ? '' : ' new') },
          h('header', {}, h('strong', {}, m.nombre), h('span', {}, m.empresa || ''), h('span', {}, '· ' + new Date(m.created_at).toLocaleString('es-CL'))),
          h('p', { style: 'color:var(--muted);margin-bottom:6px' }, m.email), h('p', {}, m.mensaje),
          h('div', { class: 'acts' },
            h('a', { class: 'btn pri', href: `mailto:${m.email}?subject=${encodeURIComponent('Re: contacto PAROCK')}` }, 'Responder por correo'),
            h('button', { type: 'button', class: 'btn', onclick: async () => { await api('/api/contact', { method: 'PATCH', body: JSON.stringify({ id: m.id, leido: !m.leido }) }); renderEditor(); } }, m.leido ? 'Marcar como no leído' : 'Marcar como leído'),
            confirmBtn(h('button', { type: 'button', class: 'btn danger' }, 'Eliminar'), 'Confirmar eliminación', async () => { await api('/api/contact?id=' + m.id, { method: 'DELETE' }); toast('Mensaje eliminado'); renderEditor(); })));
        return el;
      }));
    } catch (e) { if (e.message !== 'auth') put(box, h('div', { class: 'empty' }, 'No se pudieron cargar los mensajes: ' + e.message)); }
  })();
  return [box];
}

// ---------------- historial ----------------
function historyView() {
  const box = h('div', {}, h('div', { class: 'empty' }, 'Cargando versiones…'));
  (async () => {
    try {
      const { versions } = await api('/api/content?history=1');
      const rows = versions.map((v, i) => h('div', { class: 'hist' },
        h('div', {}, h('strong', {}, new Date(v.saved_at).toLocaleString('es-CL')), i === 0 ? h('span', { style: 'color:var(--ok);font-weight:600;margin-left:8px' }, 'versión actual') : null),
        i === 0 ? null : h('button', { type: 'button', class: 'btn', onclick: async () => {
          const { data } = await api('/api/content?version=' + v.id); content = data; changed({ rerender: false }); toast('Versión cargada. Revisa la vista previa y presiona "Guardar cambios" para publicarla.'); schedulePreview(true);
        } }, 'Cargar esta versión')));
      put(box, ...(rows.length ? rows : [h('div', { class: 'empty' }, 'Todavía no hay versiones guardadas.')]),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('h3', {}, 'Contenido original'), h('p', { class: 'help', style: 'margin-bottom:12px' }, 'Vuelve al contenido de la propuesta inicial. No se publica hasta que guardes.'),
          confirmBtn(h('button', { type: 'button', class: 'btn danger' }, 'Restablecer todo el contenido original'), 'Sí, restablecer', () => { content = clone(DEFAULT_CONTENT); changed(); toast('Contenido original cargado. Guarda para publicarlo.'); })));
    } catch (e) { if (e.message !== 'auth') put(box, h('div', { class: 'empty' }, 'No se pudo cargar el historial: ' + e.message)); }
  })();
  return [box];
}

// ---------------- render del editor ----------------
function drawSide() {
  const side = $('side'); side.innerHTML = '';
  for (const s of SECTIONS) {
    if (s.group) { side.append(h('h2', {}, s.group)); continue; }
    side.append(h('button', { type: 'button', class: s.id === current ? 'on' : '', 'aria-current': s.id === current ? 'page' : null, onclick: () => { current = s.id; drawSide(); renderEditor(); if (s.pv) goPreview(s.pv[0], s.pv[1]); $('editor').scrollTop = 0; } },
      svg(s.icon), s.title, s.id === 'messages' && unread ? h('span', { class: 'badge' }, unread) : null));
  }
}
function renderEditor() {
  const s = SECTIONS.find((x) => x.id === current);
  const ed = $('editor');
  const top = ed.scrollTop;
  const kids = s.custom ? s.custom() : s.fields.map((f) => (f.type === 'group' || f.type === 'list' || f.type === 'choice' ? field(f, content) : h('div', { class: 'card' }, field(f, content))));
  let draft = null;
  try { draft = localStorage.getItem('parock-draft'); } catch {}
  const recover = draft && !dirty() && draft !== savedJSON ? h('div', { class: 'card', style: 'border-color:var(--gold);background:#FFF8EC' },
    h('h3', {}, 'Tienes cambios sin guardar de una sesión anterior'),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      h('button', { type: 'button', class: 'btn gold', onclick: () => { content = JSON.parse(draft); changed({ rerender: true }); toast('Cambios recuperados'); } }, 'Recuperarlos'),
      h('button', { type: 'button', class: 'btn', onclick: () => { try { localStorage.removeItem('parock-draft'); } catch {} renderEditor(); } }, 'Descartarlos'))) : null;
  ed.replaceChildren(recover || '', h('div', { class: 'ed-head' }, h('h1', {}, s.title), h('p', {}, s.desc)), ...kids.filter(Boolean));
  ed.scrollTop = top;
}

// ---------------- vista previa ----------------
let pvTimer, pvSameDoc = false;
function fillPageSelect() {
  const sel = $('pv-page'); const pages = listPages(content);
  sel.replaceChildren(...pages.map((p) => h('option', { value: p.path }, p.label)));
  if (!pages.some((p) => p.path === previewPath)) previewPath = '/';
  sel.value = previewPath;
}
function goPreview(path, anchor) { previewPath = path; previewAnchor = anchor || ''; pvSameDoc = false; schedulePreview(true); }
function schedulePreview(now = false) { clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, now ? 0 : 350); }
function drawPreview() {
  if (!content) return;
  fillPageSelect();
  const fr = $('pv');
  const keepY = pvSameDoc ? (fr.contentWindow?.scrollY || 0) : null;
  const out = renderPage(content, previewPath, { preview: true });
  if (out.status === 302) { const [p, a] = out.location.split('#'); return goPreview(p, a); }
  fr.onload = () => {
    const doc = fr.contentDocument, win = fr.contentWindow;
    if (keepY != null) win.scrollTo(0, keepY);
    else if (previewAnchor) doc.getElementById(previewAnchor)?.scrollIntoView();
    pvSameDoc = true;
    doc.addEventListener('click', (e) => {
      const a = e.target.closest('a'); if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/^(mailto:|tel:)/.test(href)) { e.preventDefault(); toast('En la vista previa los enlaces de correo están desactivados'); return; }
      if (/^https?:/.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener'); return; }
      if (href.startsWith('#')) { e.preventDefault(); doc.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }); return; }
      if (href.startsWith('/')) {
        e.preventDefault();
        const [p, hash] = href.split('#'); const path = p || '/';
        if (path === previewPath && hash) { doc.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }); return; }
        goPreview(path, hash);
      }
    });
  };
  fr.srcdoc = out.html;
}

// ---------------- arranque ----------------
function showLogin(msg = '') {
  $('login').hidden = false; $('login-err').textContent = msg; $('pw').value = ''; setTimeout(() => $('pw').focus(), 50);
}
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; $('login-err').textContent = '';
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    if (!r.ok) { $('login-err').textContent = 'Clave incorrecta. Inténtalo de nuevo.'; return; }
    $('login').hidden = true;
    if (!content) await boot(); else toast('Sesión renovada. Ya puedes guardar.');
  } finally { btn.disabled = false; }
});

async function boot() {
  const { data } = await api('/api/content');
  content = { ...clone(DEFAULT_CONTENT), ...data }; savedJSON = JSON.stringify(content);
  $('app').hidden = false;
  drawSide(); renderEditor(); changed(); schedulePreview(true); loadUnread();
}

async function save() {
  if (!dirty()) return;
  const btn = $('save'); btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const snapshot = JSON.stringify(content);
    await api('/api/content', { method: 'PUT', body: JSON.stringify({ data: content }) });
    savedJSON = snapshot; toast('¡Listo! Los cambios ya están publicados en el sitio.');
  } catch (e) { if (e.message !== 'auth') toast('No se pudo guardar: ' + e.message, true); }
  finally { btn.textContent = 'Guardar cambios'; changed(); }
}

$('save').addEventListener('click', save);
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
window.addEventListener('beforeunload', (e) => { if (content && dirty()) { e.preventDefault(); e.returnValue = ''; } });
$('logout').addEventListener('click', async () => {
  if (dirty()) { toast('Tienes cambios sin guardar. Guárdalos antes de salir.', true); return; }
  await fetch('/api/login', { method: 'DELETE' }); location.reload();
});
$('pv-page').addEventListener('change', (e) => goPreview(e.target.value, ''));
$('pv-desk').addEventListener('click', () => { $('pv-wrap').classList.remove('mobile'); $('pv-desk').classList.add('on'); $('pv-mob').classList.remove('on'); });
$('pv-mob').addEventListener('click', () => { $('pv-wrap').classList.add('mobile'); $('pv-mob').classList.add('on'); $('pv-desk').classList.remove('on'); });
$('pv-open').addEventListener('click', () => { $('preview').classList.add('show'); schedulePreview(true); });
$('pv-close').addEventListener('click', () => $('preview').classList.remove('show'));

(async () => {
  const r = await fetch('/api/login').then((x) => x.json()).catch(() => ({ ok: false }));
  if (r.ok) boot().catch((e) => e.message !== 'auth' && toast(e.message, true)); else showLogin();
})();
