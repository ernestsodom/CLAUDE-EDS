(function () {

  // Medición propia y anónima: páginas vistas, secciones vistas y clics (sin cookies de terceros)
  var T = (function () {
    if (document.body.dataset.preview || navigator.webdriver) return null;
    function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
    function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
    function set(store, k, v) { try { store.setItem(k, v); } catch (e) {} }
    var visitor = get(localStorage, 'cx_v') || rid(); set(localStorage, 'cx_v', visitor);
    var last = Number(get(localStorage, 'cx_t') || 0), session = get(sessionStorage, 'cx_s'), first = false;
    if (!session || Date.now() - last > 30 * 60000) { session = rid(); first = true; set(sessionStorage, 'cx_s', session); }
    function send(type, extra) {
      set(localStorage, 'cx_t', String(Date.now()));
      var d = { type: type, path: location.pathname, visitor: visitor, session: session };
      for (var k in extra) d[k] = extra[k];
      var body = JSON.stringify(d);
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return;
      } catch (e) {}
      fetch('/api/t', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {});
    }
    var q = new URLSearchParams(location.search);
    send('pageview', { first: first, referrer: first ? document.referrer : '', utm_source: q.get('utm_source'), utm_campaign: q.get('utm_campaign') });
    if ('IntersectionObserver' in window) {
      var seen = {};
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var id = e.target.id; if (e.isIntersecting && id && !seen[id]) { seen[id] = 1; send('section', { section: id }); } });
      }, { threshold: 0.3 });
      document.querySelectorAll('main > section[id]').forEach(function (s) { io.observe(s); });
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a, button[type=submit]');
      if (!a || a.closest('.preview-bar')) return;
      var label = a.classList.contains('cat') ? (a.querySelector('h3') || a).textContent : a.textContent;
      label = (label || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (label) send('click', { label: label, section: a.getAttribute('href') || '' });
    }, true);
    return { visitor: visitor, session: session };
  })();
  var btn = document.getElementById('menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () { var o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }
  // En la vista previa del back office los enlaces no navegan fuera de la previsualización
  if (document.body.dataset.preview) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return;
      var h = a.getAttribute('href') || '';
      if (h.charAt(0) === '#' || h.indexOf('/#') === 0) { var t = document.getElementById(h.split('#')[1]); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } return; }
      e.preventDefault();
    });
  }
  var f = document.getElementById('demo-form');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var out = document.getElementById('sent'), b = f.querySelector('button[type=submit]');
    var data = {}; new FormData(f).forEach(function (v, k) { data[k] = String(v).trim(); });
    if (T) { data.visitor = T.visitor; data.session = T.session; }
    out.className = 'sent';
    if (!data.nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.correo || '')) {
      out.className = 'sent err'; out.textContent = 'Escribe tu nombre y un correo válido para que podamos contactarte.'; out.hidden = false; return;
    }
    if (document.body.dataset.preview) { out.textContent = f.dataset.ok + ' (vista previa: no se guardó)'; out.hidden = false; return; }
    b.disabled = true;
    fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw 0; out.textContent = f.dataset.ok; out.hidden = false; f.reset(); })
      .catch(function () { out.className = 'sent err'; out.textContent = 'No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos por correo.'; out.hidden = false; })
      .finally(function () { b.disabled = false; });
  });
})();
