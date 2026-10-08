(function () {
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
