/* Comportamientos compartidos de las páginas interiores de la maqueta v3 */
const $ = (s) => document.querySelector(s);
// ---------- Íconos Proexsi: línea 1.75px, esquinas redondeadas, detalle naranjo (.ac) ----------
const ICON = {
  server: '<rect x="3.5" y="4" width="17" height="6.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/><path class="ac led" d="M7.5 7.25h.01M7.5 16.75h.01"/><path d="M11.5 7.25h5M11.5 16.75h5"/>',
  grid: '<rect class="g1" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect class="ac g2" x="13.5" y="3.5" width="7" height="7" rx="2"/><rect class="g3" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect class="g4" x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  web: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 8.5h18"/><path class="ac" d="M6 6.25h.01M8.5 6.25h.01"/><path class="br-l" d="m10 12.5-2.2 2.2 2.2 2.2"/><path class="br-r" d="m14 12.5 2.2 2.2-2.2 2.2"/>',
  citizen: '<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.8-3.8 3.4-5.8 6.5-5.8 1.7 0 3.2.6 4.3 1.6"/><path class="ac bubble" d="M15 11.5h5.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1.5l-2 1.8V17H15a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1z"/>',
  shield: '<path d="M12 3.2 4.8 6v5.6c0 4.4 3 8.2 7.2 9.2 4.2-1 7.2-4.8 7.2-9.2V6z"/><path class="ac check" pathLength="1" d="m8.8 12.2 2.3 2.3 4.3-4.6"/>',
  chart: '<path d="M4 20h16"/><path class="b1" d="M7 20v-5"/><path class="b2" d="M12 20v-9"/><path class="b3" d="M17 20v-6.5"/><path class="ac trend" pathLength="1" d="M5 10.5 9.5 6.5l3.5 2.8L19 4.5M15.5 4.5H19V8"/>',
  layers: '<path class="ac" d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle class="ac" cx="12" cy="10" r="2.4"/>',
  city: '<path d="M3.5 20.5h17"/><path d="M5 20.5V9.5l5-3v14"/><path d="M10 20.5V4.5h9v16"/><path class="ac" d="M13 8h.01M16 8h.01M13 11.5h.01M16 11.5h.01M13 15h.01M16 15h.01M7.5 12h.01M7.5 15.5h.01"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.6 13.4-1.6 7.1 5-2.6 5 2.6-1.6-7.1"/><path class="ac" d="m12 6.3.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.4l2-.3z"/>',
  handshake: '<path d="M3 11.5 7 7.5l3 1.5 2.5-1.5"/><path d="m21 11.5-4-4-5 3 3.2 2.6a1.4 1.4 0 0 1-1.8 2.2L11 13.2"/><path class="ac" d="m6.5 14.5 2 1.8a1.4 1.4 0 0 0 2-.2M9 16.8l1.3 1.1a1.4 1.4 0 0 0 2-.2M17 15.5l-1.6 1.4"/><path d="M3 11.5 6.5 14.5M21 11.5 17 15.5"/>',
  car: '<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><path d="M3.5 16.5h17v1.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M5 12h14"/><path class="ac" d="M7.5 14.3h.01M16.5 14.3h.01"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path class="ac" d="M3 10h18"/><path d="M7 14.5h3"/>',
  gavel: '<path d="m13.5 4.5 6 6"/><path d="m11.5 6.5 6 6"/><path d="m10.5 9.5-6.8 6.8a1.6 1.6 0 0 0 2.3 2.3l6.8-6.8"/><path class="ac" d="M14 21h7"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><rect class="ac" x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/><path class="ac" d="M5 18.5 3.5 20M8 20l-1 1"/>',
  chat: '<path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path class="ac" d="M8 11h.01M12 11h.01M16 11h.01"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.5V16M8 7.8h.01M11.5 16v-5.5M11.5 13c0-1.6 1-2.7 2.4-2.7s2.1 1 2.1 2.6V16"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path class="ac" d="m10.2 9.3 4.6 2.7-4.6 2.7z"/>',
  facebook: '<path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5L17 11h-3V9a.5.5 0 0 1 .5-.5z"/>',
  x: '<path d="M4.5 4h4.2l10.8 16h-4.2z"/><path d="M19.2 4 13.4 10.6M10.6 13.4 4.8 20"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6"/><path class="ac" d="M9 15h3"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path class="ac" d="M8 12h2l1-2 2 4 1-2h2"/>',
  ticket: '<path d="M3.5 7.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2.5a2 2 0 0 0 0 4v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z"/><path class="ac" d="M14.5 6.5v11" stroke-dasharray="1.6 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle class="ac" cx="12" cy="12" r="2.8"/>',
  doc: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4"/><path class="ac" d="M9 12h6M9 15.5h4"/>',
  cap: '<path d="m12 5 9.5 4.5L12 14 2.5 9.5z"/><path d="M6.5 11.5V16c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-4.5"/><path class="ac" d="M21.5 9.5V15"/>',
  users: '<circle cx="9" cy="8" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><path class="ac" d="M15.5 4.9a3.3 3.3 0 0 1 0 6.3M18 14.6c1.6.7 2.7 2.4 3 4.9"/>',
  wallet: '<path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M4 7.5 15.5 4v3.5"/><path class="ac" d="M16 13.8h.01"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path class="ac" d="M9.5 16.3c.9 1.3 3.1 2.2 5.5 2.2 3 0 5.5-1.1 5.5-2.5v-4c0-1.4-2.5-2.5-5.5-2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path class="ac" d="M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/><path class="ac" d="m10 8.5 4 1.8-4 1.8z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle class="ac" cx="12" cy="12" r="1.3"/>',
  tree: '<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path class="ac" d="M12 8v4M6 16v-4h12v4"/>',
  download: '<path d="M12 4v11"/><path class="ac" d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  file: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4"/><path class="ac" d="M12 11v5M9.8 13.8 12 16l2.2-2.2"/>'
};
const icon = (n) => `<svg class="i i-${n}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ""}</svg>`;
document.querySelectorAll("[data-icon]").forEach(el => { el.outerHTML = icon(el.dataset.icon); });
// ---------- Menú ----------
(() => {
  const menu = $("#menu"), open = $("#openMenu"), close = $("#closeMenu");
  const set = (v) => { menu.hidden = !v; open.setAttribute("aria-expanded", v); document.body.style.overflow = v ? "hidden" : ""; if (v) close.focus(); else open.focus(); };
  open.addEventListener("click", () => set(true));
  close.addEventListener("click", () => set(false));
  menu.addEventListener("click", (e) => { if (e.target.closest("nav a")) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) set(false); });
})();

// ---------- Menú móvil ----------
(() => {
  const bg = document.getElementById("burger"), mn = document.getElementById("mnav");
  if (!bg || !mn) return;
  bg.addEventListener("click", () => { mn.hidden = !mn.hidden; bg.setAttribute("aria-expanded", !mn.hidden); });
  mn.addEventListener("click", (e) => { if (e.target.closest("a")) { mn.hidden = true; bg.setAttribute("aria-expanded", false); } });
})();
// ---------- Copiar datos de contacto ----------
document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
  navigator.clipboard?.writeText(b.dataset.copy).then(() => { const t = b.textContent; b.textContent = "Copiado"; setTimeout(() => b.textContent = t, 1600); }).catch(() => {
    const r = document.createRange(); r.selectNodeContents(b.parentElement); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
}));
// ---------- Formularios demostrativos ----------
document.querySelectorAll("form[data-demo]").forEach(f => f.addEventListener("submit", (e) => {
  e.preventDefault(); const el = f.elements, m = f.querySelector(".fmsg");
  m.textContent = (!el.name.value.trim() || !el.email.value || !el.email.checkValidity()) ? "Complete su nombre y un correo válido para continuar." : "Maqueta: en el sitio final esta solicitud se enviará a hablemos@proexsi.cl.";
  m.hidden = false;
}));
// ---------- Subnavegación activa ----------
(() => {
  const links = [...document.querySelectorAll(".subnav a")]; if (!links.length) return;
  const io = new IntersectionObserver((es) => es.forEach(en => { if (en.isIntersecting) links.forEach(l => l.classList.toggle("on", l.getAttribute("href") === "#" + en.target.id)); }), { rootMargin: "-40% 0px -55% 0px" });
  links.forEach(l => { const t = document.querySelector(l.getAttribute("href")); if (t) io.observe(t); });
})();
// ---------- Áreas AGM: ver sistemas ----------
document.querySelectorAll(".acard .more").forEach(b => b.addEventListener("click", () => {
  const list = document.getElementById(b.getAttribute("aria-controls")), open = list.hidden;
  list.hidden = !open; b.setAttribute("aria-expanded", open);
  b.querySelector("span").textContent = open ? "Ocultar sistemas" : "Ver sistemas";
  b.closest(".acard").classList.toggle("open", open);
}));
// ---------- Clientes: filtros ----------
(() => {
  const bar = document.querySelector(".filters"); if (!bar) return;
  const items = [...document.querySelectorAll("[data-cat]")], note = document.getElementById("countNote");
  function apply(cat) {
    bar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === cat));
    let n = 0; items.forEach(it => { const show = cat === "all" || it.dataset.cat === cat; it.hidden = !show; if (show) n++; });
    if (note) note.innerHTML = `Mostrando <b>${n}</b> ${n === 1 ? "cliente" : "clientes"}`;
  }
  bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) apply(b.dataset.f); });
  apply("all");
})();
