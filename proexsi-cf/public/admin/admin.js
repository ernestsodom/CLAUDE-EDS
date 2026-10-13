/* Back office de Proexsi: edita el contenido completo del sitio y lo publica en un paso. */
(function () {
  'use strict';
  var S = { meta: null, content: null, saved: '', base: null, view: 'diseno', sub: null, media: [], loadedFonts: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    [].concat(kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: opts.headers || {}, credentials: 'same-origin' };
    if (opts.json !== undefined) { init.body = JSON.stringify(opts.json); init.headers['Content-Type'] = 'application/json'; }
    if (opts.body) init.body = opts.body;
    return fetch('/admin/api/' + path, init).then(function (r) {
      if (opts.raw) return r;
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== 'login') { showLogin(); throw new Error(d.error || 'Sesión expirada'); }
        if (!r.ok) { var e = new Error(d.error || 'Error ' + r.status); e.status = r.status; e.data = d; throw e; }
        return d;
      });
    });
  }

  var toastT;
  function toast(msg, err) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, err ? 6000 : 3000);
  }

  /* ---------- sesión ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('#login-msg'); m.hidden = true;
    api('login', { method: 'POST', json: { password: $('#pw').value } })
      .then(function () { $('#pw').value = ''; boot(true); })
      .catch(function (er) { m.textContent = er.message; m.hidden = false; });
  });
  $('#logout').addEventListener('click', function () {
    if (dirty() && !confirm('Tienes cambios sin publicar. ¿Cerrar sesión de todos modos?')) return;
    S.saved = JSON.stringify(S.content);
    api('logout', { method: 'POST' }).finally(function () { location.reload(); });
  });

  function boot(fromLogin) {
    Promise.all([api('meta'), api('content'), api('media')]).then(function (r) {
      S.meta = r[0]; S.content = r[1].content; S.base = r[1].updated_at; S.saved = JSON.stringify(S.content); S.media = r[2].items;
      $('#login').hidden = true; $('#app').hidden = false;
      $('#dbwarn').hidden = S.meta.db !== 'memoria';
      route(); markDirty();
    }).catch(function (e) {
      if (fromLogin) {
        // La clave fue aceptada pero no se pudo cargar el back office: se muestra el motivo en la tarjeta de acceso
        var m = $('#login-msg');
        m.textContent = e.status === 401
          ? 'La clave es correcta, pero la sesión no se pudo iniciar. Permite las cookies para este sitio o abre https://' + location.host + '/api/estado y envía lo que aparece.'
          : 'La clave es correcta, pero el back office no pudo cargar sus datos: ' + e.message;
        m.hidden = false; $('#login').hidden = false; $('#app').hidden = true;
      } else if (e.status !== 401) toast(e.message, true);
    });
  }

  /* ---------- estado de cambios ---------- */
  function dirty() { return S.content && JSON.stringify(S.content) !== S.saved; }
  function markDirty() {
    var d = dirty(), st = $('#status');
    st.textContent = d ? 'Cambios sin publicar' : (S.base ? 'Publicado ' + fmtDate(S.base) : 'Sin publicar todavía');
    st.className = 'status' + (d ? ' dirty' : '');
    $('#btn-publish').disabled = !d; $('#btn-discard').hidden = !d;
  }
  var changed = function () { markDirty(); };
  window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  function fmtDate(d) {
    try { return new Date(d).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; }
  }

  $('#btn-publish').addEventListener('click', function () { publish(false); });
  function publish(force) {
    var b = $('#btn-publish'); b.disabled = true; b.textContent = 'Publicando…';
    api('content', { method: 'PUT', json: { content: S.content, base: S.base, force: force, note: 'Publicado desde el back office' } })
      .then(function (r) { S.base = r.updated_at; S.saved = JSON.stringify(S.content); toast('Cambios publicados en el sitio.'); })
      .catch(function (e) {
        if (e.status === 409) { if (confirm(e.message + '\n\n¿Publicar tus cambios de todos modos?')) return publish(true); }
        else toast(e.message, true);
      })
      .finally(function () { b.textContent = 'Publicar'; markDirty(); });
  }
  $('#btn-discard').addEventListener('click', function () {
    if (!confirm('¿Descartar todos los cambios sin publicar?')) return;
    S.content = JSON.parse(S.saved); render(); markDirty();
  });

  /* ---------- navegación ---------- */
  var TITLES = { panel: 'Panel de control', diseno: 'Paleta y tipografía', sitio: 'Sitio, logo y menú', inicio: 'Página de inicio', productos: 'Productos', paginas: 'Páginas internas', imagenes: 'Imágenes', solicitudes: 'Solicitudes de demo', historial: 'Historial de versiones' };
  function route() {
    var p = location.hash.slice(1).split('/');
    S.view = TITLES[p[0]] ? p[0] : 'panel';
    S.sub = p[1] ? decodeURIComponent(p[1]) : null;
    document.querySelectorAll('#side-nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === S.view); });
    $('.side').classList.remove('open');
    render();
  }
  window.addEventListener('hashchange', route);
  $('#menu-toggle').addEventListener('click', function () { $('.side').classList.toggle('open'); });

  function render() {
    var v = $('#view'); v.innerHTML = '';
    $('#view-title').textContent = TITLES[S.view];
    var fn = { panel: vPanel, diseno: vDesign, sitio: vSite, inicio: vHome, productos: vProducts, paginas: vPages, imagenes: vImages, solicitudes: vLeads, historial: vHistory }[S.view];
    fn(v);
    window.scrollTo(0, 0);
  }

  /* ---------- campos ---------- */
  function field(f, obj, onChange) {
    var set = function (v) { obj[f.k] = v; onChange(); };
    var val = obj[f.k];
    var wrap = h('div', { class: 'f' + (['list', 'strings', 'rich', 'textarea', 'image', 'position'].indexOf(f.type) >= 0 ? ' wide' : '') });
    var id = 'f' + Math.random().toString(36).slice(2, 8);
    var lab = h('label', { for: id, text: f.label });

    if (f.type === 'bool') {
      return h('div', { class: 'f wide' }, h('label', { class: 'check' }, [h('input', { type: 'checkbox', checked: !!val, onchange: function (e) { set(e.target.checked); } }), f.label]));
    }
    if (f.type === 'text') { wrap.append(lab, h('input', { id: id, type: 'text', value: val || '', oninput: function (e) { set(e.target.value); } })); return wrap; }
    if (f.type === 'textarea') {
      var ta = h('textarea', { id: id, rows: Math.min(8, Math.max(2, Math.ceil(String(val || '').length / 70))), oninput: function (e) { set(e.target.value); } }); ta.value = val || '';
      wrap.append(lab, ta); return wrap;
    }
    if (f.type === 'rich') {
      var rt = h('textarea', { id: id, rows: 5, oninput: function (e) { set(e.target.value); } }); rt.value = val || '';
      var wrapSel = function (a, b) { return function () { var s = rt.selectionStart, e = rt.selectionEnd, t = rt.value; rt.value = t.slice(0, s) + a + t.slice(s, e) + b + t.slice(e); rt.focus(); set(rt.value); }; };
      wrap.append(lab, h('div', { class: 'richbar' }, [
        h('button', { class: 'b sm', type: 'button', onclick: wrapSel('<strong>', '</strong>') }, 'Negrita'),
        h('button', { class: 'b sm', type: 'button', onclick: wrapSel('<em>', '</em>') }, 'Cursiva'),
        h('button', { class: 'b sm', type: 'button', onclick: function () { var u = prompt('Dirección del enlace (ej: /nosotros o https://…)'); if (u) wrapSel('<a href="' + u.replace(/"/g, '') + '">', '</a>')(); } }, 'Enlace'),
        h('button', { class: 'b sm', type: 'button', onclick: wrapSel('<ul>\n<li>', '</li>\n</ul>') }, 'Lista'),
        h('button', { class: 'b sm', type: 'button', onclick: wrapSel('<br>', '') }, 'Salto de línea'),
      ]), rt, h('span', { class: 'hint', text: 'Selecciona texto y usa los botones para darle formato.' }));
      return wrap;
    }
    if (f.type === 'number') {
      var mn = f.min != null ? f.min : 0, mx = f.max != null ? f.max : 100, cur = val == null || val === '' ? mx : val;
      var num = h('input', { type: 'number', id: id, min: mn, max: mx, step: f.step || 1, value: cur });
      var rg = h('input', { type: 'range', min: mn, max: mx, step: f.step || 1, value: cur, 'aria-label': f.label });
      rg.oninput = function () { num.value = rg.value; set(Number(rg.value)); };
      num.oninput = function () { rg.value = num.value; set(Number(num.value)); };
      wrap.append(lab, h('div', { class: 'range' }, [rg, num])); return wrap;
    }
    if (f.type === 'select') {
      var sel = h('select', { id: id, onchange: function (e) { set(e.target.value); } }, f.options.map(function (o) { return h('option', { value: o[0], selected: String(val == null ? f.options[0][0] : val) === o[0] }, o[1]); }));
      wrap.append(lab, sel); return wrap;
    }
    if (f.type === 'color') { wrap.append(lab, colorInput(val, set)); return wrap; }
    if (f.type === 'icon') {
      var ib = h('button', { type: 'button', class: 'iconbtn', id: id });
      var paint = function () { var i = S.meta.icons[obj[f.k]]; ib.innerHTML = i ? i.svg + '<span>' + esc(i.name) + '</span>' : '<span>Sin ícono · elegir</span>'; };
      ib.onclick = function () { pickIcon(obj[f.k], function (k) { set(k); paint(); }); };
      paint(); wrap.append(lab, ib); return wrap;
    }
    if (f.type === 'image') {
      var th = h('div', { class: 'thumb' }), pth = h('span', { class: 'path' });
      var paintI = function () { th.style.backgroundImage = obj[f.k] ? 'url("' + obj[f.k] + '")' : ''; th.textContent = obj[f.k] ? '' : 'Sin imagen'; pth.textContent = obj[f.k] || ''; };
      paintI();
      wrap.append(h('span', { text: f.label }), h('div', { class: 'imgf' }, [th, h('div', { style: { display: 'grid', gap: '6px' } }, [
        h('button', { class: 'b sm', type: 'button', onclick: function () { pickImage(function (u, meta) { obj[f.k] = u; if (f.k === 'logo' && meta && meta.ratio) obj.logoRatio = meta.ratio; onChange(); paintI(); if (wrap._onImage) wrap._onImage(); }); } }, 'Elegir o subir imagen'),
        obj[f.k] ? h('button', { class: 'b sm danger', type: 'button', onclick: function () { obj[f.k] = ''; onChange(); paintI(); } }, 'Quitar') : null,
      ]), pth]));
      return wrap;
    }
    if (f.type === 'position') return posField(f, obj, onChange);
    if (f.type === 'strings') {
      var arr = Array.isArray(val) ? val : (obj[f.k] = []);
      var box = h('div', { class: 'strings' });
      var draw = function () {
        box.innerHTML = '';
        arr.forEach(function (s, i) {
          var t = h('textarea', { rows: 2, 'aria-label': f.label + ' ' + (i + 1), oninput: function (e) { arr[i] = e.target.value; onChange(); } }); t.value = s;
          box.append(h('div', { class: 's-row' }, [t,
            h('button', { class: 'b icon sm', type: 'button', title: 'Subir', disabled: i === 0, onclick: function () { move(arr, i, -1); draw(); onChange(); } }, '↑'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Bajar', disabled: i === arr.length - 1, onclick: function () { move(arr, i, 1); draw(); onChange(); } }, '↓'),
            h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () { arr.splice(i, 1); draw(); onChange(); } }, '✕')]));
        });
        box.append(h('div', {}, h('button', { class: 'b sm', type: 'button', onclick: function () { arr.push(''); draw(); onChange(); } }, '+ ' + (f.add || 'Agregar'))));
      };
      draw(); wrap.append(h('span', { text: f.label }), box); return wrap;
    }
    if (f.type === 'list') {
      var items = Array.isArray(val) ? val : (obj[f.k] = []);
      var lb = h('div', { class: 'list' });
      var drawL = function (openIdx) {
        lb.innerHTML = '';
        items.forEach(function (it, i) {
          var title = it.title || it.q || it.label || it.name || '(sin título)';
          var body = h('div', { class: 'item-body' });
          var card = h('div', { class: 'item' + (i === openIdx ? '' : ' closed') }, [
            h('div', { class: 'item-head', onclick: function (e) { if (e.target.closest('button')) return; card.classList.toggle('closed'); } }, [
              h('span', { class: 'caret' }, '▾'), h('span', { class: 't', text: title }),
              h('button', { class: 'b icon sm', type: 'button', title: 'Subir', disabled: i === 0, onclick: function () { move(items, i, -1); drawL(); onChange(); } }, '↑'),
              h('button', { class: 'b icon sm', type: 'button', title: 'Bajar', disabled: i === items.length - 1, onclick: function () { move(items, i, 1); drawL(); onChange(); } }, '↓'),
              h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () { if (confirm('¿Eliminar "' + title + '"?')) { items.splice(i, 1); drawL(); onChange(); } } }, '✕')]),
            body]);
          var g = h('div', { class: 'grid2' });
          f.fields.forEach(function (sf) { g.append(field(sf, it, function () { card.querySelector('.t').textContent = it.title || it.q || it.label || it.name || '(sin título)'; onChange(); })); });
          body.append(g); lb.append(card);
        });
        lb.append(h('div', {}, h('button', { class: 'b sm', type: 'button', onclick: function () { var n = {}; f.fields.forEach(function (sf) { n[sf.k] = ''; }); items.push(n); drawL(items.length - 1); onChange(); } }, '+ ' + (f.add || 'Agregar'))));
      };
      drawL(); wrap.append(h('span', { text: f.label }), lb); return wrap;
    }
    wrap.append(lab, h('input', { id: id, value: val || '', oninput: function (e) { set(e.target.value); } }));
    return wrap;
  }

  function move(a, i, d) { var j = i + d; if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; }

  function colorInput(val, set) {
    var t = h('input', { type: 'text', value: val || '', maxlength: 9, 'aria-label': 'Código de color' });
    var c = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#000000', 'aria-label': 'Elegir color' });
    c.oninput = function () { t.value = c.value.toUpperCase(); set(t.value); };
    t.oninput = function () { if (/^#[0-9a-f]{6}$/i.test(t.value)) { c.value = t.value; set(t.value.toUpperCase()); } };
    return h('div', { class: 'colorf' }, [c, t]);
  }

  // Encuadre: clic sobre la foto para elegir el punto que siempre se verá
  function posField(f, obj, onChange) {
    var wrap = h('div', { class: 'f wide posf' });
    var box = h('div', { class: 'focal', title: 'Haz clic en el punto de la foto que siempre debe verse' });
    var dot = h('i'); box.append(dot);
    var inp = h('input', { type: 'text', value: obj[f.k] || '', placeholder: 'center center', 'aria-label': f.label });
    var parse = function (p) {
      var m = String(p || '').match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
      if (m) return [Number(m[1]), Number(m[2])];
      var map = { left: 0, center: 50, right: 100, top: 0, bottom: 100 }, parts = String(p || 'center center').split(/\s+/);
      var x = parts[0] in map ? map[parts[0]] : parseFloat(parts[0]) || 50, y = parts[1] in map ? map[parts[1]] : parseFloat(parts[1]) || 50;
      return [x, y];
    };
    var paint = function () {
      box.style.backgroundImage = obj.image ? 'url("' + obj.image + '")' : '';
      var p = parse(obj[f.k]); dot.style.left = p[0] + '%'; dot.style.top = p[1] + '%';
    };
    box.addEventListener('click', function (e) {
      var r = box.getBoundingClientRect();
      var x = Math.round((e.clientX - r.left) / r.width * 100), y = Math.round((e.clientY - r.top) / r.height * 100);
      obj[f.k] = x + '% ' + y + '%'; inp.value = obj[f.k]; paint(); onChange();
    });
    inp.oninput = function () { obj[f.k] = inp.value; paint(); onChange(); };
    paint();
    wrap.append(h('span', { text: f.label }), box, h('div', { class: 'pos-row' }, [inp,
      h('button', { class: 'b sm', type: 'button', onclick: function () { obj[f.k] = 'center center'; inp.value = obj[f.k]; paint(); onChange(); } }, 'Centrar')]),
      h('span', { class: 'hint', text: 'Haz clic en la parte de la foto que siempre debe verse (por ejemplo, las caras).' }));
    wrap._repaint = paint;
    return wrap;
  }

  function form(fields, obj, onChange) {
    var g = h('div', { class: 'grid2' });
    var posFields = [];
    fields.forEach(function (f) { var el = field(f, obj, onChange); if (f.type === 'position') posFields.push(el); g.append(el); });
    // si cambia la foto, se actualiza el selector de encuadre
    g.querySelectorAll('.f').forEach(function (el) { el._onImage = function () { posFields.forEach(function (p) { p._repaint && p._repaint(); }); }; });
    return g;
  }

  /* ---------- selectores (modal) ---------- */
  function modal(title, body) {
    $('#modal-title').textContent = title;
    var b = $('#modal-body'); b.innerHTML = ''; [].concat(body).forEach(function (x) { b.append(x); });
    $('#modal').hidden = false;
    setTimeout(function () { var f = b.querySelector('input,button'); if (f) f.focus(); }, 30);
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); $('#preview').hidden = true; } });

  function pickIcon(current, cb) {
    var g = h('div', { class: 'icon-grid' });
    g.append(h('button', { type: 'button', class: !current ? 'on' : '', onclick: function () { cb(''); closeModal(); } }, [h('span', { text: '—' }), 'Sin ícono']));
    Object.keys(S.meta.icons).forEach(function (k) {
      var i = S.meta.icons[k];
      g.append(h('button', { type: 'button', class: k === current ? 'on' : '', html: i.svg + '<span>' + esc(i.name) + '</span>', onclick: function () { cb(k); closeModal(); } }));
    });
    modal('Elegir ícono', g);
  }

  function pickImage(cb) {
    var grid = h('div', { class: 'media' });
    var drawGrid = function () {
      grid.innerHTML = '';
      var all = S.media.map(function (m) { return { url: '/media/' + m.id, name: m.name, w: m.width, hgt: m.height }; })
        .concat(S.meta.staticImages.map(function (u) { return { url: u, name: u.split('/').pop() }; }));
      all.forEach(function (m) {
        grid.append(h('figure', {}, h('button', { class: 'pick', type: 'button', title: 'Usar ' + m.name, onclick: function () { choose(m); } }, [
          h('div', { class: 'mi', style: { backgroundImage: 'url("' + m.url + '")' } }), h('figcaption', {}, [h('b', { text: m.name })])])));
      });
    };
    var choose = function (m) {
      var done = function (ratio) { cb(m.url, { ratio: ratio }); closeModal(); };
      if (m.w && m.hgt) return done(+(m.w / m.hgt).toFixed(3));
      var im = new Image(); im.onload = function () { done(+(im.naturalWidth / im.naturalHeight).toFixed(3)); }; im.onerror = function () { done(null); }; im.src = m.url;
    };
    drawGrid();
    modal('Elegir imagen', [uploader(function (m) { S.media.unshift(m); choose({ url: '/media/' + m.id, w: m.width, hgt: m.height, name: m.name }); }), grid]);
  }

  /* ---------- subida de imágenes (se optimizan en el navegador) ---------- */
  function uploader(onDone) {
    var inp = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    var drop = h('div', { class: 'drop' }, [h('p', { style: { margin: '0 0 10px' }, text: 'Arrastra fotos aquí o' }),
      h('button', { class: 'b primary', type: 'button', onclick: function () { inp.click(); } }, 'Subir imágenes'),
      h('p', { class: 'hint', style: { margin: '10px 0 0', fontSize: '.82rem' }, text: 'Las fotos se optimizan automáticamente (máximo 2400 px de ancho, formato WebP).' }), inp]);
    var handle = function (files) {
      [].slice.call(files).reduce(function (p, file) {
        return p.then(function () { return upload(file).then(onDone).catch(function (e) { toast(file.name + ': ' + e.message, true); }); });
      }, Promise.resolve()).then(function () { toast('Imágenes subidas.'); });
    };
    inp.onchange = function () { handle(inp.files); inp.value = ''; };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files); });
    return drop;
  }

  function upload(file) {
    toast('Subiendo ' + file.name + '…');
    return optimize(file).then(function (o) {
      return api('media', { method: 'POST', body: o.blob, headers: { 'Content-Type': o.blob.type, 'X-File-Name': encodeURIComponent(file.name.replace(/\.[^.]+$/, '') + o.ext), 'X-Width': o.w || '', 'X-Height': o.h || '' } })
        .then(function (r) { return { id: r.id, name: file.name, mime: o.blob.type, size: o.blob.size, width: o.w, height: o.h, created_at: new Date().toISOString() }; });
    });
  }

  function optimize(file) {
    return new Promise(function (res) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return res({ blob: file, ext: '.' + (file.type.split('/')[1] || 'img').replace('svg+xml', 'svg') });
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, hh = im.naturalHeight, max = 2400, k = Math.min(1, max / w);
        var cw = Math.round(w * k), ch = Math.round(hh * k);
        if (k === 1 && file.type === 'image/webp' && file.size < 900000) { URL.revokeObjectURL(url); return res({ blob: file, ext: '.webp', w: w, h: hh }); }
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(im, 0, 0, cw, ch);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b || b.type !== 'image/webp') return res({ blob: file, ext: '.' + file.type.split('/')[1], w: w, h: hh });
          res({ blob: b.size < file.size || k < 1 ? b : file, ext: b.size < file.size || k < 1 ? '.webp' : '.' + file.type.split('/')[1], w: cw, h: ch });
        }, 'image/webp', 0.86);
      };
      im.onerror = function () { URL.revokeObjectURL(url); res({ blob: file, ext: '' }); };
      im.src = url;
    });
  }

  /* ---------- vista: panel de control ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var el = document.createElementNS(NS, tag); for (var k in attrs) el.setAttribute(k, attrs[k]); return el; }
  var nf = function (n) { return Number(n || 0).toLocaleString('es-CL'); };
  var pct = function (n) { return (n * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' %'; };
  var regionNames; try { regionNames = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) {}
  var countryName = function (c) { if (!c || c === 'Sin dato') return 'Sin dato'; try { return regionNames ? regionNames.of(c) : c; } catch (e) { return c; } };
  function ago(ts) {
    var m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
    return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function kpiTile(label, value, cur, prev, help, fmt) {
    var d = h('div', { class: 'k-d' });
    if (prev > 0) {
      var ch = (cur - prev) / prev, up = ch >= 0;
      d.append(h('b', { class: up ? 'up' : 'down', text: (up ? '▲ ' : '▼ ') + Math.abs(Math.round(ch * 100)) + ' %' }), ' vs. período anterior');
    } else d.textContent = cur > 0 ? 'Sin datos del período anterior' : '—';
    return h('div', { class: 'kpi' }, [h('span', { class: 'k-l', text: label }), h('span', { class: 'k-v', text: fmt ? fmt(value) : nf(value) }), d, help ? h('span', { class: 'k-h', text: help }) : null]);
  }

  // Color por categoría: cada nombre conserva su color mientras se usa el panel (el color sigue al dato, no a su posición)
  var PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
  S.colorMap = S.colorMap || {};
  function colorFor(key, label) {
    var m = S.colorMap[key] || (S.colorMap[key] = {});
    if (!(label in m)) m[label] = Object.keys(m).length;
    return m[label] < PALETTE.length ? PALETTE[m[label]] : 'var(--c-other)';
  }
  try { S.chartMode = localStorage.getItem('px_chart') || 'bars'; } catch (e) { S.chartMode = 'bars'; }

  // Torta: hasta 7 porciones y el resto agrupado en "Otros"
  function pieChart(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return h('p', { class: 'empty2', text: opts.empty || 'Sin datos en este período.' });
    var list = items.slice(0, 7).map(function (i) { return { label: opts.map ? opts.map(i.label) : i.label, raw: i.label, value: i.value }; });
    var rest = items.slice(7).reduce(function (a, i) { return a + i.value; }, 0);
    list.forEach(function (i) { i.color = colorFor(opts.key, i.raw); });
    if (rest) list.push({ label: 'Otros', value: rest, color: 'var(--c-other)' });
    var total = list.reduce(function (a, i) { return a + i.value; }, 0) || 1;
    var R0 = 80, R1 = 50, cx = 85, cy = 85, a0 = -Math.PI / 2;
    var s = svg('svg', { viewBox: '0 0 170 170', role: 'img', 'aria-label': 'Gráfico de torta' });
    var legend = h('div', { class: 'legend' });
    var wrap = h('div', { class: 'pie-wrap' });
    var tip = h('div', { class: 'tip', hidden: true });
    var paths = [], rows = [];
    function arc(a1, a2) {
      if (a2 - a1 >= Math.PI * 2 - 1e-6) a2 = a1 + Math.PI * 2 - 1e-4;
      var large = a2 - a1 > Math.PI ? 1 : 0, p = function (r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); };
      return 'M' + p(R0, a1) + ' A' + R0 + ' ' + R0 + ' 0 ' + large + ' 1 ' + p(R0, a2) + ' L' + p(R1, a2) + ' A' + R1 + ' ' + R1 + ' 0 ' + large + ' 0 ' + p(R1, a1) + ' Z';
    }
    function focus(i, e) {
      paths.forEach(function (p, j) { p.classList.toggle('dim', i != null && j !== i); });
      rows.forEach(function (r, j) { r.classList.toggle('on', j === i); });
      if (i == null || !e) { tip.hidden = true; return; }
      var it = list[i], r = wrap.getBoundingClientRect();
      tip.innerHTML = ''; tip.append(h('b', { text: nf(it.value) }), ' ' + (opts.unit || '') + ' · ', it.label, ' (' + pct(it.value / total) + ')');
      tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false;
    }
    list.forEach(function (it, i) {
      var a1 = a0, a2 = a0 + it.value / total * Math.PI * 2; a0 = a2;
      var p = svg('path', { d: arc(a1, a2), fill: it.color, stroke: list.length > 1 ? '#fff' : 'none', 'stroke-width': 2, tabindex: 0 });
      p.style.fill = it.color;
      p.addEventListener('pointermove', function (e) { focus(i, e); });
      p.addEventListener('pointerleave', function () { focus(null); });
      p.addEventListener('focus', function () { var b = p.getBoundingClientRect(); focus(i, { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }); });
      p.addEventListener('blur', function () { focus(null); });
      paths.push(p); s.append(p);
      var row = h('div', { class: 'lg' }, [h('i', { style: { background: it.color } }), h('span', { text: it.label, title: it.label }), h('b', { text: nf(it.value) }), h('small', { text: pct(it.value / total) })]);
      row.addEventListener('pointerenter', function () { focus(i); });
      row.addEventListener('pointerleave', function () { focus(null); });
      rows.push(row); legend.append(row);
    });
    var t1 = svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'p-total' }); t1.textContent = nf(total);
    var t2 = svg('text', { x: cx, y: cy + 21, 'text-anchor': 'middle', class: 'p-cap' }); t2.textContent = opts.unit || 'total';
    s.append(t1, t2);
    wrap.append(s, tip);
    return h('div', { class: 'pie' }, [wrap, legend]);
  }

  function dist(items, opts) { return S.chartMode === 'pie' ? pieChart(items, opts) : barList(items, opts); }

  function barList(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return h('p', { class: 'empty2', text: opts.empty || 'Sin datos en este período.' });
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    return h('div', { class: 'bars' }, items.map(function (i) {
      var label = opts.map ? opts.map(i.label) : i.label;
      var row = h('div', { class: 'bar-row', tabindex: 0, title: label + ': ' + nf(i.value) + (opts.unit ? ' ' + opts.unit : '') + ' (' + pct(total ? i.value / total : 0) + ')' }, [
        h('div', { class: 'bar-top' }, [h('span', { text: label }), h('b', { text: nf(i.value) })]),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: Math.max(1, i.value / max * 100) + '%', background: opts.key ? colorFor(opts.key, i.label) : '' } }))]);
      return row;
    }));
  }

  // Línea de visitantes por día, con cruz que sigue al puntero
  function lineChart(daily) {
    var W = 760, H = 230, L = 36, R = 12, T = 12, B = 28;
    var wrap = h('div', { class: 'chart' });
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Visitantes por día' });
    var vals = daily.map(function (d) { return d.visitors; });
    var maxV = Math.max.apply(null, vals.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(maxV))) || 1;
    var nice = Math.ceil(maxV / step) * step; if (nice / step > 6) step *= 2; nice = Math.ceil(maxV / step) * step;
    var x = function (i) { return L + (daily.length < 2 ? (W - L - R) / 2 : i * (W - L - R) / (daily.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    for (var g = 0; g <= nice; g += step) {
      s.append(svg('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), stroke: g === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }));
      var t = svg('text', { x: L - 8, y: y(g) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted-2)', style: 'font-variant-numeric:tabular-nums' }); t.textContent = nf(g); s.append(t);
    }
    var every = Math.ceil(daily.length / 7);
    daily.forEach(function (d, i) {
      if (i % every && i !== daily.length - 1) return;
      var t = svg('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle', 'font-size': 11, fill: 'var(--muted-2)' });
      t.textContent = new Date(d.date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }); s.append(t);
    });
    var pts = daily.map(function (d, i) { return x(i) + ',' + y(d.visitors); });
    s.append(svg('path', { d: 'M' + x(0) + ',' + y(0) + ' L' + pts.join(' L') + ' L' + x(daily.length - 1) + ',' + y(0) + ' Z', fill: 'var(--viz-1-soft)' }));
    s.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--viz-1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    var cross = svg('line', { y1: T, y2: H - B, stroke: 'var(--axis)', 'stroke-width': 1, visibility: 'hidden' });
    var dot = svg('circle', { r: 5, fill: 'var(--viz-1)', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' });
    s.append(cross, dot);
    var hit = svg('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent', tabindex: 0 });
    s.append(hit);
    var tip = h('div', { class: 'tip', hidden: true });
    var show = function (i) {
      var d = daily[i], px = x(i), py = y(d.visitors);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
      tip.innerHTML = '';
      tip.append(h('div', { text: new Date(d.date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) }),
        h('span', {}, [h('i'), h('b', { text: nf(d.visitors) }), ' visitantes']), h('span', { text: nf(d.pageviews) + ' páginas vistas' }));
      var r = s.getBoundingClientRect();
      tip.style.left = (px / W * r.width) + 'px'; tip.style.top = (py / H * r.height) + 'px';
      tip.style.transform = 'translate(' + (px > W * 0.8 ? '-100%' : px < W * 0.2 ? '0' : '-50%') + ',-110%)'; tip.hidden = false;
    };
    var hide = function () { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    var idx = daily.length - 1;
    hit.addEventListener('pointermove', function (e) {
      var r = s.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
      idx = Math.max(0, Math.min(daily.length - 1, Math.round((vx - L) / ((W - L - R) / Math.max(1, daily.length - 1))))); show(idx);
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', function () { show(idx); });
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { idx = Math.max(0, idx - 1); show(idx); } if (e.key === 'ArrowRight') { idx = Math.min(daily.length - 1, idx + 1); show(idx); } });
    wrap.append(s, tip);
    return wrap;
  }

  function funnel(steps) {
    var colors = ['var(--f1)', 'var(--f2)', 'var(--f3)', 'var(--f4)'], first = steps[0].value || 0;
    return h('div', { class: 'funnel' }, steps.map(function (st, i) {
      var w = first ? Math.max(0.5, st.value / first * 100) : 0;
      return h('div', { class: 'f-row', title: st.label + ': ' + nf(st.value) }, [h('span', { text: st.label }),
        h('div', {}, h('div', { class: 'f-bar', style: { width: w + '%', background: colors[i] } })),
        h('span', { class: 'f-v' }, [nf(st.value), i ? h('small', { text: first ? pct(st.value / first) : '' }) : null])]);
    }));
  }

  function card(title, sub, body, wide) {
    return h('section', { class: 'card2' + (wide ? ' wide' : '') }, [h('h3', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null].concat(body));
  }

  function vPanel(v) {
    S.days = S.days || 30;
    var root = h('div', { class: 'dash loading' });
    var live = h('span', { class: 'live' }, [h('i'), h('span', { text: 'Cargando…' })]);
    var seg = h('div', { class: 'seg2', role: 'group', 'aria-label': 'Período' }, [[7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '12 meses']].map(function (o) {
      return h('button', { type: 'button', class: S.days === o[0] ? 'on' : '', 'aria-pressed': S.days === o[0], onclick: function () { S.days = o[0]; load(); seg.querySelectorAll('button').forEach(function (b, i) { var on = [7, 30, 90, 365][i] === S.days; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); } }, o[1]);
    }));
    var body = h('div', { style: { display: 'grid', gap: '18px' } });
    var modeSeg = h('div', { class: 'seg2', role: 'group', 'aria-label': 'Tipo de gráfico' }, [['bars', 'Barras'], ['pie', 'Torta']].map(function (o) {
      return h('button', { type: 'button', class: S.chartMode === o[0] ? 'on' : '', 'aria-pressed': S.chartMode === o[0], onclick: function () {
        S.chartMode = o[0]; try { localStorage.setItem('px_chart', o[0]); } catch (e) {}
        modeSeg.querySelectorAll('button').forEach(function (b, i) { var on = ['bars', 'pie'][i] === S.chartMode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        if (S.lastStats) draw(S.lastStats);
      } }, o[1]);
    }));
    root.append(h('div', { class: 'filters' }, [seg, h('span', { class: 'sub', style: { color: 'var(--muted)', fontSize: '.85rem' }, text: 'Ver gráficos como' }), modeSeg, live, h('button', { class: 'b sm', type: 'button', onclick: function () { load(); } }, 'Actualizar')]), body);
    v.append(root);

    function load() {
      root.classList.add('loading');
      api('stats?days=' + S.days).then(function (st) { draw(st); }).catch(function (e) { body.innerHTML = ''; body.append(h('p', { class: 'msg err', text: e.message })); }).finally(function () { root.classList.remove('loading'); });
    }

    function draw(st) {
      S.lastStats = st;
      live.lastChild.textContent = '';
      live.lastChild.append(h('b', { text: nf(st.online) }), st.online === 1 ? ' persona en el sitio ahora' : ' personas en el sitio ahora');
      var c = st.kpi.cur, p = st.kpi.prev;
      body.innerHTML = '';
      if (!c.visitors && !c.leads) {
        body.append(h('div', { class: 'card2' }, [h('h3', { text: 'Aún no hay visitas registradas en este período' }),
          h('p', { class: 'sub', style: { margin: 0 }, text: 'La medición comenzó con esta versión del sitio. Los datos aparecerán aquí a medida que las personas visiten ' + location.host + '.' })]));
        return;
      }
      body.append(h('div', { class: 'kpis' }, [
        kpiTile('Visitantes', c.visitors, c.visitors, p.visitors, 'Personas distintas'),
        kpiTile('Visitas', c.sessions, c.sessions, p.sessions, 'Ingresos al sitio'),
        kpiTile('Páginas vistas', c.pageviews, c.pageviews, p.pageviews),
        kpiTile('Solicitudes de demo', c.leads, c.leads, p.leads, 'Formularios enviados'),
        kpiTile('Conversión', c.conversion, c.conversion, p.conversion, 'Visitantes que pidieron demo', pct)]));

      var g = h('div', { class: 'dgrid' });
      var tableBtn = h('button', { class: 'link-btn tview', type: 'button' }, 'Ver como tabla');
      var tableBox = h('div', { hidden: true });
      tableBtn.onclick = function () {
        tableBox.hidden = !tableBox.hidden; tableBtn.textContent = tableBox.hidden ? 'Ver como tabla' : 'Ocultar tabla';
        if (!tableBox.firstChild) tableBox.append(h('div', { class: 'table-wrap' }, h('table', {}, [h('thead', {}, h('tr', {}, [h('th', { text: 'Día' }), h('th', { text: 'Visitantes' }), h('th', { text: 'Páginas vistas' })])),
          h('tbody', {}, st.daily.slice().reverse().map(function (d) { return h('tr', {}, [h('td', { text: d.date }), h('td', { text: nf(d.visitors) }), h('td', { text: nf(d.pageviews) })]); }))])));
      };
      g.append(card('Visitantes por día', 'Pasa el mouse sobre el gráfico para ver cada día.', [lineChart(st.daily), tableBtn, tableBox], true));
      g.append(card('Camino hacia la demo', 'Cuántos visitantes avanzan en cada paso.', [funnel(st.funnel)], true));
      g.append(card('¿Desde dónde llegan?', 'Origen de cada visita.', [dist(st.sources, { key: 'sources', unit: 'visitas' })]));
      g.append(card('¿Dónde están?', 'Ciudades de los visitantes.', [dist(st.cities, { key: 'cities', unit: 'visitantes' }),
        st.countries.length > 1 ? h('p', { class: 'sub', style: { margin: 0 }, text: 'Países: ' + st.countries.map(function (x) { return countryName(x.label) + ' (' + nf(x.value) + ')'; }).join(' · ') }) : null]));
      g.append(card('Productos que más interesan', 'Visitantes que abrieron la página o la tarjeta de cada producto.', [dist(st.interest, { key: 'interest', unit: 'visitantes', empty: 'Nadie ha abierto un producto en este período.' })]));
      g.append(card('Páginas más vistas', null, [dist(st.pages, { key: 'pages', unit: 'vistas' })]));
      g.append(card('Secciones del inicio que más se ven', 'Visitantes que llegaron a cada sección al bajar por la página.', [dist(st.sections, { key: 'sections', unit: 'visitantes' })]));
      g.append(card('Botones y enlaces con más clics', null, [dist(st.clicks, { key: 'clicks', unit: 'clics', empty: 'Sin clics registrados en este período.' })]));
      g.append(card('Dispositivo', null, [dist(st.devices, { key: 'devices', unit: 'visitantes' })]));

      // solicitudes con su recorrido
      var leadsBody = st.leads.length ? h('div', { class: 'table-wrap' }, h('table', {}, [
        h('thead', {}, h('tr', {}, ['Fecha', 'Persona', 'Le interesa', 'Desde', 'Llegó por', 'Visitas', 'Productos que vio'].map(function (t) { return h('th', { text: t }); }))),
        h('tbody', {}, st.leads.map(function (l) {
          return h('tr', {}, [h('td', { text: fmtDate(l.created_at) }),
            h('td', {}, [h('b', { text: l.nombre || '' }), h('div', { text: [l.cargo, l.institucion].filter(Boolean).join(' · ') }), l.correo ? h('a', { href: 'mailto:' + l.correo, text: l.correo }) : null, l.telefono ? h('div', { text: l.telefono }) : null]),
            h('td', { text: l.producto || '—' }), h('td', { text: [l.city, l.country && l.country !== 'CL' ? countryName(l.country) : null].filter(Boolean).join(', ') || '—' }),
            h('td', { text: l.source }), h('td', { text: nf(l.visits) + (l.pageviews ? ' (' + nf(l.pageviews) + ' páginas)' : '') }),
            h('td', {}, l.products.length ? h('div', { class: 'chips2' }, l.products.map(function (x) { return h('span', { text: x }); })) : '—')]);
        }))])) : h('p', { class: 'empty2', text: 'Todavía no llegan solicitudes en este período.' });
      g.append(card('Solicitudes de demo y su recorrido', 'Quién pidió una demo, desde dónde llegó y qué revisó antes.', [leadsBody], true));

      g.append(card('Últimas visitas', 'Las 12 visitas más recientes y las páginas que recorrieron.', [st.recent.length ? h('div', {}, st.recent.map(function (r) {
        return h('div', { class: 'visit' }, [h('time', { text: ago(r.last) }),
          h('div', { class: 'who' }, [h('b', { text: [r.city, r.country && r.country !== 'CL' ? countryName(r.country) : null].filter(Boolean).join(', ') || 'Ubicación sin dato' }),
            h('span', { text: '· ' + (r.device || 'Computador') + ' · ' + r.source }), r.lead ? h('span', { class: 'tag-lead', text: 'Pidió demo' }) : null]),
          h('div', { class: 'chips2' }, r.pages.map(function (x) { return h('span', { text: x }); }))]);
      })) : h('p', { class: 'empty2', text: 'Sin visitas recientes.' })], true));
      body.append(g);
    }
    load();
  }

  /* ---------- vista: diseño ---------- */
  function loadFont(name, weights) {
    var key = name; if (S.loadedFonts[key]) return; S.loadedFonts[key] = 1;
    var f = S.meta.fonts[name]; if (!f) return;
    var ws = (weights || f.w).filter(function (w) { return f.w.indexOf(w) >= 0; });
    var fam = name.replace(/ /g, '+') + (ws.length === 1 && ws[0] === 400 ? '' : ':wght@' + ws.join(';'));
    document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap' }));
  }
  var stack = function (n) { return "'" + n + "'," + (S.meta.fonts[n] && S.meta.fonts[n].c === 'sans' ? 'system-ui,sans-serif' : 'Georgia,serif'); };

  function vDesign(v) {
    var t = S.content.theme; t.colors = t.colors || {};
    var sample = h('div', { class: 'sample' });
    var paintSample = function () {
      var c = t.colors;
      loadFont(t.fontDisplay); loadFont(t.fontBody, [400, 600]);
      sample.style.background = c.cream; sample.style.borderColor = c.line;
      sample.innerHTML = '<span style="font:600 .78rem/1 ' + stack(t.fontBody) + ';letter-spacing:.16em;text-transform:uppercase;color:' + c.orange + '">Etiqueta superior</span>' +
        '<h3 style="font-family:' + stack(t.fontDisplay) + ';font-weight:' + (t.displayWeight || 400) + ';color:' + c['green-900'] + ';font-size:' + (2.2 * (t.titleScale || 100) / 100) + 'rem">Cultura y Comunidad <em style="font-style:normal;color:' + c.orange + '">para Todos.</em></h3>' +
        '<p style="margin:0;font-family:' + stack(t.fontBody) + ';color:' + c.muted + ';font-size:' + (1.05 * (t.bodyScale || 100) / 100) + 'rem;max-width:55ch">La mejor plataforma para gestionar todas las actividades de tu corporación cultural.</p>' +
        '<div class="btns" style="font-family:' + stack(t.fontBody) + '"><span style="background:' + c.orange + ';color:#fff;border-radius:' + (t.radius != null ? Math.min(t.radius, 14) : 10) + 'px">Agenda una demo</span><span style="background:' + c.green + ';color:#fff;border-radius:' + (t.radius != null ? Math.min(t.radius, 14) : 10) + 'px">Botón principal</span></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="background:' + c.paper + ';border:1px solid ' + c.line + ';border-radius:' + (t.radius || 18) + 'px;padding:14px 16px;font-family:' + stack(t.fontBody) + ';color:' + c.ink + '">Tarjeta</div>' +
        '<div style="background:' + c['green-800'] + ';border-radius:' + (t.radius || 18) + 'px;padding:14px 16px;font-family:' + stack(t.fontBody) + ';color:#fff">Sección oscura</div>' +
        '<div style="background:' + c.sand + ';border-radius:' + (t.radius || 18) + 'px;padding:14px 16px;font-family:' + stack(t.fontBody) + ';color:' + c.ink + '">Sección alterna</div></div>';
    };
    var upd = function () { paintSample(); changed(); };

    // paletas
    var pal = h('div', { class: 'palettes' });
    var drawPal = function () {
      pal.innerHTML = '';
      S.meta.palettes.forEach(function (p) {
        pal.append(h('button', { type: 'button', class: t.palette === p.id ? 'on' : '', onclick: function () { t.palette = p.id; t.colors = clone(p.colors); drawPal(); drawColors(); upd(); } }, [
          h('span', { class: 'sw', html: ['green-800', 'green', 'orange', 'cream', 'sand'].map(function (k) { return '<i style="background:' + p.colors[k] + '"></i>'; }).join('') }),
          h('b', { text: p.name })]));
      });
    };
    var colors = h('div', { class: 'colors' });
    var drawColors = function () {
      colors.innerHTML = '';
      S.meta.colorTokens.forEach(function (tk) {
        colors.append(h('div', { class: 'f' }, [h('span', { text: tk[1] }), colorInput(t.colors[tk[0]], function (val) { t.colors[tk[0]] = val; t.palette = 'personalizada'; drawPal(); upd(); })]));
      });
    };
    drawPal(); drawColors();

    // tipografías
    var fontPicker = function (key, label, sampleText) {
      var filter = 'all';
      var list = h('div', { class: 'fontlist', role: 'listbox', 'aria-label': label });
      var draw = function () {
        list.innerHTML = '';
        Object.keys(S.meta.fonts).filter(function (n) { return filter === 'all' || S.meta.fonts[n].c === filter; }).forEach(function (n) {
          loadFont(n, [S.meta.fonts[n].w.indexOf(400) >= 0 ? 400 : S.meta.fonts[n].w[0]]);
          var b = h('button', { type: 'button', role: 'option', 'aria-selected': t[key] === n, class: t[key] === n ? 'on' : '', onclick: function () {
            t[key] = n;
            if (key === 'fontDisplay' && S.meta.fonts[n].w.indexOf(Number(t.displayWeight)) < 0) t.displayWeight = S.meta.fonts[n].w[0];
            draw(); drawWeight(); upd();
          } }, [h('span', { class: 'fs', style: { fontFamily: stack(n) }, text: sampleText }), h('small', { text: n + (S.meta.fonts[n].c === 'sans' ? ' · sans' : ' · serif') })]);
          list.append(b);
        });
      };
      var chips = h('div', { class: 'fontfilter' }, [['all', 'Todas'], ['serif', 'Con serif'], ['sans', 'Sin serif']].map(function (o) {
        return h('button', { type: 'button', class: 'b sm' + (o[0] === filter ? ' primary' : ''), onclick: function (e) { filter = o[0]; chips.querySelectorAll('button').forEach(function (x) { x.classList.remove('primary'); }); e.target.classList.add('primary'); draw(); } }, o[1]);
      }));
      draw();
      setTimeout(function () { var on = list.querySelector('.on'); if (on) list.scrollTop = on.offsetTop - list.offsetTop - 8; }, 50);
      return h('div', { class: 'f' }, [h('span', { text: label }), chips, list]);
    };
    var weightBox = h('div', { class: 'f' });
    var drawWeight = function () {
      weightBox.innerHTML = '';
      var ws = (S.meta.fonts[t.fontDisplay] || { w: [400] }).w;
      loadFont(t.fontDisplay, ws);
      weightBox.append(h('span', { text: 'Grosor de los títulos' }), h('select', { onchange: function (e) { t.displayWeight = Number(e.target.value); upd(); } },
        ws.map(function (w) { return h('option', { value: w, selected: Number(t.displayWeight || ws[0]) === w }, { 400: 'Normal (400)', 500: 'Medio (500)', 600: 'Semi negrita (600)', 700: 'Negrita (700)', 800: 'Extra negrita (800)', 900: 'Negra (900)', 300: 'Liviano (300)' }[w] || w); })));
    };
    drawWeight();

    v.append(
      h('div', { class: 'panel' }, [h('h2', { text: 'Muestra' }), h('p', { class: 'help', text: 'Así se ven los colores y tipografías elegidos. Usa "Vista previa" para ver el sitio completo antes de publicar.' }), sample]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Paletas predefinidas' }), h('p', { class: 'help', text: 'Elige una paleta como punto de partida. Luego puedes ajustar cada color abajo.' }), pal]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Colores' }), colors]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Tipografías' }), h('p', { class: 'help', text: Object.keys(S.meta.fonts).length + ' familias de Google Fonts disponibles.' }),
        h('div', { class: 'fonts2' }, [fontPicker('fontDisplay', 'Títulos', 'Cultura y Comunidad'), fontPicker('fontBody', 'Textos', 'La mejor plataforma cultural')]),
        h('div', { class: 'grid2' }, [weightBox,
          field({ k: 'titleScale', label: 'Tamaño de los títulos (%)', type: 'number', min: 75, max: 130, step: 5 }, t, upd),
          field({ k: 'bodyScale', label: 'Tamaño de los textos (%)', type: 'number', min: 85, max: 120, step: 5 }, t, upd),
          field({ k: 'radius', label: 'Redondeo de tarjetas y fotos (px)', type: 'number', min: 0, max: 32, step: 1 }, t, upd)])]));
    paintSample();
  }

  /* ---------- vista: sitio y menú ---------- */
  function vSite(v) {
    var s = S.content.site;
    var navF = { k: 'nav', label: 'Botones del menú superior', type: 'list', fields: S.meta.navFields, add: 'Agregar botón' };
    var navBox = h('div');
    var drawNav = function () { navBox.innerHTML = ''; navBox.append(field(navF, S.content, changed)); };
    drawNav();
    var quick = h('select', { 'aria-label': 'Agregar enlace rápido', onchange: function (e) {
      if (!e.target.value) return; var o = JSON.parse(e.target.value); S.content.nav.push(o); drawNav(); changed(); e.target.value = '';
    } }, [h('option', { value: '' }, 'Agregar enlace a una página o producto…')].concat(
      S.content.pages.map(function (p) { return h('option', { value: JSON.stringify({ label: p.title, href: '/' + p.slug }) }, 'Página: ' + p.title); }),
      S.content.categories.map(function (c) { return h('option', { value: JSON.stringify({ label: c.name, href: '/productos/' + c.slug }) }, 'Producto: ' + c.name); }),
      S.content.home.blocks.map(function (b) { return h('option', { value: JSON.stringify({ label: S.meta.blocks[b.type].name, href: '/#' + b.id }) }, 'Sección del inicio: #' + b.id); })));
    v.append(
      h('div', { class: 'panel' }, [h('h2', { text: 'Datos del sitio' }), form(S.meta.siteFields, s, changed)]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Menú superior' }), h('p', { class: 'help', text: 'Los enlaces a secciones del inicio usan "/#" más el ancla de la sección (por ejemplo /#productos).' }), quick, navBox]));
  }

  /* ---------- editor de secciones (inicio y páginas) ---------- */
  function blocksEditor(blocks, opts) {
    var box = h('div', { class: 'list' });
    var draw = function (openIdx) {
      box.innerHTML = '';
      blocks.forEach(function (b, i) {
        var def = S.meta.blocks[b.type] || { name: b.type, fields: [] };
        var summary = b.title || b.startTitle || b.number || b.text || '';
        var body = h('div', { class: 'item-body' });
        var card = h('div', { class: 'block item' + (i === openIdx ? '' : ' closed') + (b.hidden ? ' off' : '') }, [
          h('div', { class: 'item-head', onclick: function (e) { if (e.target.closest('button,input,label')) return; card.classList.toggle('closed'); } }, [
            h('span', { class: 'caret' }, '▾'), h('span', { class: 'type', text: def.name }),
            h('span', { class: 't', html: esc(String(summary).replace(/<[^>]+>/g, '').slice(0, 80)) + (b.hidden ? ' <small>(oculta)</small>' : '') }),
            h('button', { class: 'b sm', type: 'button', title: b.hidden ? 'Mostrar en el sitio' : 'Ocultar del sitio', onclick: function () { b.hidden = !b.hidden; draw(i); changed(); } }, b.hidden ? 'Mostrar' : 'Ocultar'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Subir', disabled: i === 0, onclick: function () { move(blocks, i, -1); draw(); changed(); } }, '↑'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Bajar', disabled: i === blocks.length - 1, onclick: function () { move(blocks, i, 1); draw(); changed(); } }, '↓'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Duplicar', onclick: function () { var c = clone(b); c.id = uniqueId(blocks, b.id); blocks.splice(i + 1, 0, c); draw(i + 1); changed(); } }, '⧉'),
            h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () { if (confirm('¿Eliminar la sección "' + def.name + '"?')) { blocks.splice(i, 1); draw(); changed(); } } }, '✕')]),
          body]);
        body.append(h('p', { class: 'help', style: { margin: '10px 0 0', color: 'var(--muted)', fontSize: '.88rem' }, text: def.desc || '' }));
        body.append(form([{ k: 'id', label: 'Ancla (para enlazar con /#ancla)', type: 'text' }].concat(def.fields), b, function () {
          var t = card.querySelector('.t'); t.textContent = String(b.title || b.startTitle || b.number || b.text || '').replace(/<[^>]+>/g, '').slice(0, 80); changed();
        }));
        box.append(card);
      });
      box.append(h('div', {}, h('button', { class: 'b primary', type: 'button', onclick: function () { addBlock(blocks, function () { draw(blocks.length - 1); changed(); }, opts); } }, '+ Agregar sección')));
    };
    draw();
    return box;
  }

  function uniqueId(blocks, base) {
    base = String(base || 'seccion').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'seccion';
    var id = base, n = 2; var used = blocks.map(function (b) { return b.id; });
    while (used.indexOf(id) >= 0) id = base + '-' + n++;
    return id;
  }

  var BLOCK_TEMPLATES = {
    hero: { title: 'Nuevo título', cta1Label: 'Agenda una demo', cta1Href: '/#contacto', veil: 100, facts: [] },
    pageHero: { title: 'Título de la página', veil: 100 },
    categories: { columns: '4', moreLabel: 'Conoce la solución' },
    trust: { items: [{ icon: 'shield', title: 'Título', text: 'Texto breve.' }] },
    benefits: { eyebrow: 'Beneficios', title: 'Título', items: [{ icon: 'check', title: 'Título', text: 'Texto.' }] },
    flow: { title: 'Cómo funciona', startIcon: 'monitor', startTitle: 'Inicio', startText: '', channels: [{ icon: 'globe', title: 'Canal', text: '' }], endIcon: 'qr', endTitle: 'Final', endText: '', checks: [] },
    cards: { title: 'Título', style: 'icon', columns: '3', items: [{ icon: 'star', title: 'Tarjeta', text: 'Texto.' }] },
    steps: { title: 'Así funciona', items: ['Primer paso.', 'Segundo paso.', 'Tercer paso.'] },
    faq: { eyebrow: 'Preguntas frecuentes', title: 'Lo que nos suelen preguntar', items: [{ q: '¿Pregunta?', a: 'Respuesta.' }] },
    contact: { eyebrow: 'Hablemos', title: 'Agenda una demo', showForm: true, button: 'Solicitar demo', success: '¡Gracias! Te contactaremos pronto.' },
    text: { title: 'Título', body: '<p>Escribe aquí el texto.</p>', align: 'left' },
    stat: { number: '+20', body: 'Texto principal.' },
    image: { image: '', full: false },
    chips: { title: 'Nuestros productos' },
    cta: { title: '¿Conversamos?', button: 'Agenda una demo', href: '/#contacto' },
    note: { text: 'Texto del aviso.' },
  };

  function addBlock(blocks, done) {
    var g = h('div', { class: 'types' });
    Object.keys(S.meta.blocks).forEach(function (k) {
      var d = S.meta.blocks[k];
      g.append(h('button', { type: 'button', onclick: function () {
        var b = Object.assign({ id: uniqueId(blocks, k === 'pageHero' ? 'encabezado' : k), type: k, hidden: false }, clone(BLOCK_TEMPLATES[k] || {}));
        blocks.push(b); closeModal(); done();
      } }, [h('b', { text: d.name }), h('span', { text: d.desc })]));
    });
    modal('Agregar sección', g);
  }

  /* ---------- vista: inicio ---------- */
  function vHome(v) {
    v.append(h('div', { class: 'panel' }, [
      h('div', { class: 'row-head' }, [h('h2', { text: 'Secciones de la página de inicio' }), h('a', { class: 'b sm', href: '/', target: '_blank', rel: 'noopener' }, 'Abrir inicio publicado ↗')]),
      h('p', { class: 'help', text: 'Abre una sección para editarla. Puedes reordenarlas, ocultarlas, duplicarlas o agregar nuevas.' }),
      blocksEditor(S.content.home.blocks)]));
  }

  /* ---------- vista: productos ---------- */
  var slugify = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'; };

  function vProducts(v) {
    var cats = S.content.categories;
    if (S.sub) {
      var c = cats.find(function (x) { return x.id === S.sub; });
      if (!c) { location.hash = 'productos'; return; }
      $('#view-title').textContent = 'Producto: ' + c.name;
      v.append(h('div', { class: 'crumbs' }, [h('a', { href: '#productos' }, '← Todos los productos'), h('span', { text: '·' }), h('a', { href: '/productos/' + c.slug, target: '_blank', rel: 'noopener' }, 'Ver página publicada ↗')]),
        h('div', { class: 'panel' }, [h('h2', { text: c.name }), form(S.meta.categoryFields, c, function () { $('#view-title').textContent = 'Producto: ' + c.name; changed(); })]));
      return;
    }
    var grid = h('div', { class: 'cards' });
    var draw = function () {
      grid.innerHTML = '';
      cats.forEach(function (c, i) {
        grid.append(h('div', { class: 'card' + (c.hidden ? ' off' : '') }, [
          h('div', { class: 'ph', style: { backgroundImage: c.image ? 'url("' + c.image + '")' : '' } }),
          h('div', { class: 'cb' }, [h('b', { text: c.name }), h('small', { text: '/productos/' + c.slug }), c.hidden ? h('span', { class: 'badge hidden', text: 'Oculto' }) : null]),
          h('div', { class: 'ca' }, [
            h('a', { class: 'b sm primary', href: '#productos/' + encodeURIComponent(c.id) }, 'Editar'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Mover antes', disabled: i === 0, onclick: function () { move(cats, i, -1); draw(); changed(); } }, '←'),
            h('button', { class: 'b icon sm', type: 'button', title: 'Mover después', disabled: i === cats.length - 1, onclick: function () { move(cats, i, 1); draw(); changed(); } }, '→'),
            h('button', { class: 'b sm', type: 'button', onclick: function () { c.hidden = !c.hidden; draw(); changed(); } }, c.hidden ? 'Mostrar' : 'Ocultar'),
            h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () { if (confirm('¿Eliminar el producto "' + c.name + '" y su página?')) { cats.splice(i, 1); draw(); changed(); } } }, '✕')])]));
      });
    };
    draw();
    var add = function () {
      var name = prompt('Nombre del nuevo producto o categoría:');
      if (!name) return;
      var slug = slugify(name), n = 2, base = slug;
      while (cats.some(function (c) { return c.slug === slug; })) slug = base + '-' + n++;
      var id = 'p' + Date.now().toString(36);
      cats.push({ id: id, slug: slug, name: name, icon: 'star', image: '', alt: '', pos: 'center center', veil: 100, short: '', lead: '', features: [], steps: [], hidden: false });
      changed(); location.hash = 'productos/' + id;
    };
    v.append(
      h('div', { class: 'panel' }, [h('div', { class: 'row-head' }, [h('h2', { text: 'Productos y categorías' }), h('button', { class: 'b primary', type: 'button', onclick: add }, '+ Nuevo producto')]),
        h('p', { class: 'help', text: 'Cada producto aparece en la grilla del inicio, en el pie de página y tiene su propia página.' }), grid]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Textos comunes de las páginas de producto' }), form(S.meta.categoryPageFields, S.content.categoryPage, changed)]));
  }

  /* ---------- vista: páginas ---------- */
  function vPages(v) {
    var pages = S.content.pages;
    if (S.sub) {
      var p = pages.find(function (x) { return x.id === S.sub; });
      if (!p) { location.hash = 'paginas'; return; }
      $('#view-title').textContent = 'Página: ' + p.title;
      v.append(h('div', { class: 'crumbs' }, [h('a', { href: '#paginas' }, '← Todas las páginas'), h('span', { text: '·' }), h('a', { href: '/' + p.slug, target: '_blank', rel: 'noopener' }, 'Ver página publicada ↗')]),
        h('div', { class: 'panel' }, [h('h2', { text: 'Datos de la página' }), form(S.meta.pageFields, p, function () { $('#view-title').textContent = 'Página: ' + p.title; changed(); })]),
        h('div', { class: 'panel' }, [h('h2', { text: 'Secciones' }), blocksEditor(p.blocks)]));
      return;
    }
    var grid = h('div', { class: 'cards' });
    var draw = function () {
      grid.innerHTML = '';
      pages.forEach(function (p, i) {
        var hero = (p.blocks || []).find(function (b) { return b.image; });
        grid.append(h('div', { class: 'card' + (p.hidden ? ' off' : '') }, [
          h('div', { class: 'ph', style: { backgroundImage: hero ? 'url("' + hero.image + '")' : '' } }),
          h('div', { class: 'cb' }, [h('b', { text: p.title }), h('small', { text: '/' + p.slug }), p.hidden ? h('span', { class: 'badge hidden', text: 'Oculta' }) : null]),
          h('div', { class: 'ca' }, [
            h('a', { class: 'b sm primary', href: '#paginas/' + encodeURIComponent(p.id) }, 'Editar'),
            h('button', { class: 'b sm', type: 'button', onclick: function () { var c = clone(p); c.id = 'pg' + Date.now().toString(36); c.title += ' (copia)'; c.slug = uniqueSlug(p.slug + '-copia'); pages.splice(i + 1, 0, c); draw(); changed(); } }, 'Duplicar'),
            h('button', { class: 'b sm', type: 'button', onclick: function () { p.hidden = !p.hidden; draw(); changed(); } }, p.hidden ? 'Mostrar' : 'Ocultar'),
            h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () { if (confirm('¿Eliminar la página "' + p.title + '"?')) { pages.splice(i, 1); draw(); changed(); } } }, '✕')])]));
      });
    };
    var uniqueSlug = function (s) { var base = slugify(s), slug = base, n = 2; while (pages.some(function (p) { return p.slug === slug; }) || S.meta.reserved.indexOf(slug) >= 0) slug = base + '-' + n++; return slug; };
    draw();
    var add = function () {
      var title = prompt('Nombre de la nueva página:');
      if (!title) return;
      var id = 'pg' + Date.now().toString(36);
      pages.push({ id: id, slug: uniqueSlug(title), title: title, hidden: false, seoDescription: '', blocks: [
        { id: 'encabezado', type: 'pageHero', title: title, lead: '', image: '/img/hero-feria-full.webp', alt: '', pos: 'center center', veil: 100 },
        { id: 'texto', type: 'text', eyebrow: '', title: '', body: '<p>Escribe aquí el contenido de la página.</p>', align: 'left' },
        { id: 'cta', type: 'cta', title: '¿Conversamos?', button: 'Agenda una demo', href: '/#contacto' }] });
      changed(); location.hash = 'paginas/' + id;
    };
    v.append(h('div', { class: 'panel' }, [h('div', { class: 'row-head' }, [h('h2', { text: 'Páginas internas' }), h('button', { class: 'b primary', type: 'button', onclick: add }, '+ Nueva página')]),
      h('p', { class: 'help', text: 'Cada página tiene su dirección propia. Para que aparezca en el menú, agrégala en "Sitio, logo y menú".' }), grid]));
  }

  /* ---------- vista: imágenes ---------- */
  function vImages(v) {
    var used = JSON.stringify(S.content);
    var grid = h('div', { class: 'media' });
    var draw = function () {
      grid.innerHTML = '';
      if (!S.media.length) grid.append(h('p', { class: 'empty', text: 'Todavía no has subido imágenes.' }));
      S.media.forEach(function (m) {
        var url = '/media/' + m.id, inUse = used.indexOf('"' + url + '"') >= 0;
        grid.append(h('figure', {}, [h('div', { class: 'mi', style: { backgroundImage: 'url("' + url + '")' } }),
          h('figcaption', {}, [h('b', { text: m.name }), (m.width ? m.width + '×' + m.height + ' px · ' : '') + Math.round(m.size / 1024) + ' KB', inUse ? h('span', { class: 'badge', text: 'En uso' }) : null]),
          h('div', { class: 'ma' }, [
            h('button', { class: 'b sm', type: 'button', onclick: function () { copy(location.origin + url); } }, 'Copiar enlace'),
            h('button', { class: 'b sm danger', type: 'button', onclick: function () {
              if (!confirm(inUse ? 'Esta imagen se usa en el sitio (en tus cambios actuales). Si la eliminas, desaparecerá de esas secciones. ¿Eliminar de todos modos?' : '¿Eliminar "' + m.name + '"?')) return;
              api('media/' + m.id, { method: 'DELETE' }).then(function () { S.media = S.media.filter(function (x) { return x.id !== m.id; }); draw(); toast('Imagen eliminada.'); }).catch(function (e) { toast(e.message, true); });
            } }, 'Eliminar')])]));
      });
    };
    draw();
    var stat = h('div', { class: 'media' });
    S.meta.staticImages.forEach(function (u) { stat.append(h('figure', {}, [h('div', { class: 'mi', style: { backgroundImage: 'url("' + u + '")' } }), h('figcaption', {}, [h('b', { text: u.split('/').pop() }), used.indexOf('"' + u + '"') >= 0 ? h('span', { class: 'badge', text: 'En uso' }) : null])])); });
    v.append(
      h('div', { class: 'panel' }, [h('h2', { text: 'Imágenes subidas' }), uploader(function (m) { S.media.unshift(m); draw(); }), grid]),
      h('div', { class: 'panel' }, [h('h2', { text: 'Imágenes incluidas en el sitio' }), h('p', { class: 'help', text: 'Vienen con el sitio. Se pueden usar en cualquier sección, pero no se eliminan desde aquí.' }), stat]));
  }
  function copy(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Enlace copiado.'); }).catch(function () { prompt('Copia el enlace:', t); });
  }

  /* ---------- vista: solicitudes ---------- */
  function vLeads(v) {
    var p = h('div', { class: 'panel' }, [h('p', { text: 'Cargando…' })]);
    v.append(p);
    api('leads').then(function (r) {
      p.innerHTML = '';
      var cols = [['nombre', 'Nombre'], ['institucion', 'Institución'], ['cargo', 'Cargo'], ['correo', 'Correo'], ['telefono', 'Teléfono'], ['producto', 'Producto'], ['mensaje', 'Mensaje']];
      var csv = function () {
        var rows = [['Fecha'].concat(cols.map(function (c) { return c[1]; }))].concat(r.items.map(function (l) { return [new Date(l.created_at).toLocaleString('es-CL')].concat(cols.map(function (c) { return l.data[c[0]] || ''; })); }));
        var text = rows.map(function (row) { return row.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
        var a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: 'solicitudes-demo.csv' }); document.body.append(a); a.click(); a.remove();
      };
      p.append(h('div', { class: 'row-head' }, [h('h2', { text: r.items.length + ' solicitudes recibidas' }), r.items.length ? h('button', { class: 'b', type: 'button', onclick: csv }, 'Descargar Excel (CSV)') : null]));
      if (!r.items.length) { p.append(h('p', { class: 'empty', text: 'Aún no llegan solicitudes desde el formulario del sitio.' })); return; }
      var tb = h('tbody');
      r.items.forEach(function (l) {
        var tr = h('tr', {}, [h('td', { text: fmtDate(l.created_at) })].concat(cols.map(function (c) {
          var val = l.data[c[0]] || '';
          return h('td', { class: c[0] === 'mensaje' ? 'msg' : '' }, c[0] === 'correo' && val ? h('a', { href: 'mailto:' + val, text: val }) : val);
        }), [h('td', {}, h('button', { class: 'b icon sm danger', type: 'button', title: 'Eliminar', onclick: function () {
          if (!confirm('¿Eliminar esta solicitud?')) return;
          api('leads/' + l.id, { method: 'DELETE' }).then(function () { tr.remove(); }).catch(function (e) { toast(e.message, true); });
        } }, '✕'))]));
        tb.append(tr);
      });
      p.append(h('div', { class: 'table-wrap' }, h('table', {}, [h('thead', {}, h('tr', {}, [h('th', { text: 'Fecha' })].concat(cols.map(function (c) { return h('th', { text: c[1] }); }), [h('th')]))), tb])));
    }).catch(function (e) { p.innerHTML = ''; p.append(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- vista: historial ---------- */
  function vHistory(v) {
    var p = h('div', { class: 'panel' }, [h('p', { text: 'Cargando…' })]);
    v.append(p);
    api('history').then(function (r) {
      p.innerHTML = '';
      p.append(h('h2', { text: 'Versiones publicadas' }), h('p', { class: 'help', text: 'Cada vez que publicas se guarda una copia (las últimas 40). Al cargar una versión, sus contenidos quedan en el editor como cambios sin publicar.' }));
      if (!r.items.length) { p.append(h('p', { class: 'empty', text: 'Aún no hay versiones publicadas.' })); return; }
      var tb = h('tbody');
      r.items.forEach(function (it, i) {
        tb.append(h('tr', {}, [h('td', { text: fmtDate(it.created_at) }), h('td', { text: (i === 0 ? 'Versión actual · ' : '') + (it.note || '') }),
          h('td', {}, i === 0 ? '' : h('button', { class: 'b sm', type: 'button', onclick: function () {
            if (dirty() && !confirm('Perderás los cambios sin publicar. ¿Cargar esta versión?')) return;
            api('history/' + it.id).then(function (d) { S.content = d.content; markDirty(); toast('Versión cargada. Revísala y publica para restaurarla.'); location.hash = 'inicio'; }).catch(function (e) { toast(e.message, true); });
          } }, 'Cargar esta versión'))]));
      });
      p.append(h('div', { class: 'table-wrap' }, h('table', {}, [h('thead', {}, h('tr', {}, [h('th', { text: 'Fecha' }), h('th', { text: 'Nota' }), h('th')])), tb])));
    }).catch(function (e) { p.innerHTML = ''; p.append(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- vista previa ---------- */
  function previewPaths() {
    var c = S.content, out = [['/', 'Inicio']];
    c.categories.forEach(function (x) { out.push(['/productos/' + x.slug, 'Producto: ' + x.name]); });
    c.pages.forEach(function (x) { out.push(['/' + x.slug, 'Página: ' + x.title]); });
    return out;
  }
  function currentPath() {
    if (S.view === 'productos' && S.sub) { var c = S.content.categories.find(function (x) { return x.id === S.sub; }); if (c) return '/productos/' + c.slug; }
    if (S.view === 'paginas' && S.sub) { var p = S.content.pages.find(function (x) { return x.id === S.sub; }); if (p) return '/' + p.slug; }
    if (S.view === 'productos') { var f = S.content.categories[0]; if (f) return '/productos/' + f.slug; }
    return '/';
  }
  function loadPreview(path) {
    var fr = $('#preview-frame');
    api('preview', { method: 'POST', json: { content: S.content, path: path }, raw: true }).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('Sesión expirada'); }
      return r.text();
    }).then(function (html) { fr.srcdoc = html; }).catch(function (e) { toast(e.message, true); });
  }
  $('#btn-preview').addEventListener('click', function () {
    var sel = $('#preview-path'), path = currentPath();
    sel.innerHTML = ''; previewPaths().forEach(function (o) { sel.append(h('option', { value: o[0], selected: o[0] === path }, o[1])); });
    $('#preview').hidden = false; loadPreview(path);
  });
  $('#preview-path').addEventListener('change', function (e) { loadPreview(e.target.value); });
  $('#preview-close').addEventListener('click', function () { $('#preview').hidden = true; });
  document.querySelectorAll('.seg .b').forEach(function (b) {
    b.addEventListener('click', function () { document.querySelectorAll('.seg .b').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); $('#preview-frame').style.width = b.dataset.w; });
  });

  /* ---------- inicio ---------- */
  api('session').then(boot).catch(function () { showLogin(); });
})();
