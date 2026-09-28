/* Back office Proexsi: edición de contenidos, diseño y panel de gestión. */
(function () {
  'use strict';

  // ---------- Estado ----------
  var C = null;        // contenido en edición
  var SAVED = '';      // última versión guardada (JSON) para detectar cambios
  var D = null;        // valores por defecto
  var M = null;        // metadatos (textos, secciones, imágenes)
  var FONTS = [];
  var charts = [];
  var statsDays = 30;

  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---------- Utilidades ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { add(el, x); });
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function api(a, opts) {
    opts = opts || {};
    return fetch('/api/admin?a=' + a + (opts.q || ''), {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && a !== 'login') { showLogin(); throw new Error(j.error || 'Sesión expirada'); }
        if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
        return j;
      });
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmt(n) { return Number(n || 0).toLocaleString('es-CL'); }
  function imgUrl(k) { return (C.images && C.images[k]) || ('/img/' + k); }
  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 400) + 'px'; }

  function markDirty() {
    var d = JSON.stringify(C) !== SAVED;
    $('#dirty').hidden = !d; $('#save').disabled = !d;
  }
  window.addEventListener('beforeunload', function (e) {
    if (C && JSON.stringify(C) !== SAVED) { e.preventDefault(); e.returnValue = ''; }
  });

  // Campo de texto enlazado a una ruta del contenido
  function bind(obj, key, opts) {
    opts = opts || {};
    var multi = opts.multi !== false;
    var inp = multi ? h('textarea', { rows: opts.rows || 2 }) : h('input', { type: opts.type || 'text' });
    inp.value = obj[key] == null ? '' : obj[key];
    inp.addEventListener('input', function () {
      obj[key] = opts.type === 'number' ? Number(inp.value) : inp.value;
      if (multi) autosize(inp);
      markDirty(); if (opts.onChange) opts.onChange();
    });
    if (multi) setTimeout(function () { autosize(inp); });
    return opts.label ? h('div', { class: 'field' }, h('label', { text: opts.label }), inp, opts.hint ? h('span', { class: 'hint', text: opts.hint }) : null) : inp;
  }

  // ---------- Carga de imágenes (se optimizan en el navegador antes de subir) ----------
  function pickFile(accept) {
    return new Promise(function (res) {
      var i = h('input', { type: 'file', accept: accept || 'image/*' });
      i.onchange = function () { res(i.files[0] || null); };
      i.click();
    });
  }
  function readAsDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  }
  function optimize(file, keepPng) {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return readAsDataUrl(file);
    return readAsDataUrl(file).then(function (src) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          var max = 2000, w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, max / Math.max(w, hh));
          var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(hh * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(keepPng ? c.toDataURL('image/png') : c.toDataURL('image/webp', 0.86));
        };
        img.onerror = function () { rej(new Error('No se pudo leer la imagen')); };
        img.src = src;
      });
    });
  }
  // Sube una foto y devuelve la clave con la que queda registrada
  function uploadImage(key, keepPng) {
    return pickFile('image/png,image/jpeg,image/webp,image/svg+xml').then(function (file) {
      if (!file) return null;
      toast('Subiendo imagen…');
      var png = keepPng || (file.type === 'image/png' && /logo/i.test(key || file.name));
      return optimize(file, png).then(function (dataUrl) {
        return api('upload', { method: 'POST', body: { name: file.name, dataUrl: dataUrl } });
      }).then(function (r) {
        var ext = r.url && /svg/.test(file.type) ? 'svg' : (png ? 'png' : 'webp');
        var k = key || ('subida-' + r.id + '.' + ext);
        C.images = C.images || {};
        C.images[k] = r.url;
        markDirty(); toast('Imagen cargada. Recuerda guardar los cambios.');
        return k;
      });
    }).catch(function (e) { toast(e.message, true); return null; });
  }
  function allImageKeys() {
    var ks = M.imageKeys.slice();
    Object.keys(C.images || {}).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); });
    return ks;
  }
  function imageSelect(current, onPick) {
    var sel = h('select', {});
    allImageKeys().forEach(function (k) { sel.appendChild(h('option', { value: k, text: (M.imageLabels[k] || k), selected: k === current })); });
    sel.addEventListener('change', function () { onPick(sel.value); });
    return sel;
  }

  // ---------- Vistas ----------
  var VIEWS = {
    resumen: { title: 'Panel de gestión', render: viewStats },
    solicitudes: { title: 'Solicitudes de demo', render: viewLeads },
    textos: { title: 'Textos del sitio', render: viewTexts },
    fotos: { title: 'Fotos y logo', render: viewImages },
    carrusel: { title: 'Carrusel de la portada', render: viewCarousel },
    productos: { title: 'Páginas de productos', render: viewProducts },
    nosotros: { title: 'Página Nosotros', render: viewAbout },
    diseno: { title: 'Colores y tipografía', render: viewDesign },
    ajustes: { title: 'SEO y ajustes', render: viewSettings },
    versiones: { title: 'Versiones guardadas', render: viewHistory },
  };

  function route() {
    var v = (location.hash.replace(/^#\/?/, '') || 'resumen');
    if (!VIEWS[v]) v = 'resumen';
    charts.forEach(function (c) { c.destroy(); }); charts = [];
    document.querySelectorAll('#menu a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-v') === v); });
    $('#view-title').textContent = VIEWS[v].title;
    var view = $('#view'); view.innerHTML = '';
    VIEWS[v].render(view);
    $('.side').classList.remove('open');
    window.scrollTo(0, 0);
  }

  // ===== Panel de gestión =====
  var SECTION_NAMES = { hero: 'Portada (carrusel)', productos: 'Productos', beneficios: 'Beneficios', integraciones: 'La Plataforma: diagrama', modulos: 'La Plataforma: módulos', preguntas: 'Preguntas frecuentes', contacto: 'Contacto' };
  function pageName(p) {
    if (p === '/') return 'Inicio';
    if (p === '/nosotros') return 'Nosotros';
    var m = /^\/producto\/(.+)$/.exec(p || '');
    if (m && C.products[m[1]]) return 'Producto: ' + C.products[m[1]].n;
    return p;
  }
  function delta(cur, prev) {
    if (!prev) return h('span', { class: 'delta eq', text: cur ? 'nuevo período' : '—' });
    var d = Math.round(100 * (cur - prev) / prev);
    return h('span', { class: 'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'eq'), text: (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(d) + '% vs. período anterior' });
  }
  var PALETTE = ['#1F5BD8', '#F26B1D', '#0FA396', '#6A4CF0', '#E23D8F', '#0EA0DC', '#1FA35C', '#8A94B5'];
  function chart(canvas, cfg) {
    if (!window.Chart) { canvas.parentNode.replaceChild(h('p', { class: 'empty', text: 'No se pudo cargar la librería de gráficos.' }), canvas); return; }
    Chart.defaults.font.family = '"Red Hat Text", system-ui, sans-serif';
    Chart.defaults.color = '#5A6583';
    charts.push(new Chart(canvas, cfg));
  }
  function listCard(title, rows, fmtKey) {
    var card = h('div', { class: 'card' }, h('h2', { text: title }));
    if (!rows.length) { card.appendChild(h('p', { class: 'empty', text: 'Aún no hay datos en este período.' })); return card; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }));
    var list = h('div', { class: 'list' });
    rows.forEach(function (r) {
      list.appendChild(h('div', { class: 'lrow' }, h('span', { text: fmtKey ? fmtKey(r.k) : r.k }), h('em', { text: fmt(r.v) }),
        h('div', { class: 'lbar' }, h('b', { style: { width: (100 * r.v / max) + '%' } }))));
    });
    card.appendChild(list);
    return card;
  }
  function viewStats(view) {
    var tools = h('div', { class: 'toolbar' },
      h('div', { class: 'seg' }, [7, 30, 90, 365].map(function (d) {
        return h('button', { class: statsDays === d ? 'on' : '', text: d === 365 ? '12 meses' : 'Últimos ' + d + ' días', onclick: function () { statsDays = d; route(); } });
      })),
      h('span', { class: 'hint', text: 'Visitas registradas por el sitio público (sin contar robots ni tu propia vista previa).' }));
    view.appendChild(tools);
    var box = h('div', { class: 'view', style: { padding: 0 } }, h('p', { class: 'empty', text: 'Cargando métricas…' }));
    view.appendChild(box);
    api('stats', { q: '&days=' + statsDays }).then(function (s) {
      box.innerHTML = '';
      var k = s.kpi, p = s.prev;
      box.appendChild(h('div', { class: 'kpis' },
        kpi('Visitas (páginas vistas)', fmt(k.pageviews), delta(k.pageviews, p.pageviews)),
        kpi('Visitantes únicos', fmt(k.visitors), delta(k.visitors, p.visitors)),
        kpi('Sesiones', fmt(k.sessions), delta(k.sessions, p.sessions)),
        kpi('Páginas por sesión', String(k.pagesPerSession).replace('.', ','), null),
        kpi('Solicitudes de demo', fmt(k.leads), delta(k.leads, p.leads)),
        kpi('Conversión', String(k.conversion).replace('.', ',') + '%', h('span', { class: 'delta eq', text: 'solicitudes / sesiones' }))));

      var c1 = h('canvas'), trend = h('div', { class: 'card' }, h('h2', { text: 'Visitas por día' }), h('div', { class: 'chart tall' }, c1));
      box.appendChild(trend);
      chart(c1, {
        data: {
          labels: s.series.map(function (r) { return r.d.slice(8, 10) + '/' + r.d.slice(5, 7); }),
          datasets: [
            { type: 'line', label: 'Visitas', data: s.series.map(function (r) { return r.pageviews; }), borderColor: '#1F5BD8', backgroundColor: 'rgba(31,91,216,.12)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
            { type: 'line', label: 'Visitantes únicos', data: s.series.map(function (r) { return r.visitors; }), borderColor: '#12B5E5', tension: .35, pointRadius: 0, borderWidth: 2 },
            { type: 'bar', label: 'Solicitudes de demo', data: s.series.map(function (r) { return r.leads; }), backgroundColor: '#F26B1D', borderRadius: 4, yAxisID: 'y2', maxBarThickness: 14 },
          ],
        },
        options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          scales: { y: { beginAtZero: true, grid: { color: '#EEF1F7' }, ticks: { precision: 0 } }, y2: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { precision: 0 } }, x: { grid: { display: false } } },
          plugins: { legend: { position: 'bottom' } } },
      });

      var c2 = h('canvas'), c3 = h('canvas');
      box.appendChild(h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', { text: 'Por dónde ingresan' }), s.sources.length ? h('div', { class: 'chart' }, c2) : h('p', { class: 'empty', text: 'Aún no hay datos en este período.' })),
        h('div', { class: 'card' }, h('h2', { text: 'Secciones más vistas' }), s.sections.length ? h('div', { class: 'chart' }, c3) : h('p', { class: 'empty', text: 'Aún no hay datos en este período.' }))));
      if (s.sources.length) chart(c2, { type: 'doughnut', data: { labels: s.sources.map(function (r) { return r.k; }), datasets: [{ data: s.sources.map(function (r) { return r.v; }), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
        options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } } });
      if (s.sections.length) chart(c3, { type: 'bar', data: { labels: s.sections.map(function (r) { return SECTION_NAMES[r.k] || r.k; }), datasets: [{ label: 'Sesiones que la vieron', data: s.sections.map(function (r) { return r.v; }), backgroundColor: '#1F5BD8', borderRadius: 6, maxBarThickness: 22 }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F7' } }, y: { grid: { display: false } } } } });

      var c4 = h('canvas'), c5 = h('canvas');
      box.appendChild(h('div', { class: 'grid2' },
        listCard('Páginas más visitadas', s.pages.map(function (r) { return { k: r.k, v: r.v }; }), pageName),
        h('div', { class: 'card' }, h('h2', { text: 'Horario de visitas (hora de Chile)' }), h('div', { class: 'chart' }, c5))));
      chart(c5, { type: 'bar', data: { labels: s.hours.map(function (_, i) { return i + 'h'; }), datasets: [{ label: 'Visitas', data: s.hours, backgroundColor: '#6A4CF0', borderRadius: 4 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F7' } }, x: { grid: { display: false } } } } });

      box.appendChild(h('div', { class: 'grid3' },
        h('div', { class: 'card' }, h('h2', { text: 'Dispositivos' }), s.devices.length ? h('div', { class: 'chart' }, c4) : h('p', { class: 'empty', text: 'Aún no hay datos en este período.' })),
        listCard('Botones más clicados', s.clicks),
        listCard('Sitios que envían visitas', s.referrers)));
      if (s.devices.length) chart(c4, { type: 'doughnut', data: { labels: s.devices.map(function (r) { return r.k; }), datasets: [{ data: s.devices.map(function (r) { return r.v; }), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
        options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } } });

      box.appendChild(h('div', { class: 'grid3' },
        listCard('Países', s.countries, countryName),
        listCard('Ciudades', s.cities),
        listCard('Navegadores', s.browsers)));
    }).catch(function (e) { box.innerHTML = ''; box.appendChild(h('p', { class: 'empty', text: 'No se pudieron cargar las métricas: ' + e.message })); });
  }
  function kpi(label, value, d) { return h('div', { class: 'kpi' }, h('small', { text: label }), h('b', { text: value }), d); }
  function countryName(code) {
    try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  }

  // ===== Solicitudes =====
  function viewLeads(view) {
    var card = h('div', { class: 'card' }, h('p', { class: 'empty', text: 'Cargando solicitudes…' }));
    view.appendChild(card);
    api('leads').then(function (r) {
      card.innerHTML = '';
      var items = r.items || [];
      card.appendChild(h('div', { class: 'card-head' }, h('h2', { text: items.length + ' solicitudes recibidas' }),
        items.length ? h('button', { class: 'btn ghost small', text: 'Descargar Excel (CSV)', onclick: function () { downloadCsv(items); } }) : null));
      if (!items.length) { card.appendChild(h('p', { class: 'empty', text: 'Todavía no llegan solicitudes desde el formulario "Agenda una demo".' })); return; }
      var tb = h('tbody');
      items.forEach(function (l) {
        tb.appendChild(h('tr', {},
          h('td', { text: new Date(l.ts).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) }),
          h('td', {}, h('strong', { text: l.nombre || '' }), h('br'), h('span', { class: 'hint', text: l.cargo || '' })),
          h('td', { text: l.institucion || '' }),
          h('td', {}, h('a', { href: 'mailto:' + l.correo, text: l.correo || '' })),
          h('td', { text: l.producto || '' }),
          h('td', { class: 'msg', text: l.mensaje || '' })));
      });
      card.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ['Fecha', 'Nombre', 'Institución', 'Correo', 'Producto', 'Mensaje'].map(function (t) { return h('th', { text: t }); }))), tb)));
    }).catch(function (e) { card.innerHTML = ''; card.appendChild(h('p', { class: 'empty', text: e.message })); });
  }
  function downloadCsv(items) {
    var cols = ['ts', 'nombre', 'cargo', 'institucion', 'correo', 'producto', 'mensaje'];
    var lines = [['Fecha', 'Nombre', 'Cargo', 'Institución', 'Correo', 'Producto', 'Mensaje'].join(';')];
    items.forEach(function (l) { lines.push(cols.map(function (c) { var v = c === 'ts' ? new Date(l.ts).toLocaleString('es-CL') : (l[c] || ''); return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';')); });
    var a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })), download: 'solicitudes-demo.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ===== Textos =====
  function viewTexts(view) {
    var search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar un texto…' });
    view.appendChild(h('div', { class: 'toolbar' }, search,
      h('span', { class: 'hint', html: 'Puedes usar <code>&lt;br&gt;</code> para un salto de línea y <code>&lt;em&gt;…&lt;/em&gt;</code> para destacar en color.' })));
    var groups = {};
    M.texts.forEach(function (m) { (groups[m.section] = groups[m.section] || []).push(m); });
    var secs = [];
    Object.keys(groups).forEach(function (s, i) {
      var fields = h('div', { class: 'fields' });
      groups[s].forEach(function (m) {
        var t = h('textarea', { rows: 1 });
        t.value = C.texts[m.k] != null ? C.texts[m.k] : '';
        var row = h('div', { class: 'tfield', 'data-q': (m.preview + ' ' + t.value).toLowerCase() },
          h('span', { class: 'tag', text: tagName(m.tag) }), t,
          h('button', { class: 'btn link small', title: 'Volver al texto original', text: '↺', onclick: function () { t.value = D.texts[m.k]; t.dispatchEvent(new Event('input')); } }));
        function upd() { row.classList.toggle('changed', t.value !== D.texts[m.k]); }
        t.addEventListener('input', function () { C.texts[m.k] = t.value; autosize(t); upd(); markDirty(); });
        setTimeout(function () { autosize(t); }); upd();
        fields.appendChild(row);
      });
      var det = h('details', { class: 'sec', open: i === 0 }, h('summary', {}, (M.sections[s] || s), h('span', { text: groups[s].length + ' textos' })), fields);
      secs.push(det); view.appendChild(det);
    });
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      secs.forEach(function (det) {
        var any = false;
        det.querySelectorAll('.tfield').forEach(function (r) {
          var ok = !q || r.getAttribute('data-q').indexOf(q) >= 0 || r.querySelector('textarea').value.toLowerCase().indexOf(q) >= 0;
          r.hidden = !ok; if (ok) any = true;
        });
        det.hidden = !any; if (q && any) det.open = true;
        det.querySelectorAll('textarea').forEach(autosize);
      });
    });
  }
  function tagName(t) {
    return ({ h1: 'Título principal', h2: 'Título', h3: 'Subtítulo', h4: 'Subtítulo', h5: 'Subtítulo', p: 'Párrafo', a: 'Botón / enlace', li: 'Punto de lista', span: 'Texto', small: 'Texto pequeño', strong: 'Destacado', summary: 'Pregunta', b: 'Etiqueta', em: 'Destacado', option: 'Opción', label: 'Campo', button: 'Botón', div: 'Texto', i: 'Letra', h6: 'Texto' })[t] || t;
  }

  // ===== Fotos =====
  function viewImages(view) {
    view.appendChild(h('p', { class: 'hint', text: 'Las fotos se optimizan automáticamente antes de subir (máximo 2000 px, formato WEBP). El logo conserva su transparencia si subes un PNG o SVG.' }));
    var grid = h('div', { class: 'imgs' });
    var keys = allImageKeys().sort(function (a, b) { return (a === 'logo-proexsi.png' ? -1 : 0) - (b === 'logo-proexsi.png' ? -1 : 0); });
    keys.forEach(function (k) {
      var th = h('div', { class: 'th' + (k.indexOf('logo') < 0 ? ' cover' : ''), style: { backgroundImage: 'url("' + imgUrl(k) + '")' } });
      var changed = C.images && C.images[k] && M.imageKeys.indexOf(k) >= 0;
      grid.appendChild(h('div', { class: 'imgc' }, th, h('div', { class: 'b' },
        h('strong', { text: M.imageLabels[k] || k }), changed ? h('span', { class: 'badge', text: 'Reemplazada' }) : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost small', text: 'Cambiar foto', onclick: function () { uploadImage(k, k.indexOf('logo') >= 0).then(function (r) { if (r) route(); }); } }),
          changed ? h('button', { class: 'btn link small', text: 'Volver a la original', onclick: function () { delete C.images[k]; markDirty(); route(); } }) : null))));
    });
    view.appendChild(grid);
  }

  // ===== Carrusel =====
  var POSITIONS = [['center 20%', 'Mostrar la parte de arriba'], ['center 40%', 'Arriba del centro'], ['center 50%', 'Centro'], ['center 60%', 'Abajo del centro'], ['center 80%', 'Mostrar la parte de abajo']];
  function viewCarousel(view) {
    var card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'card-head' }, h('h2', { text: 'Imágenes del carrusel (' + C.carousel.length + ')' }),
      h('div', { class: 'toolbar' },
        h('label', { text: 'Segundos por imagen' }),
        (function () { var i = bind(C, 'carouselSeconds', { multi: false, type: 'number' }); i.min = 2; i.max = 30; i.style.width = '80px'; return i; })(),
        h('button', { class: 'btn primary small', text: '+ Agregar imagen', onclick: function () {
          uploadImage(null).then(function (k) { if (k) { C.carousel.push({ img: k, pos: 'center 50%', alt: '' }); markDirty(); route(); } });
        } }))));
    C.carousel.forEach(function (s, i) {
      var pos = h('select', {});
      POSITIONS.forEach(function (p) { pos.appendChild(h('option', { value: p[0], text: p[1], selected: s.pos === p[0] })); });
      if (!POSITIONS.some(function (p) { return p[0] === s.pos; })) pos.appendChild(h('option', { value: s.pos, text: 'Personalizado (' + s.pos + ')', selected: true }));
      var th = h('div', { class: 'th', style: { backgroundImage: 'url("' + imgUrl(s.img) + '")', backgroundPosition: s.pos } });
      pos.addEventListener('change', function () { s.pos = pos.value; th.style.backgroundPosition = s.pos; markDirty(); });
      card.appendChild(h('div', { class: 'item' },
        h('div', { class: 'item-head' }, h('strong', { text: 'Imagen ' + (i + 1) }), h('div', { class: 'toolbar' },
          h('button', { class: 'btn ghost small', text: '↑', title: 'Subir', disabled: i === 0, onclick: function () { move(C.carousel, i, -1); } }),
          h('button', { class: 'btn ghost small', text: '↓', title: 'Bajar', disabled: i === C.carousel.length - 1, onclick: function () { move(C.carousel, i, 1); } }),
          h('button', { class: 'btn danger small', text: 'Quitar', disabled: C.carousel.length < 2, onclick: function () { C.carousel.splice(i, 1); markDirty(); route(); } }))),
        h('div', { class: 'slide-row' }, th, h('div', { style: { display: 'grid', gap: '10px' } },
          h('div', { class: 'field' }, h('label', { text: 'Foto' }), h('div', { class: 'toolbar' },
            imageSelect(s.img, function (k) { s.img = k; markDirty(); route(); }),
            h('button', { class: 'btn ghost small', text: 'Subir otra', onclick: function () { uploadImage(null).then(function (k) { if (k) { s.img = k; route(); } }); } }))),
          h('div', { class: 'field' }, h('label', { text: 'Encuadre' }), pos),
          bind(s, 'alt', { multi: false, label: 'Descripción de la imagen', hint: 'Se usa para accesibilidad y buscadores.' })))));
    });
    view.appendChild(card);
    view.appendChild(h('p', { class: 'hint', text: 'El título y los botones que aparecen sobre el carrusel se editan en Textos → Portada (carrusel).' }));
  }
  function move(arr, i, d) { var x = arr[i]; arr.splice(i, 1); arr.splice(i + d, 0, x); markDirty(); route(); }

  // ===== Productos =====
  var curProd = null;
  function viewProducts(view) {
    var keys = Object.keys(C.products);
    if (!curProd || !C.products[curProd]) curProd = keys[0];
    view.appendChild(h('div', { class: 'tabs' }, keys.map(function (k) {
      return h('button', { class: k === curProd ? 'on' : '', text: C.products[k].n, onclick: function () { curProd = k; route(); } });
    })));
    var p = C.products[curProd];
    var colorSel = h('select', {});
    Object.keys(C.theme).filter(function (k) { return /^(p-|blue|navy|orange|cyan)/.test(k); }).forEach(function (k) {
      colorSel.appendChild(h('option', { value: '--' + k, text: (M.themeLabels[k] || k), selected: p.c === '--' + k }));
    });
    colorSel.addEventListener('change', function () { p.c = colorSel.value; markDirty(); });

    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Portada de la página' }), h('div', { class: 'grid2' },
      bind(p, 'n', { multi: false, label: 'Nombre del producto' }),
      bind(p, 'tag', { multi: false, label: 'Etiqueta corta' }),
      h('div', { class: 'field' }, h('label', { text: 'Color' }), colorSel),
      h('div'),
      h('div', { style: { gridColumn: '1/-1' } }, bind(p, 'lead', { label: 'Bajada', rows: 3 })))));

    var pics = h('div', { class: 'pics' });
    p.img.forEach(function (im, i) {
      pics.appendChild(h('div', { class: 'imgc' }, h('div', { class: 'th cover', style: { backgroundImage: 'url("' + imgUrl(im[0]) + '")' } }), h('div', { class: 'b' },
        imageSelect(im[0], function (k) { im[0] = k; markDirty(); route(); }),
        (function () { var o = { v: im[1] }; var i2 = bind(o, 'v', { multi: false }); i2.placeholder = 'Descripción'; i2.addEventListener('input', function () { im[1] = o.v; }); return i2; })(),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost small', text: 'Subir otra', onclick: function () { uploadImage(null).then(function (k) { if (k) { im[0] = k; route(); } }); } }),
          h('button', { class: 'btn danger small', text: 'Quitar', disabled: p.img.length < 2, onclick: function () { p.img.splice(i, 1); markDirty(); route(); } })))));
    });
    view.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Fotos (' + p.img.length + ')' }),
      h('button', { class: 'btn ghost small', text: '+ Agregar foto', disabled: p.img.length >= 3, onclick: function () { uploadImage(null).then(function (k) { if (k) { p.img.push([k, '']); route(); } }); } })), pics,
      h('p', { class: 'hint', text: 'Hasta 3 fotos por producto. La foto de la tarjeta en la página de inicio se cambia en Fotos y logo.' })));

    var feats = h('div', { style: { display: 'grid', gap: '10px' } });
    p.f.forEach(function (f, i) {
      var o = { t: f[0], d: f[1] };
      feats.appendChild(h('div', { class: 'item' }, h('div', { class: 'item-head' }, h('strong', { text: 'Funcionalidad ' + (i + 1) }),
        h('button', { class: 'btn danger small', text: 'Quitar', onclick: function () { p.f.splice(i, 1); markDirty(); route(); } })),
        bind(o, 't', { multi: false, onChange: function () { f[0] = o.t; } }), bind(o, 'd', { onChange: function () { f[1] = o.d; } })));
    });
    view.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Qué puedes hacer' }),
      h('button', { class: 'btn ghost small', text: '+ Agregar', onclick: function () { p.f.push(['Nueva funcionalidad', 'Descripción']); markDirty(); route(); } })), feats));

    var steps = h('div', { style: { display: 'grid', gap: '10px' } });
    p.s.forEach(function (st, i) {
      steps.appendChild(bind(p.s, i, { label: 'Paso ' + (i + 1), rows: 2 }));
    });
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Así funciona' }), steps));

    var pp = C.pp;
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Textos comunes de todas las páginas de producto' }), h('div', { class: 'grid2' },
      bind(pp, 'feat', { multi: false, label: 'Título de funcionalidades' }), bind(pp, 'steps', { multi: false, label: 'Título de pasos' }),
      bind(pp, 'demo', { multi: false, label: 'Botón de demo (portada)' }), bind(pp, 'all', { multi: false, label: 'Botón a todos los productos' }),
      bind(pp, 'cta', { multi: false, label: 'Llamado final' }), bind(pp, 'ctaBtn', { multi: false, label: 'Botón del llamado final' }),
      bind(pp, 'more', { multi: false, label: 'Título de otros productos' }), bind(pp, 'crumb', { multi: false, label: 'Ruta (migas de pan)' }))));
  }

  // ===== Nosotros =====
  function viewAbout(view) {
    var a = C.about;
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Portada' }), h('div', { class: 'grid2' },
      bind(a, 'eyebrow', { multi: false, label: 'Etiqueta' }), bind(a, 'title', { multi: false, label: 'Título' }),
      h('div', { style: { gridColumn: '1/-1' } }, bind(a, 'lead', { label: 'Bajada', rows: 3 })),
      h('div', { class: 'field' }, h('label', { text: 'Foto de fondo' }), h('div', { class: 'toolbar' },
        imageSelect(a.image, function (k) { a.image = k; markDirty(); }),
        h('button', { class: 'btn ghost small', text: 'Subir otra', onclick: function () { uploadImage(null).then(function (k) { if (k) { a.image = k; route(); } }); } }))))));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Presentación' }), h('div', { class: 'grid2' },
      bind(a, 'yearsNum', { multi: false, label: 'Cifra del círculo' }), bind(a, 'yearsLabel', { multi: false, label: 'Texto bajo la cifra' }),
      h('div', { style: { gridColumn: '1/-1' } }, bind(a, 'introStrong', { label: 'Frase destacada' })),
      h('div', { style: { gridColumn: '1/-1' } }, bind(a, 'introRest', { label: 'Continuación' })),
      h('div', { style: { gridColumn: '1/-1' } }, bind(a, 'intro2', { label: 'Segundo párrafo', rows: 3 })))));
    [['do', 'doEyebrow', 'doTitle', 'Qué hacemos'], ['val', 'valEyebrow', 'valTitle', 'Lo que nos importa']].forEach(function (g) {
      var box = h('div', { class: 'grid2' }, bind(a, g[1], { multi: false, label: 'Etiqueta' }), bind(a, g[2], { multi: false, label: 'Título' }));
      a[g[0]].forEach(function (x, i) {
        box.appendChild(h('div', { class: 'item' }, h('strong', { text: 'Tarjeta ' + (i + 1) }), bind(x, 't', { multi: false }), bind(x, 'd')));
      });
      view.appendChild(h('div', { class: 'card' }, h('h2', { text: g[3] }), box));
    });
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Cierre' }), h('div', { class: 'grid2' },
      bind(a, 'whoTitle', { multi: false, label: 'Título de productos' }),
      bind(a, 'note', { label: 'Nota (déjala vacía para ocultarla)' }),
      bind(a, 'ctaTitle', { multi: false, label: 'Llamado final' }), bind(a, 'ctaBtn', { multi: false, label: 'Botón del llamado' }))));
  }

  // ===== Diseño =====
  function viewDesign(view) {
    var t = C.theme;
    var sample = h('div', { class: 'sample' });
    function paintSample() {
      loadFont(t.fontDisplay); loadFont(t.fontBody);
      sample.style.fontFamily = '"' + t.fontBody + '", sans-serif';
      sample.innerHTML = '';
      sample.appendChild(h('div', { class: 's-h', style: { fontFamily: '"' + t.fontDisplay + '", sans-serif', color: t.navy }, html: 'Más público. <span style="color:' + t.orange + '">Menos gestión.</span>' }));
      sample.appendChild(h('p', { style: { margin: 0, color: t.muted }, text: 'Cursos, Talleres, Teatro, Conciertos y Ferias en una sola plataforma. Venta online y presencial, check in con QR e informes en tiempo real.' }));
      sample.appendChild(h('div', { class: 'toolbar' },
        h('span', { class: 'btn', style: { background: t.orange, color: '#fff', fontFamily: '"' + t.fontBody + '"' }, text: 'Agenda una demo' }),
        h('span', { class: 'btn', style: { background: t.navy, color: '#fff', fontFamily: '"' + t.fontBody + '"' }, text: 'Ver productos' })));
      sample.appendChild(h('div', { class: 'swatches' }, Object.keys(t).filter(function (k) { return k.indexOf('font') !== 0; }).map(function (k) { return h('i', { title: M.themeLabels[k] || k, style: { background: t[k] } }); })));
    }
    function fontSel(key, label) {
      var s = h('select', {});
      FONTS.forEach(function (f) { s.appendChild(h('option', { value: f, text: f, selected: t[key] === f })); });
      s.addEventListener('change', function () { t[key] = s.value; markDirty(); paintSample(); });
      return h('div', { class: 'field' }, h('label', { text: label }), s);
    }
    view.appendChild(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', { text: 'Tipografías' }), h('div', { style: { display: 'grid', gap: '12px' } },
        fontSel('fontDisplay', 'Títulos'), fontSel('fontBody', 'Textos y botones'),
        h('button', { class: 'btn link small', text: 'Volver a las originales', onclick: function () { t.fontDisplay = D.theme.fontDisplay; t.fontBody = D.theme.fontBody; markDirty(); route(); } }))),
      h('div', { class: 'card' }, h('h2', { text: 'Vista previa' }), sample)));

    var colors = h('div', { class: 'colors' });
    Object.keys(t).filter(function (k) { return k.indexOf('font') !== 0; }).forEach(function (k) {
      var inp = h('input', { type: 'color', value: normHex(t[k]) });
      var code = h('code', { text: t[k] });
      inp.addEventListener('input', function () { t[k] = inp.value.toUpperCase(); code.textContent = t[k]; markDirty(); paintSample(); });
      colors.appendChild(h('div', { class: 'color' }, inp, h('div', {}, h('strong', { style: { fontSize: '.86rem' }, text: M.themeLabels[k] || k }), h('br'), code),
        t[k] !== D.theme[k] ? h('button', { class: 'btn link small', title: 'Volver al original', text: '↺', onclick: function () { t[k] = D.theme[k]; markDirty(); route(); } }) : null));
    });
    view.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Colores' }),
      h('button', { class: 'btn ghost small', text: 'Restablecer todos los colores', onclick: function () { Object.keys(D.theme).forEach(function (k) { if (k.indexOf('font') !== 0) t[k] = D.theme[k]; }); markDirty(); route(); } })), colors));

    var logo = 'logo-proexsi.png';
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Logo' }), h('div', { class: 'toolbar' },
      h('img', { src: imgUrl(logo), alt: 'Logo actual', style: { height: '36px', background: '#fff', border: '1px solid #DDE4F1', borderRadius: '8px', padding: '6px 10px' } }),
      h('button', { class: 'btn ghost small', text: 'Cambiar logo', onclick: function () { uploadImage(logo, true).then(function (r) { if (r) route(); }); } }),
      C.images[logo] ? h('button', { class: 'btn link small', text: 'Volver al original', onclick: function () { delete C.images[logo]; markDirty(); route(); } }) : null),
      h('p', { class: 'hint', text: 'Usa un PNG con fondo transparente o un SVG. Se muestra en el menú, el pie de página y el diagrama de La Plataforma.' })));
    paintSample();
  }
  function normHex(v) { v = String(v || '#000000'); if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]; return v.slice(0, 7); }
  var loadedFonts = {};
  function loadFont(f) {
    if (!f || loadedFonts[f]) return; loadedFonts[f] = 1;
    document.head.appendChild(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;700&display=swap' }));
  }

  // ===== Ajustes =====
  function viewSettings(view) {
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Buscadores y redes sociales' }), h('div', { style: { display: 'grid', gap: '12px' } },
      bind(C.seo, 'title', { multi: false, label: 'Título de la página', hint: 'Aparece en la pestaña del navegador y en Google. Ideal: menos de 60 caracteres.' }),
      bind(C.seo, 'description', { label: 'Descripción', rows: 3, hint: 'Texto que muestra Google bajo el título. Ideal: entre 120 y 160 caracteres.' }))));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Formulario de demo' }),
      bind(C, 'formOk', { label: 'Mensaje al enviar la solicitud', rows: 2 })));
  }

  // ===== Versiones =====
  function viewHistory(view) {
    var card = h('div', { class: 'card' }, h('p', { class: 'empty', text: 'Cargando versiones…' }));
    view.appendChild(card);
    api('history').then(function (r) {
      card.innerHTML = '';
      card.appendChild(h('h2', { text: 'Últimas 30 versiones guardadas' }));
      if (!r.items.length) { card.appendChild(h('p', { class: 'empty', text: 'Todavía no hay versiones guardadas. El sitio muestra el contenido original.' })); return; }
      var tb = h('tbody');
      r.items.forEach(function (it, i) {
        tb.appendChild(h('tr', {}, h('td', { text: '#' + it.id }), h('td', { text: new Date(it.created_at).toLocaleString('es-CL') }), h('td', { text: it.note || '' }),
          h('td', {}, i === 0 ? h('span', { class: 'badge', text: 'Publicada' }) : h('button', { class: 'btn ghost small', text: 'Restaurar', onclick: function () {
            if (JSON.stringify(C) !== SAVED) { toast('Guarda o descarta tus cambios antes de restaurar.', true); return; }
            api('restore', { method: 'POST', body: { id: it.id } }).then(function () { toast('Versión restaurada y publicada.'); return load(); }).then(route).catch(function (e) { toast(e.message, true); });
          } }))));
      });
      card.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Versión', 'Fecha', 'Detalle', ''].map(function (t) { return h('th', { text: t }); }))), tb)));
    }).catch(function (e) { card.innerHTML = ''; card.appendChild(h('p', { class: 'empty', text: e.message })); });
  }

  // ---------- Guardar, ingresar, salir ----------
  $('#save').addEventListener('click', function () {
    var b = $('#save'); b.disabled = true; b.textContent = 'Guardando…';
    api('content', { method: 'PUT', body: { content: C, note: 'Cambios en ' + $('#view-title').textContent } }).then(function () {
      SAVED = JSON.stringify(C); markDirty(); toast('Cambios publicados. El sitio se actualiza en unos segundos.');
    }).catch(function (e) { toast(e.message, true); markDirty(); }).then(function () { b.textContent = 'Guardar cambios'; });
  });
  $('#logout').addEventListener('click', function () { api('logout', { method: 'POST' }).then(showLogin); });
  $('#menu-toggle').addEventListener('click', function () { $('.side').classList.toggle('open'); });

  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#login-err'); err.hidden = true;
    api('login', { method: 'POST', body: { password: $('#pw').value } }).then(function () { $('#pw').value = ''; start(); })
      .catch(function (e2) { err.textContent = e2.message; err.hidden = false; });
  });

  function load() {
    return api('content').then(function (r) {
      C = r.content; D = r.defaults; M = r.meta; FONTS = r.fonts;
      ['texts', 'images'].forEach(function (k) { C[k] = C[k] || {}; });
      SAVED = JSON.stringify(C); markDirty();
    });
  }
  function start() {
    api('me').then(function (me) {
      $('#notice').hidden = me.db;
      $('#notice').textContent = 'Modo de prueba: no hay base de datos conectada, los cambios se pierden al reiniciar el servidor.';
      return load();
    }).then(function () {
      $('#login').hidden = true; $('#app').hidden = false;
      route();
    }).catch(function () {});
  }
  window.addEventListener('hashchange', route);
  start();
})();
