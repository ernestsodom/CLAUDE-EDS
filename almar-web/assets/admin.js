(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Number(n || 0).toLocaleString('es-CL');
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const { GAL } = window.ALMAR_DATA;
const SCHEMA = window.ALMAR_SCHEMA;
const DEF = {}; SCHEMA.forEach((g) => g.fields.forEach((f) => { DEF[f.k] = f.d; }));

/* ---------- Íconos y logotipos ---------- */
const ICON = {
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  texts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
  cats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  contact: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  bounce: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  wa: '<svg viewBox="0 0 32 32"><path fill="currentColor" d="M16.04 3C8.86 3 3.03 8.83 3.03 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A12.95 12.95 0 0 0 16.04 29C23.2 29 29 23.17 29 16S23.2 3 16.04 3Zm0 23.66c-2.03 0-4.02-.55-5.75-1.58l-.41-.25-3.96 1.04 1.06-3.86-.27-.4a10.6 10.6 0 0 1-1.63-5.6c0-5.88 4.79-10.66 10.68-10.66 5.88 0 10.65 4.78 10.65 10.66 0 5.87-4.78 10.65-10.37 10.65Zm5.85-7.98c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.51-.16-.72.16-.21.32-.83 1.04-1.01 1.25-.19.22-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.6-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.1-.22.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.08 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.82.67.76.24 1.46.21 2.01.13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>',
  form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3h10l4 4v14H5z"/><path d="M9 12l2 2 4-4"/></svg>',
  mobile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
  desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/></svg>',
  tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
};
const LOGO = {
  google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  facebook: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#1877F2"/><path fill="#fff" d="M26.7 38V26.6h3.8l.6-4.5h-4.4v-2.8c0-1.3.4-2.2 2.2-2.2h2.3v-4a31 31 0 0 0-3.4-.2c-3.4 0-5.6 2-5.6 5.8v3.4h-3.8v4.5h3.8V38z"/></svg>',
  instagram: '<svg viewBox="0 0 48 48"><defs><radialGradient id="igg" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect x="4" y="4" width="40" height="40" rx="11" fill="url(#igg)"/><rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="5.6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="31.6" cy="16.4" r="1.8" fill="#fff"/></svg>',
  directo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--ink)"><path d="M5 3l14 7-6 2-2 6z"/><path d="M13 12l6 6"/></svg>',
  otro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="color:var(--ink-2)"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
};
const SOURCES = [['google', 'Google'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['directo', 'Directo'], ['otro', 'Otro']];
const SRCNAME = Object.fromEntries(SOURCES);

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/api/login')) { showLogin(); throw new Error(j.error || 'Sesión expirada.'); }
  if (!r.ok) throw new Error(j.error || 'Error inesperado.');
  return j;
}
const toastEl = $('#toast'); let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); }

/* ---------- Sesión ---------- */
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
function showApp() { $('#login').hidden = true; $('#app').hidden = false; try { localStorage.setItem('almar_notrack', '1'); } catch {} go(location.hash.slice(1) || 'panel'); }
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#loginErr').textContent = '';
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) }); $('#pw').value = ''; showApp(); }
  catch (ex) { $('#loginErr').textContent = ex.message; }
});
$('#logout').onclick = async () => { await api('/api/login', { method: 'DELETE' }).catch(() => {}); showLogin(); };
$('#openSide').onclick = () => $('#side').classList.add('open');
document.addEventListener('click', (e) => { if ($('#side').classList.contains('open') && !e.target.closest('#side') && !e.target.closest('#openSide')) $('#side').classList.remove('open'); });

/* ---------- Navegación ---------- */
const VIEWS = [['panel', 'Panel', 'panel'], ['presupuestos', 'Presupuestos', 'leads'], ['textos', 'Textos del sitio', 'texts'], ['categorias', 'Categorías', 'cats'], ['contacto', 'WhatsApp y correo', 'contact']];
let newLeads = 0;
function nav(cur) {
  $('#nav').innerHTML = VIEWS.map(([id, label, ic]) => `<button type="button" data-v="${id}" class="${id === cur ? 'on' : ''}">${ICON[ic]}${label}${id === 'presupuestos' && newLeads ? `<span class="badge">${newLeads}</span>` : ''}</button>`).join('');
}
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) { location.hash = b.dataset.v; $('#side').classList.remove('open'); } });
addEventListener('hashchange', () => { if (!$('#app').hidden) go(location.hash.slice(1)); });
function go(v) {
  if (!VIEWS.some((x) => x[0] === v)) v = 'panel';
  nav(v); window.scrollTo(0, 0);
  ({ panel: viewPanel, presupuestos: viewLeads, textos: viewTexts, categorias: viewCats, contacto: viewContact })[v]();
}
const view = $('#view');

/* ---------- Panel ---------- */
let days = 30;
const PAGE_NAMES = { inicio: 'Inicio', matrimonios: 'Matrimonios', 'otros-eventos': 'Otros eventos', corporativas: 'Corporativas', galerias: 'Galerías', contacto: 'Contacto' };
window.ALMAR_GALLERIES.forEach((g) => { PAGE_NAMES[g.slug] = 'Galería · ' + g.t; });
const dur = (ms) => { const s = Math.round((ms || 0) / 1000); if (s < 60) return s + ' s'; const m = Math.floor(s / 60); return m + ' min ' + String(s % 60).padStart(2, '0') + ' s'; };
function delta(cur, prev) {
  if (!prev && !cur) return '<span class="delta flat">sin cambios</span>';
  if (!prev) return '<span class="delta up">nuevo</span>';
  const d = Math.round(((cur - prev) / prev) * 100);
  return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)}%</span>`;
}
async function viewPanel() {
  view.innerHTML = `<div class="top"><div><h1>Hola, Magda</h1><p>Así se está comportando tu sitio.</p></div>
    <div class="seg" id="range">${[7, 30, 90].map((d) => `<button type="button" data-d="${d}" class="${d === days ? 'on' : ''}">${d} días</button>`).join('')}</div></div>
    <div class="grid g-kpi">${'<div class="skel"></div>'.repeat(4)}</div>`;
  $('#range').onclick = (e) => { const b = e.target.closest('button'); if (b) { days = +b.dataset.d; viewPanel(); } };
  let s;
  try { s = await api('/api/admin?action=stats&days=' + days); } catch (ex) { view.insertAdjacentHTML('beforeend', `<div class="empty">${esc(ex.message)}</div>`); return; }
  newLeads = s.totals.new_leads; nav('panel');
  const t = s.totals;
  const conv = pct(t.leads, t.sessions);
  const totalSrc = SOURCES.reduce((a, [k]) => a + (s.sources[k] || 0), 0);
  const maxSrc = Math.max(1, ...SOURCES.map(([k]) => s.sources[k] || 0));
  const clicks = Object.fromEntries(s.clicks.map((c) => [c.label, c.n]));
  const devs = Object.fromEntries(s.devices.map((d) => [d.device, d.sessions]));
  const devTotal = (devs.movil || 0) + (devs.escritorio || 0) + (devs.tablet || 0);
  const maxPage = Math.max(1, ...s.pages.map((p) => p.views));
  const f = s.funnel;
  const steps = [['Visitas', f.sessions], ['Vieron galerías', f.galleries], ['Entraron a contacto', f.contact], ['Pidieron presupuesto', t.leads]];
  view.innerHTML = `<div class="top"><div><h1>Hola, Magda</h1><p>Así se está comportando tu sitio en los últimos ${s.days} días.</p></div>
    <div class="seg" id="range">${[7, 30, 90].map((d) => `<button type="button" data-d="${d}" class="${d === days ? 'on' : ''}">${d} días</button>`).join('')}</div></div>

  <div class="grid g-kpi">
    <div class="card kpi"><span class="l">${ICON.users}Visitas</span><span class="v num">${fmt(t.sessions)}</span><span class="d">${delta(t.sessions, t.prev_sessions)} vs. período anterior</span></div>
    <div class="card kpi"><span class="l">${ICON.eye}Personas distintas</span><span class="v num">${fmt(t.visitors)}</span><span class="d">${fmt(t.pageviews)} páginas vistas</span></div>
    <div class="card kpi hl"><span class="l">${ICON.leads}Presupuestos</span><span class="v num">${fmt(t.leads)}</span><span class="d">${t.new_leads ? `${t.new_leads} sin responder` : 'Todos respondidos'}</span></div>
    <div class="card kpi"><span class="l">${ICON.target}Conversión</span><span class="v num">${conv.toLocaleString('es-CL')}%</span><span class="d">visitas que piden presupuesto</span></div>
    <div class="card kpi"><span class="l">${ICON.clock}Tiempo por visita</span><span class="v num" style="font-size:1.6rem">${dur(t.avg_ms)}</span><span class="d">promedio</span></div>
    <div class="card kpi"><span class="l">${ICON.pages}Páginas por visita</span><span class="v num">${t.sessions ? (t.pageviews / t.sessions).toFixed(1).replace('.', ',') : '0'}</span><span class="d">${Math.round(t.bounce * 100)}% se va tras ver una sola página</span></div>
  </div>

  <div class="grid g-2" style="margin-top:16px">
    <div class="card"><h2>¿De dónde llegan?</h2><p class="sub">Visitas según el canal por el que entraron al sitio.</p>
      ${totalSrc ? `<div class="src">${SOURCES.map(([k, n]) => { const v = s.sources[k] || 0; const l = s.leadsBySource[k] || 0; return `<div class="srow"><div class="slogo">${LOGO[k]}</div><div><div class="sname">${n}<span>${pct(v, totalSrc).toLocaleString('es-CL')}%</span></div><div class="track"><i style="width:${(v / maxSrc) * 100}%"></i></div></div><div class="sval"><b class="num">${fmt(v)}</b><small>${l ? `${l} presupuesto${l > 1 ? 's' : ''}` : 'visitas'}</small></div></div>`; }).join('')}</div>` : '<div class="empty">Aún no hay visitas en este período. Cuando alguien entre al sitio, aquí verás si llegó desde Google, Facebook, Instagram o directo.</div>'}
    </div>
    <div class="card"><h2>Visitas por día</h2><p class="sub">Pasa el cursor sobre la línea para ver cada día.</p><div class="chart" id="chart"></div></div>
  </div>

  <div class="grid g-3" style="margin-top:16px">
    <div class="card"><h2>Qué hacen en el sitio</h2><p class="sub">Acciones de contacto registradas.</p>
      <div class="acts">
        <div class="act"><span class="ic">${ICON.wa}</span><div><b class="num">${fmt(clicks.whatsapp)}</b><small>clics en WhatsApp</small></div></div>
        <div class="act"><span class="ic">${ICON.form}</span><div><b class="num">${fmt(t.leads)}</b><small>formularios enviados</small></div></div>
        <div class="act"><span class="ic">${ICON.ig}</span><div><b class="num">${fmt(clicks.instagram)}</b><small>clics en Instagram</small></div></div>
        <div class="act"><span class="ic">${ICON.mail}</span><div><b class="num">${fmt(clicks.email)}</b><small>clics en correo</small></div></div>
      </div></div>
    <div class="card"><h2>Recorrido hacia el presupuesto</h2><p class="sub">Cuántas visitas avanzan en cada paso.</p>
      <div class="funnel">${steps.map(([n, v]) => `<div class="fstep"><span>${n}</span><div class="fbar" style="width:${f.sessions ? Math.max(1, (v / f.sessions) * 100) : 0}%"></div><span class="r num"><b>${fmt(v)}</b><small>${pct(v, f.sessions).toLocaleString('es-CL')}%</small></span></div>`).join('')}</div></div>
    <div class="card"><h2>Dispositivos</h2><p class="sub">Desde dónde navegan.</p>
      <div class="devs">${[['movil', 'Celular', 'mobile'], ['escritorio', 'Computador', 'desktop'], ['tablet', 'Tablet', 'tablet']].map(([k, n, ic]) => `<div class="dev">${ICON[ic]}<b class="num">${pct(devs[k] || 0, devTotal).toLocaleString('es-CL')}%</b><small>${n} · ${fmt(devs[k])}</small></div>`).join('')}</div></div>
  </div>

  <div class="grid g-2" style="margin-top:16px">
    <div class="card"><h2>Páginas más vistas</h2><p class="sub">Y cuánto tiempo se quedan en cada una.</p>
      ${s.pages.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Página</th><th class="r">Vistas</th><th></th><th class="r">Tiempo medio</th></tr></thead><tbody>${s.pages.map((p) => `<tr><td>${esc(PAGE_NAMES[p.path] || p.path)}</td><td class="r num">${fmt(p.views)}</td><td style="width:30%"><div class="mini"><i style="width:${(p.views / maxPage) * 100}%"></i></div></td><td class="r num">${dur(p.avg_ms)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin datos todavía.</div>'}
    </div>
    <div class="card"><h2>Últimos presupuestos <button class="btn ghost" type="button" onclick="location.hash='presupuestos'">Ver todos →</button></h2><p class="sub">Las solicitudes más recientes.</p><div id="lastLeads"><div class="skel"></div></div></div>
  </div>`;
  $('#range').onclick = (e) => { const b = e.target.closest('button'); if (b) { days = +b.dataset.d; viewPanel(); } };
  drawChart($('#chart'), s.daily, s.days);
  try {
    const { leads } = await api('/api/admin?action=leads');
    $('#lastLeads').innerHTML = leads.length ? `<table class="tbl"><tbody>${leads.slice(0, 5).map((l) => `<tr><td><b>${esc(l.nombre)}</b><br><small style="color:var(--ink-3)">${esc(l.tipo || '')}${l.fecha ? ' · ' + esc(fdate(l.fecha)) : ''}</small></td><td><span class="pill ${esc(l.status)}">${esc(cap(l.status))}</span></td><td class="r" style="color:var(--ink-3);font-size:.82rem">${ago(l.created_at)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Todavía no llegan solicitudes. Aparecerán aquí apenas alguien complete el formulario.</div>';
  } catch {}
}

function drawChart(el, daily, nDays) {
  const map = Object.fromEntries(daily.map((d) => [d.d, d]));
  const pts = [];
  for (let i = nDays - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 864e5);
    const k = dt.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    pts.push({ k, v: map[k]?.sessions || 0, pv: map[k]?.pageviews || 0, label: dt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }) });
  }
  const W = 600, H = 240, L = 34, R = 8, Tp = 10, B = 26;
  const max = Math.max(4, ...pts.map((p) => p.v));
  const nice = Math.ceil(max / 4) * 4;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1);
  const y = (v) => Tp + (H - Tp - B) * (1 - v / nice);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, nice / 4, nice / 2, (3 * nice) / 4, nice];
  const every = Math.ceil(pts.length / 6);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visitas por día">
    <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--rose)" stop-opacity=".28"/><stop offset="1" stop-color="var(--rose)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${t}</text>`).join('')}
    ${pts.map((p, i) => (i % every === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${p.label}</text>` : '').join('')}
    <path d="${area}" fill="url(#ar)"/>
    <path d="${line}" fill="none" stroke="var(--rose)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <line id="cx" y1="${Tp}" y2="${H - B}" stroke="var(--ink-3)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" opacity="0"/>
    <circle id="cd" r="5" fill="var(--rose)" stroke="var(--panel)" stroke-width="2" opacity="0"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(pts[pts.length - 1].v)}" r="4" fill="var(--rose)" stroke="var(--panel)" stroke-width="2"/>
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip"></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('#tip'), cx = el.querySelector('#cx'), cd = el.querySelector('#cd');
  const move = (ev) => {
    const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((px - L) / (W - L - R)) * (pts.length - 1))));
    const p = pts[i];
    cx.setAttribute('x1', x(i)); cx.setAttribute('x2', x(i)); cx.setAttribute('opacity', 1);
    cd.setAttribute('cx', x(i)); cd.setAttribute('cy', y(p.v)); cd.setAttribute('opacity', 1);
    tip.innerHTML = `${p.label}<b>${fmt(p.v)} visita${p.v === 1 ? '' : 's'}</b>${fmt(p.pv)} páginas vistas`;
    tip.style.left = (x(i) / W) * r.width + 'px'; tip.style.top = (y(p.v) / H) * r.height + 'px'; tip.style.opacity = 1;
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cx.setAttribute('opacity', 0); cd.setAttribute('opacity', 0); });
}

/* ---------- Presupuestos ---------- */
const STATUS = ['nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado'];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); if (m < 60) return `hace ${m} min`; const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`; const d = Math.round(h / 24); return d < 31 ? `hace ${d} día${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('es-CL'); };
const fdate = (s) => { const d = new Date(s + 'T12:00:00'); return isNaN(d) ? s : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }); };
function waOf(l) { let n = String(l.whatsapp || '').replace(/\D/g, ''); if (!n) return ''; if (n.length === 9 && n[0] === '9') n = '56' + n; return n; }
let LEADS = [], lfilter = 'todos', lquery = '';
async function viewLeads() {
  view.innerHTML = `<div class="top"><div><h1>Presupuestos</h1><p>Personas que pidieron cotización desde el formulario.</p></div><button class="btn" type="button" id="csv">${ICON.down}Descargar Excel (CSV)</button></div><div class="skel"></div>`;
  try { LEADS = (await api('/api/admin?action=leads')).leads; } catch (ex) { view.insertAdjacentHTML('beforeend', `<div class="empty">${esc(ex.message)}</div>`); return; }
  renderLeads();
}
function renderLeads() {
  newLeads = LEADS.filter((l) => l.status === 'nuevo').length; nav('presupuestos');
  const counts = Object.fromEntries(STATUS.map((s) => [s, LEADS.filter((l) => l.status === s).length]));
  const q = lquery.toLowerCase();
  const list = LEADS.filter((l) => (lfilter === 'todos' || l.status === lfilter) && (!q || [l.nombre, l.email, l.whatsapp, l.lugar, l.mensaje, l.tipo].join(' ').toLowerCase().includes(q)));
  view.innerHTML = `<div class="top"><div><h1>Presupuestos</h1><p>${LEADS.length} solicitud${LEADS.length === 1 ? '' : 'es'} en total · ${counts.nuevo} sin responder.</p></div><button class="btn" type="button" id="csv">${ICON.down}Descargar Excel (CSV)</button></div>
  <div class="toolbar"><div class="chips" id="lchips"><button type="button" class="chip ${lfilter === 'todos' ? 'on' : ''}" data-f="todos">Todos<em>${LEADS.length}</em></button>${STATUS.map((s) => `<button type="button" class="chip ${lfilter === s ? 'on' : ''}" data-f="${s}">${cap(s)}<em>${counts[s]}</em></button>`).join('')}</div>
  <input class="search" id="lsearch" type="search" placeholder="Buscar por nombre, correo, lugar…" value="${esc(lquery)}"></div>
  <div class="leads">${list.length ? list.map(leadCard).join('') : `<div class="empty">${LEADS.length ? 'Ninguna solicitud coincide con el filtro.' : 'Todavía no llegan solicitudes. Cuando alguien complete el formulario de contacto aparecerá aquí, con botones para responder por WhatsApp o correo.'}</div>`}</div>`;
  $('#lchips').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { lfilter = b.dataset.f; renderLeads(); } };
  $('#lsearch').oninput = (e) => { lquery = e.target.value; const pos = e.target.selectionStart; renderLeads(); const s = $('#lsearch'); s.focus(); s.setSelectionRange(pos, pos); };
  $('#csv').onclick = exportCsv;
}
function leadCard(l) {
  const wa = waOf(l);
  const first = esc((l.nombre || '').split(' ')[0]);
  const waMsg = encodeURIComponent(`Hola ${(l.nombre || '').split(' ')[0]}, soy Magda de Almar Fotografía. Recibí tu solicitud${l.tipo ? ' para ' + l.tipo.toLowerCase() : ''}${l.fecha ? ' del ' + fdate(l.fecha) : ''}. ¿Conversamos?`);
  const mailSub = encodeURIComponent(`Tu cotización · Almar Fotografía`);
  return `<div class="card lead ${l.status === 'nuevo' ? 'isnew' : ''}" data-id="${l.id}">
    <div><h3>${esc(l.nombre)} <span class="pill ${esc(l.status)}">${esc(cap(l.status))}</span>${l.tipo ? `<span class="pill tipo">${esc(l.tipo)}</span>` : ''}</h3>
      <div class="meta"><span>Recibido ${ago(l.created_at)}</span>${l.fecha ? `<span>Evento: <b>${esc(fdate(l.fecha))}</b></span>` : ''}${l.lugar ? `<span>Lugar: ${esc(l.lugar)}</span>` : ''}<span class="srcmini">${LOGO[l.source] || ''}${esc(SRCNAME[l.source] || 'Directo')}</span></div>
      ${l.mensaje ? `<div class="msg">${esc(l.mensaje)}</div>` : ''}
    </div>
    <div class="contact"><span>Correo</span><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.whatsapp ? `<span>WhatsApp</span><span style="text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--ink);font-weight:400">${esc(l.whatsapp)}</span>` : ''}
      <textarea placeholder="Notas internas (ej: le envié propuesta el lunes)" data-notes>${esc(l.notas || '')}</textarea></div>
    <div class="side-a">
      ${wa ? `<a class="btn wa" href="https://wa.me/${wa}?text=${waMsg}" target="_blank" rel="noopener">${ICON.wa}Responder a ${first}</a>` : ''}
      <a class="btn" href="mailto:${esc(l.email)}?subject=${mailSub}">${ICON.mail}Enviar correo</a>
      <select data-status aria-label="Estado">${STATUS.map((s) => `<option value="${s}" ${s === l.status ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select>
      <button class="btn ghost danger" type="button" data-del>${ICON.trash}Eliminar</button>
    </div></div>`;
}
view.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-status]'); if (!sel) return;
  const id = +sel.closest('[data-id]').dataset.id;
  try { const { lead } = await api('/api/admin?action=lead', { method: 'POST', body: JSON.stringify({ id, status: sel.value }) }); LEADS = LEADS.map((l) => (l.id === id ? lead : l)); renderLeads(); toast('Estado actualizado'); } catch (ex) { toast(ex.message); }
});
view.addEventListener('focusout', async (e) => {
  const ta = e.target.closest('[data-notes]'); if (!ta) return;
  const id = +ta.closest('[data-id]').dataset.id; const l = LEADS.find((x) => x.id === id);
  if (!l || (l.notas || '') === ta.value) return;
  try { const { lead } = await api('/api/admin?action=lead', { method: 'POST', body: JSON.stringify({ id, notas: ta.value }) }); Object.assign(l, lead); toast('Nota guardada'); } catch (ex) { toast(ex.message); }
});
view.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]'); if (!del) return;
  if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.innerHTML = '¿Seguro? Toca de nuevo'; setTimeout(() => { if (del.isConnected) { del.dataset.confirm = ''; del.innerHTML = ICON.trash + 'Eliminar'; } }, 4000); return; }
  const id = +del.closest('[data-id]').dataset.id;
  try { await api('/api/admin?action=lead&id=' + id, { method: 'DELETE' }); LEADS = LEADS.filter((l) => l.id !== id); renderLeads(); toast('Solicitud eliminada'); } catch (ex) { toast(ex.message); }
});
function exportCsv() {
  const cols = ['created_at', 'nombre', 'email', 'whatsapp', 'tipo', 'fecha', 'lugar', 'mensaje', 'source', 'status', 'notas'];
  const head = ['Recibido', 'Nombre', 'Correo', 'WhatsApp', 'Tipo', 'Fecha evento', 'Lugar', 'Mensaje', 'Origen', 'Estado', 'Notas'];
  const rows = LEADS.map((l) => cols.map((c) => `"${String(c === 'created_at' ? new Date(l[c]).toLocaleString('es-CL') : l[c] ?? '').replace(/"/g, '""')}"`).join(';'));
  const blob = new Blob(['﻿' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `presupuestos-almar-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Textos ---------- */
let OVR = {}, GCFG = {}, draft = {}, curGroup = 'inicio';
async function loadContent() { const d = await api('/api/admin?action=content'); OVR = d.content || {}; GCFG = d.galleries || {}; }
const val = (k) => (k in draft ? draft[k] : k in OVR ? OVR[k] : DEF[k]);
async function viewTexts(onlyGroup) {
  view.innerHTML = '<div class="skel"></div>';
  try { await loadContent(); } catch (ex) { view.innerHTML = `<div class="empty">${esc(ex.message)}</div>`; return; }
  draft = {};
  if (onlyGroup) curGroup = onlyGroup; else if (curGroup === 'contacto') curGroup = 'inicio';
  renderTexts(onlyGroup);
}
function renderTexts(onlyGroup) {
  const groups = onlyGroup ? SCHEMA.filter((g) => g.id === onlyGroup) : SCHEMA.filter((g) => g.id !== 'contacto');
  const g = groups.find((x) => x.id === curGroup) || groups[0]; curGroup = g.id;
  const nChanged = Object.keys(draft).length;
  const fieldsHtml = g.fields.map((f) => {
    const v = val(f.k); const custom = f.k in OVR;
    const input = f.area ? `<textarea id="f_${f.k}" data-k="${f.k}" rows="${Math.min(8, Math.max(3, Math.ceil((v || '').length / 70)))}">${esc(v)}</textarea>` : `<input id="f_${f.k}" data-k="${f.k}" value="${esc(v)}">`;
    return `<div class="field ${f.k in draft ? 'dirty' : ''}"><label for="f_${f.k}">${esc(f.label)}${custom ? `<button type="button" data-reset="${f.k}">Restaurar original</button>` : ''}</label>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
  }).join('');
  if (onlyGroup) return renderContactView(g, fieldsHtml, nChanged);
  view.innerHTML = `<div class="top"><div><h1>Textos del sitio</h1><p>Edita cualquier texto. Usa *asteriscos* para destacar palabras en rosado y una línea en blanco para separar párrafos.</p></div><a class="btn" href="/#${({ inicio: 'inicio', testimonios: 'inicio', faq: 'inicio', matrimonios: 'matrimonios', otros: 'otros-eventos', corporativas: 'corporativas', galerias: 'galerias', contactopag: 'contacto' })[g.id] || 'inicio'}" target="_blank" rel="noopener">Ver en el sitio ↗</a></div>
  <div class="editor"><div class="groups" id="groups">${groups.map((x) => { const n = x.fields.filter((f) => f.k in OVR).length; return `<button type="button" data-g="${x.id}" class="${x.id === g.id ? 'on' : ''}">${esc(x.title)}${n ? `<em>${n}</em>` : ''}</button>`; }).join('')}</div>
  <div class="card"><h2>${esc(g.title)}</h2>${g.hint ? `<p class="sub">${esc(g.hint)}</p>` : '<p class="sub">Los cambios se publican en el sitio apenas guardas.</p>'}<div class="fields" id="fields">${fieldsHtml}</div>
  <div class="savebar" ${nChanged ? '' : 'hidden'} id="savebar"><span><b id="nch">${nChanged}</b> cambio(s) sin guardar</span><span style="display:flex;gap:8px"><button class="btn ghost" type="button" id="discard" style="color:inherit">Descartar</button><button class="btn pri" type="button" id="save">Guardar y publicar</button></span></div></div></div>`;
  $('#groups').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; curGroup = b.dataset.g; renderTexts(); };
  bindFields(() => renderTexts());
}
function bindFields(rerender) {
  $('#fields').addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const orig = k in OVR ? OVR[k] : DEF[k];
    if (e.target.value === orig) delete draft[k]; else draft[k] = e.target.value;
    e.target.closest('.field').classList.toggle('dirty', k in draft);
    const n = Object.keys(draft).length; $('#savebar').hidden = !n; $('#nch').textContent = n;
    if (k === 'whatsapp' || k === 'email' || k === 'whatsapp_msg') updateWaPreview?.();
  });
  $('#fields').addEventListener('click', async (e) => {
    const k = e.target.dataset.reset; if (!k) return;
    try { await api('/api/admin?action=content', { method: 'POST', body: JSON.stringify({ reset: [k] }) }); delete OVR[k]; delete draft[k]; toast('Texto original restaurado'); rerender(); } catch (ex) { toast(ex.message); }
  });
  $('#discard').onclick = () => { draft = {}; rerender(); };
  $('#save').onclick = async () => {
    const set = { ...draft }; const reset = Object.keys(set).filter((k) => set[k] === DEF[k]); reset.forEach((k) => delete set[k]);
    $('#save').disabled = true;
    try { await api('/api/admin?action=content', { method: 'POST', body: JSON.stringify({ set, reset }) }); Object.assign(OVR, set); reset.forEach((k) => delete OVR[k]); draft = {}; toast('Guardado y publicado'); rerender(); }
    catch (ex) { toast(ex.message); $('#save').disabled = false; }
  };
}

/* ---------- WhatsApp y correo ---------- */
let updateWaPreview = null;
function viewContact() { viewTexts('contacto'); }
function renderContactView(g, fieldsHtml, nChanged) {
  view.innerHTML = `<div class="top"><div><h1>WhatsApp y correo</h1><p>Estos datos aparecen en el botón flotante, la página de contacto y el pie del sitio.</p></div></div>
  <div class="grid g-2"><div class="card"><h2>${esc(g.title)}</h2><p class="sub">Los cambios se publican apenas guardas.</p><div class="fields" id="fields">${fieldsHtml}</div>
  <div class="savebar" ${nChanged ? '' : 'hidden'} id="savebar"><span><b id="nch">${nChanged}</b> cambio(s) sin guardar</span><span style="display:flex;gap:8px"><button class="btn ghost" type="button" id="discard" style="color:inherit">Descartar</button><button class="btn pri" type="button" id="save">Guardar y publicar</button></span></div></div>
  <div class="card"><h2>Vista previa</h2><p class="sub">Así se ve el botón de WhatsApp en el sitio, con los colores de Almar.</p><div id="waprev"></div></div></div>`;
  updateWaPreview = () => {
    const n = String(val('whatsapp') || '').replace(/\D/g, ''); const em = val('email');
    $('#waprev').innerHTML = `<div class="preview-wa"><span class="fab">${ICON.wa}</span><div>${n ? `<b>+${esc(n)}</b><br><a href="https://wa.me/${n}?text=${encodeURIComponent(val('whatsapp_msg'))}" target="_blank" rel="noopener" style="color:var(--rose-ink)">Probar el enlace ↗</a>` : '<b>Sin número configurado</b><br><small style="color:var(--ink-3)">Mientras tanto, el botón lleva a la página de contacto.</small>'}</div></div>
      <div style="margin-top:14px;display:grid;gap:6px;font-size:.9rem"><span style="color:var(--ink-3);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600">Correo visible</span>${em ? esc(em) : '<span style="color:var(--ink-3)">Sin correo configurado</span>'}</div>
      ${n && !/^56\d{9}$/.test(n) ? '<p class="note" style="margin-top:14px">Revisa el número: en Chile debería tener 11 dígitos y empezar con 56 (ej: 56912345678).</p>' : ''}`;
  };
  updateWaPreview();
  bindFields(() => renderTexts('contacto'));
}

/* ---------- Categorías ---------- */
const thumb = (p) => (/^https:/.test(p) ? p : '/img/' + p);
let openPhotos = null, photoMode = 'cover';
async function viewCats() {
  view.innerHTML = '<div class="skel"></div>';
  try { await loadContent(); } catch (ex) { view.innerHTML = `<div class="empty">${esc(ex.message)}</div>`; return; }
  renderCats();
}
function catState() {
  return window.ALMAR_GALLERIES.map((m, i) => {
    const c = GCFG[m.k] || {};
    return { ...m, title: c.title || m.t, intro: c.intro || '', visible: c.visible !== false, order: c.order ?? i, cover: c.cover || (GAL[m.k].find((it) => it[1].includes(m.cover + '.') || it[1].includes(m.cover + '-')) || [])[1], hidden: c.hidden || [], extra: c.extra || [] };
  }).sort((a, b) => a.order - b.order);
}
function renderCats() {
  const cats = catState();
  view.innerHTML = `<div class="top"><div><h1>Categorías</h1><p>Cambia el nombre, el texto, la portada, el orden y qué fotos se muestran en cada galería.</p></div></div>
  <div class="cats">${cats.map((c, idx) => {
    const items = GAL[c.k].map((it) => [it[0], it[1]]).concat(c.extra.map((u) => [u, u]));
    const cov = items.find((it) => it[1] === c.cover) || items[0];
    const shown = items.length - c.hidden.length;
    return `<div class="card cat" data-k="${c.k}">
      <div class="cov">${cov ? `<img src="${esc(thumb(cov[0]))}" alt="" loading="lazy">` : ''}</div>
      <div class="info"><div class="field"><label for="ct_${c.k}">Nombre</label><input id="ct_${c.k}" data-f="title" value="${esc(c.title)}"></div>
        <div class="field"><label for="ci_${c.k}">Texto de presentación (opcional)</label><textarea id="ci_${c.k}" data-f="intro" rows="2">${esc(c.intro)}</textarea></div>
        <small style="color:var(--ink-3)">${shown} de ${items.length} fotos visibles · <a href="/#${c.slug}" target="_blank" rel="noopener">ver galería ↗</a></small></div>
      <div class="ctrl"><label class="switch"><input type="checkbox" data-f="visible" ${c.visible ? 'checked' : ''}>${c.visible ? 'Visible' : 'Oculta'}</label>
        <div class="order"><button type="button" data-move="-1" aria-label="Subir" ${idx === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" aria-label="Bajar" ${idx === cats.length - 1 ? 'disabled' : ''}>↓</button></div>
        <button class="btn" type="button" data-photos>${openPhotos === c.k ? 'Cerrar fotos' : 'Portada y fotos'}</button>
        <button class="btn pri" type="button" data-save>Guardar</button></div>
      ${openPhotos === c.k ? `<div class="photos"><div class="toolbar" style="margin:0"><div class="seg" data-mode><button type="button" data-m="cover" class="${photoMode === 'cover' ? 'on' : ''}">Elegir portada</button><button type="button" data-m="hide" class="${photoMode === 'hide' ? 'on' : ''}">Mostrar / ocultar fotos</button></div><small style="color:var(--ink-3)">${photoMode === 'cover' ? 'Toca una foto para usarla como portada.' : 'Toca una foto para ocultarla o mostrarla en la galería.'}</small></div>
        <div class="pgrid">${items.map((it) => `<button type="button" class="ph ${c.hidden.includes(it[1]) ? 'off' : ''} ${it[1] === c.cover ? 'cover' : ''}" data-p="${esc(it[1])}"><img src="${esc(thumb(it[0]))}" alt="" loading="lazy"></button>`).join('')}</div>
        <div class="addurl"><input type="url" placeholder="Agregar foto por enlace (https://…jpg)" data-addurl><button class="btn" type="button" data-add>Agregar foto</button></div></div>` : ''}
    </div>`;
  }).join('')}</div>`;
}
function catData(k) {
  const card = view.querySelector(`.cat[data-k="${k}"]`); const c = catState().find((x) => x.k === k);
  return { ...c, title: card.querySelector('[data-f="title"]').value.trim() || c.t, intro: card.querySelector('[data-f="intro"]').value.trim(), visible: card.querySelector('[data-f="visible"]').checked };
}
async function saveCat(c, quiet) {
  const data = { title: c.title, intro: c.intro, visible: c.visible, order: c.order, cover: c.cover, hidden: c.hidden, extra: c.extra };
  await api('/api/admin?action=gallery', { method: 'POST', body: JSON.stringify({ key: c.k, data }) });
  GCFG[c.k] = data; if (!quiet) toast('Categoría guardada');
}
view.addEventListener('click', async (e) => {
  const card = e.target.closest('.cat'); if (!card) return;
  const k = card.dataset.k;
  try {
    if (e.target.closest('[data-save]')) { await saveCat(catData(k)); renderCats(); }
    else if (e.target.closest('[data-photos]')) { openPhotos = openPhotos === k ? null : k; renderCats(); }
    else if (e.target.closest('[data-m]')) { photoMode = e.target.closest('[data-m]').dataset.m; renderCats(); }
    else if (e.target.closest('[data-move]')) {
      const dir = +e.target.closest('[data-move]').dataset.move; const cats = catState(); const i = cats.findIndex((x) => x.k === k); const j = i + dir;
      [cats[i], cats[j]] = [cats[j], cats[i]];
      await Promise.all(cats.map((c, n) => { const d = c.k === k ? catData(k) : c; d.order = n; return saveCat(d, true); }));
      toast('Orden actualizado'); renderCats();
    } else if (e.target.closest('.ph')) {
      const p = e.target.closest('.ph').dataset.p; const c = catData(k);
      if (photoMode === 'cover') { c.cover = p; c.hidden = c.hidden.filter((x) => x !== p); }
      else c.hidden = c.hidden.includes(p) ? c.hidden.filter((x) => x !== p) : c.hidden.concat(p);
      await saveCat(c, true); toast(photoMode === 'cover' ? 'Portada actualizada' : 'Galería actualizada'); renderCats();
    } else if (e.target.closest('[data-add]')) {
      const inp = card.querySelector('[data-addurl]'); const u = inp.value.trim();
      if (!/^https:\/\/\S+$/i.test(u)) { toast('Pega un enlace que empiece con https://'); return; }
      const c = catData(k); c.extra = c.extra.concat(u); await saveCat(c, true); toast('Foto agregada'); renderCats();
    }
  } catch (ex) { toast(ex.message); }
});
view.addEventListener('change', (e) => { const sw = e.target.closest('.switch input'); if (sw) sw.parentElement.lastChild.textContent = sw.checked ? 'Visible' : 'Oculta'; });


/* ---------- Cambiar contraseña ---------- */
const pwDlg = $('#pwDlg'), pwForm = $('#pwForm');
function pwStrength(v) {
  let s = 0; if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
  return s;
}
$('#openPw').onclick = () => { pwForm.reset(); $('#pwErr').textContent = ''; $('#pwBar').style.width = '0'; $('#side').classList.remove('open'); pwDlg.showModal(); $('#pwCur').focus(); };
$('#pwCancel').onclick = () => pwDlg.close();
$('#pwShow').onchange = (e) => ['#pwCur', '#pwNew', '#pwRep'].forEach((id) => { $(id).type = e.target.checked ? 'text' : 'password'; });
$('#pwNew').oninput = (e) => {
  const v = e.target.value, s = pwStrength(v);
  const lv = !v ? ['0', 'var(--line)', 'Mínimo 8 caracteres. Mezcla letras, números y algún símbolo.'] : v.length < 8 ? ['20%', 'var(--bad)', `Faltan ${8 - v.length} caracteres.`] : s <= 2 ? ['45%', 'var(--warn)', 'Aceptable. Agrega números o símbolos para hacerla más segura.'] : s <= 3 ? ['72%', 'var(--good)', 'Buena contraseña.'] : ['100%', 'var(--good)', 'Muy segura.'];
  $('#pwBar').style.width = lv[0]; $('#pwBar').style.background = lv[1]; $('#pwHint').textContent = lv[2];
};
pwForm.addEventListener('submit', async (e) => {
  e.preventDefault(); const err = $('#pwErr'); err.textContent = '';
  const current = $('#pwCur').value, next = $('#pwNew').value, rep = $('#pwRep').value;
  if (!current) { err.textContent = 'Escribe tu contraseña actual.'; $('#pwCur').focus(); return; }
  if (next.length < 8) { err.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'; $('#pwNew').focus(); return; }
  if (next !== rep) { err.textContent = 'Las dos contraseñas nuevas no coinciden.'; $('#pwRep').focus(); return; }
  const b = $('#pwSave'); b.disabled = true; b.textContent = 'Guardando…';
  try {
    await api('/api/login', { method: 'PUT', body: JSON.stringify({ current, next }) });
    pwDlg.close(); toast('Contraseña actualizada');
  } catch (ex) { err.textContent = ex.message; }
  finally { b.disabled = false; b.textContent = 'Guardar contraseña'; }
});

/* ---------- Inicio ---------- */
api('/api/login').then((r) => (r.admin ? showApp() : showLogin())).catch(showLogin);
})();
