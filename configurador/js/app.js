/* PadelStudio — Configurador 3D de canchas de padel */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import {
  makeMaterials, updateMaterialColors, buildCourt, buildLights,
  buildEnvironment, DIM,
} from './court3d.js';

// ----------------------------------------------------------------------------
// Estado
// ----------------------------------------------------------------------------
const state = {
  tipo: 'panoramica',        // panoramica | semi | normal
  entorno: 'estudio',        // estudio | patio | club | campo | azotea | indoor
  momento: 'dia',
  cesped: '#15161a',
  estructura: '#0e0f12',
  postesLuz: '#0e0f12',
  acento: '#ff5a00',
  luces: 'curvo',            // curvo | mastil | esquina | rielLED
  logoData: null,
  logoPos: 'pista',
  logoSize: 2.4,
  club: '',
};

const PRESETS = {
  fluor:      { label: 'Negro Flúor',     cesped: '#15161a', estructura: '#0e0f12', postesLuz: '#0e0f12', acento: '#ff5a00' },
  azulpro:    { label: 'Azul Pro',        cesped: '#1f4fd8', estructura: '#0e0f12', postesLuz: '#0e0f12', acento: '#eaff00' },
  verdeclub:  { label: 'Verde Club',      cesped: '#2e7d32', estructura: '#1d3a2a', postesLuz: '#1d3a2a', acento: '#ffffff' },
  ice:        { label: 'White Ice',       cesped: '#b9bfc7', estructura: '#f2f3f5', postesLuz: '#f2f3f5', acento: '#00b3d6' },
  premier:    { label: 'Premier Red',     cesped: '#15161a', estructura: '#0e0f12', postesLuz: '#1a1c20', acento: '#ff1744' },
  mundial:    { label: 'Mundial WPT',     cesped: '#1f4fd8', estructura: '#0e0f12', postesLuz: '#f2f3f5', acento: '#ffffff' },
  terracota:  { label: 'Terracota',       cesped: '#b3502b', estructura: '#0e0f12', postesLuz: '#0e0f12', acento: '#ff5a00' },
  rosaurbana: { label: 'Rosa Urbana',     cesped: '#d6447e', estructura: '#f2f3f5', postesLuz: '#f2f3f5', acento: '#ffffff' },
  grafito:    { label: 'Grafito Lima',    cesped: '#2b2e33', estructura: '#3a3f46', postesLuz: '#3a3f46', acento: '#39ff14' },
  marino:     { label: 'Marino Gold',     cesped: '#14306e', estructura: '#f2f3f5', postesLuz: '#f2f3f5', acento: '#ffc400' },
  bosque:     { label: 'Bosque',          cesped: '#1c4a26', estructura: '#1d3a2a', postesLuz: '#0e0f12', acento: '#eaff00' },
  totalblack: { label: 'Total Black',     cesped: '#101113', estructura: '#0e0f12', postesLuz: '#0e0f12', acento: '#ffffff' },
};

// ----------------------------------------------------------------------------
// Texturas procedurales (canvas)
// ----------------------------------------------------------------------------
function canvasTexture(draw, w = 256, h = 256) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gridTexture() {
  const t = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.4;
    const step = w / 10;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(w, i * step); ctx.stroke();
    }
  }, 512, 512);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function netTexture() {
  const t = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#111316';
    ctx.lineWidth = 3;
    const step = w / 10;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(w, i * step); ctx.stroke();
    }
  }, 256, 256);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function turfBumpTexture() {
  const t = canvasTexture((ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 145;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 13);
  return t;
}

function blobShadowTexture() {
  return canvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function skyTexture(stops) {
  const t = canvasTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 4, 512);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

function windowsTexture() {
  // grilla de ventanas para edificios (emissiveMap)
  const t = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const cols = 6, rows = 22;
    const cw = w / cols, ch = h / rows;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() < 0.55) {
          ctx.fillStyle = rnd() < 0.8 ? '#ffd9a0' : '#bcd4ff';
          ctx.fillRect(c * cw + cw * 0.2, r * ch + ch * 0.22, cw * 0.6, ch * 0.5);
        }
      }
    }
  }, 128, 512);
  return t;
}

function bannerTexture(text, color) {
  const t = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 158px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '14px';
    ctx.fillStyle = color;
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 8);
  }, 2048, 256);
  t.anisotropy = 8;
  return t;
}

// ----------------------------------------------------------------------------
// Escena base
// ----------------------------------------------------------------------------
const canvas = document.getElementById('c3d');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 800);
camera.position.set(17.5, 11.0, 21.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 1.1;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const sun = new THREE.DirectionalLight(0xfff3de, 3.2);
sun.position.set(16, 26, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
sun.shadow.radius = 5;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0xe9eef6, 0x83878c, 0.95);
scene.add(hemi);

const indoorLights = new THREE.Group();
for (const px of [-10, 0, 10]) {
  const p = new THREE.PointLight(0xf2f5ff, 0, 60, 2);
  p.position.set(px, 12.6, 0);
  indoorLights.add(p);
}
scene.add(indoorLights);

// texturas + materiales
const tex = {
  grid: gridTexture(),
  net: netTexture(),
  turfBump: turfBumpTexture(),
  windows: windowsTexture(),
};
const SKIES = {
  estudio: skyTexture([[0, '#bcccdf'], [0.55, '#dfe7ef'], [1, '#f2f4f6']]),
  exterior: skyTexture([[0, '#79a3d6'], [0.5, '#b8d0e8'], [1, '#e8eef2']]),
  noche: skyTexture([[0, '#04060c'], [0.62, '#0c1119'], [1, '#161c26']]),
};

const mats = makeMaterials(state, tex);
mats.ledRail = new THREE.MeshStandardMaterial({
  color: 0x16181c, emissive: state.acento, emissiveIntensity: 1.4,
});
mats.hallLight = new THREE.MeshStandardMaterial({
  color: 0x101114, emissive: 0xffffff, emissiveIntensity: 2.6,
});
mats.blob = new THREE.MeshBasicMaterial({
  map: blobShadowTexture(), transparent: true, depthWrite: false,
});

// grupos reconstruibles
let gEnv = null, gCourt = null, gLights = null, gBrand = null;
let spots = [];
let logoTexture = null, logoAspect = 1;

function disposeGroup(g) {
  if (!g) return;
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
}

function rebuildEnv() {
  disposeGroup(gEnv);
  gEnv = buildEnvironment(state, mats);
  scene.add(gEnv);
}

function rebuildCourt() {
  disposeGroup(gCourt);
  gCourt = buildCourt(state, mats);
  scene.add(gCourt);
}

function rebuildLights() {
  disposeGroup(gLights);
  const r = buildLights(state, mats);
  gLights = r.group;
  spots = r.spots;
  scene.add(gLights);
}

function rebuildBrand() {
  disposeGroup(gBrand);
  gBrand = new THREE.Group();
  const D = DIM;
  if (logoTexture && (state.logoPos === 'pista' || state.logoPos === 'ambos')) {
    const w = state.logoSize, h = state.logoSize / logoAspect;
    const mat = new THREE.MeshStandardMaterial({
      map: logoTexture, transparent: true, roughness: 0.85,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.position.set(sx * 3.5, D.TURF + 0.004, 0);
      gBrand.add(p);
    }
  }
  if (logoTexture && (state.logoPos === 'vidrio' || state.logoPos === 'ambos')) {
    const w = state.logoSize * 0.85, h = w / logoAspect;
    const mat = new THREE.MeshBasicMaterial({
      map: logoTexture, transparent: true, opacity: 0.92,
    });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.position.set(sx * (D.WALL_X - 0.04), 1.62, 0);
      gBrand.add(p);
    }
  }
  if (state.club && state.club.trim()) {
    const bt = bannerTexture(state.club.trim(), state.acento);
    const mat = new THREE.MeshBasicMaterial({ map: bt, transparent: true });
    // en panoramica el nombre va impreso en el vidrio (no hay franja superior)
    const y = state.tipo === 'panoramica' ? 2.45 : 3.55;
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.9), mat);
      p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.position.set(sx * (D.WALL_X - 0.06), y, 0);
      gBrand.add(p);
    }
  }
  scene.add(gBrand);
}

// ----------------------------------------------------------------------------
// Iluminacion dia/noche por entorno
// ----------------------------------------------------------------------------
function applyLighting() {
  const night = state.momento === 'noche';
  const indoor = state.entorno === 'indoor';

  // IBL global: se apaga de noche y se atenua indoor
  const envInt = indoor ? (night ? 0.05 : 0.32) : (night ? 0.06 : 1.0);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (m && m.isMeshStandardMaterial) m.envMapIntensity = envInt;
      if (m && m.isMeshPhysicalMaterial) {
        m.envMapIntensity = night ? 0.15 : (indoor ? 0.5 : 1.4);
      }
    }
  });

  if (indoor) {
    scene.background = new THREE.Color(0x0b0d10);
    sun.visible = false;
    hemi.intensity = night ? 0.16 : 0.95;
    hemi.color.set(0xdfe8f6);
    indoorLights.children.forEach((p) => { p.intensity = night ? 30 : 560; });
    mats.hallLight.emissiveIntensity = night ? 0.22 : 3.6;
    controls.maxDistance = 42;
  } else {
    scene.background = night ? SKIES.noche
      : (state.entorno === 'estudio' ? SKIES.estudio : SKIES.exterior);
    sun.visible = !night;
    hemi.intensity = night ? 0.14 : 0.95;
    hemi.color.set(night ? 0x96a8c8 : 0xe9eef6);
    indoorLights.children.forEach((p) => { p.intensity = 0; });
    controls.maxDistance = 70;
  }

  // ventanas de casas/edificios encendidas de noche
  mats.windowGlow.emissiveIntensity = night ? 2.6 : 0.05;

  const perSpot = state.luces === 'rielLED' ? 340 : 460;
  spots.forEach((s) => { s.intensity = night ? perSpot : 0; });

  mats.led.emissiveIntensity = night ? 3.6 : 0.5;
  mats.ledRail.emissiveIntensity = night ? 6.0 : 1.4;
  mats.accent.emissiveIntensity = night ? 1.1 : 0.3;
  renderer.toneMappingExposure = night ? 0.9 : (indoor ? 1.0 : 1.06);
}

// ----------------------------------------------------------------------------
// Precios (CLP, referenciales)
// ----------------------------------------------------------------------------
const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
});

function computePrice() {
  const rows = [];
  const base = { panoramica: 21900000, semi: 18900000, normal: 14900000 }[state.tipo];
  rows.push([{
    panoramica: 'Pista panorámica 100% (vidrio estructural pegado)',
    semi: 'Pista semi panorámica (perfiles solo en esquinas)',
    normal: 'Pista normal 20×10 (pilares en cada paño)',
  }[state.tipo], base]);

  const luces = { curvo: 2600000, mastil: 2400000, esquina: 2900000, rielLED: 3400000 }[state.luces];
  rows.push([{
    curvo: 'Iluminación · 4 brazos curvos LED',
    mastil: 'Iluminación · 4 mástiles rectos tipo WPT',
    esquina: 'Iluminación · 4 mástiles de esquina 45°',
    rielLED: 'Iluminación · riel LED perimetral integrado',
  }[state.luces], luces]);

  if (state.entorno === 'indoor') {
    rows.push(['Kit montaje indoor (anclajes y reparto de cargas)', 850000]);
  }
  if (state.entorno === 'azotea') {
    rows.push(['Refuerzo antiviento y anclaje para azotea', 1190000]);
  }
  if (!['#15161a', '#2e7d32'].includes(state.cesped.toLowerCase())) {
    rows.push(['Césped color premium', 480000]);
  }
  if (state.logoData && (state.logoPos === 'pista' || state.logoPos === 'ambos')) {
    rows.push(['Logo inlay en pista (×2)', 380000]);
  }
  if (state.logoData && (state.logoPos === 'vidrio' || state.logoPos === 'ambos')) {
    rows.push(['Logo impreso en vidrios de fondo (×2)', 290000]);
  }
  if (state.club && state.club.trim()) rows.push(['Rotulación nombre del club (×2)', 190000]);

  const total = rows.reduce((a, r) => a + r[1], 0);
  return { rows, total };
}

function renderPrice() {
  const { rows, total } = computePrice();
  const ul = document.getElementById('priceRows');
  ul.innerHTML = rows
    .map(([label, v]) => `<li><span>${label}</span><b>${CLP.format(v)}</b></li>`)
    .join('');
  document.getElementById('priceTotal').textContent = CLP.format(total);
}

// ----------------------------------------------------------------------------
// UI
// ----------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), 2400);
}

function buildSwatches(elId, colors, key, onChange) {
  const el = $(elId);
  el.innerHTML = '';
  for (const [c, name] of colors) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.title = name;
    b.dataset.c = c;
    b.addEventListener('click', () => {
      state[key] = c;
      syncSwatch(el, c);
      onChange();
    });
    el.appendChild(b);
  }
  const custom = document.createElement('label');
  custom.className = 'swatch custom';
  custom.title = 'Color personalizado';
  const inp = document.createElement('input');
  inp.type = 'color';
  inp.value = state[key];
  inp.addEventListener('input', () => {
    state[key] = inp.value;
    syncSwatch(el, inp.value);
    onChange();
  });
  custom.appendChild(inp);
  el.appendChild(custom);
  syncSwatch(el, state[key]);
}

function syncSwatch(el, c) {
  el.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('on', (s.dataset.c || '').toLowerCase() === c.toLowerCase());
  });
}

function bindSegmented(elId, key, onChange) {
  const el = $(elId);
  el.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      state[key] = b.dataset.v;
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onChange();
    });
  });
}

function syncSegmented(elId, value) {
  $(elId).querySelectorAll('button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === value);
  });
}

function bindCards(elId, key, onChange) {
  document.querySelectorAll(`#${elId} .cardopt`).forEach((b) => {
    b.addEventListener('click', () => {
      state[key] = b.dataset.v;
      syncCards(elId, state[key]);
      onChange();
    });
  });
}

function syncCards(elId, value) {
  document.querySelectorAll(`#${elId} .cardopt`).forEach((b) => {
    b.classList.toggle('on', b.dataset.v === value);
  });
}

const HINT_TIPO = {
  panoramica: 'Vidrio 100% continuo pegado con silicona estructural y acrílicos: cero perfiles de fierro sobre el cristal.',
  semi: 'Perfiles de acero solo en las 4 esquinas; juntas de vidrio con fijaciones puntuales tipo botón.',
  normal: 'Pilares verticales en cada paño de vidrio, de piso a remate, sin vigas intermedias horizontales.',
};
const HINT_LUCES = {
  curvo: '4 brazos curvos nacidos de la estructura a la altura de las vigas, con barra LED de 200 W.',
  mastil: '4 mástiles verticales tipo World Padel Tour montados sobre los postes, con cruceta y doble proyector plano.',
  esquina: '4 mástiles en las esquinas con barra LED girada 45°, estilo Premier Padel.',
  rielLED: 'Línea LED continua integrada al riel perimetral: luz envolvente sin postes, máximo efecto de noche.',
};

function onColors() {
  updateMaterialColors(mats, state);
  mats.ledRail.emissive.set(state.acento);
  rebuildBrand();
  renderPrice();
}

function onStructure() {
  $('hintTipo').textContent = HINT_TIPO[state.tipo];
  rebuildCourt();
  rebuildLights();   // el modelo "esquina" cambia su anclaje segun tipo
  rebuildBrand();
  applyLighting();
  renderPrice();
}

function onEnv() {
  rebuildEnv();
  applyLighting();
  renderPrice();
}

function onLights() {
  $('hintLuces').textContent = HINT_LUCES[state.luces];
  syncCards('cardsLuces', state.luces);
  rebuildLights();
  applyLighting();
  renderPrice();
}

function syncUI() {
  syncSegmented('segTipo', state.tipo);
  syncSegmented('segMomento', state.momento);
  syncSegmented('segLogoPos', state.logoPos);
  syncCards('cardsEntorno', state.entorno);
  syncCards('cardsLuces', state.luces);
  syncSwatch($('swCesped'), state.cesped);
  syncSwatch($('swEstructura'), state.estructura);
  syncSwatch($('swPostes'), state.postesLuz);
  syncSwatch($('swAcento'), state.acento);
  $('hintTipo').textContent = HINT_TIPO[state.tipo];
  $('hintLuces').textContent = HINT_LUCES[state.luces];
  $('clubName').value = state.club;
  $('logoSize').value = state.logoSize;
}

function initUI() {
  // presets dinamicos
  const pc = $('presets');
  pc.innerHTML = '';
  for (const [id, p] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      const { label, ...colors } = p;
      Object.assign(state, colors);
      syncUI();
      onColors();
      toast(`Preset aplicado: ${label}`);
    });
    pc.appendChild(b);
  }

  buildSwatches('swCesped', [
    ['#15161a', 'Negro'], ['#2b2e33', 'Grafito'], ['#1f4fd8', 'Azul'],
    ['#14306e', 'Azul marino'], ['#2e7d32', 'Verde'], ['#1c4a26', 'Verde oscuro'],
    ['#b3502b', 'Terracota'], ['#d6447e', 'Rosa'], ['#b9bfc7', 'Gris claro'],
  ], 'cesped', onColors);

  buildSwatches('swEstructura', [
    ['#0e0f12', 'Negro'], ['#3a3f46', 'Antracita'], ['#f2f3f5', 'Blanco'],
    ['#1c2c54', 'Azul marino'], ['#1d3a2a', 'Verde bosque'], ['#5a3d2b', 'Corten'],
  ], 'estructura', onColors);

  buildSwatches('swPostes', [
    ['#0e0f12', 'Negro'], ['#3a3f46', 'Antracita'], ['#f2f3f5', 'Blanco'],
    ['#1a1c20', 'Grafito'], ['#ff5a00', 'Naranjo'], ['#1c2c54', 'Azul marino'],
  ], 'postesLuz', onColors);

  buildSwatches('swAcento', [
    ['#ff5a00', 'Naranjo flúor'], ['#eaff00', 'Amarillo flúor'],
    ['#39ff14', 'Verde flúor'], ['#00e5ff', 'Cian'],
    ['#ff1744', 'Rojo'], ['#ffc400', 'Dorado'], ['#ffffff', 'Blanco'],
  ], 'acento', onColors);

  bindSegmented('segTipo', 'tipo', onStructure);
  bindSegmented('segMomento', 'momento', applyLighting);
  bindSegmented('segLogoPos', 'logoPos', rebuildBrand);
  bindCards('cardsEntorno', 'entorno', onEnv);
  bindCards('cardsLuces', 'luces', onLights);

  $('autoRotate').addEventListener('change', (e) => {
    controls.autoRotate = e.target.checked;
  });

  // logo
  $('logoFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      state.logoData = rd.result;
      const img = new Image();
      img.onload = () => {
        logoAspect = img.width / img.height || 1;
        logoTexture = new THREE.Texture(img);
        logoTexture.colorSpace = THREE.SRGBColorSpace;
        logoTexture.anisotropy = 8;
        logoTexture.needsUpdate = true;
        $('logoPreview').src = rd.result;
        $('logoOpts').classList.remove('hidden');
        rebuildBrand();
        renderPrice();
        toast('Logo cargado');
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });

  $('logoRemove').addEventListener('click', () => {
    state.logoData = null;
    logoTexture = null;
    $('logoFile').value = '';
    $('logoOpts').classList.add('hidden');
    rebuildBrand();
    renderPrice();
  });

  $('logoSize').addEventListener('input', (e) => {
    state.logoSize = parseFloat(e.target.value);
    rebuildBrand();
  });

  $('clubName').addEventListener('input', (e) => {
    state.club = e.target.value;
    rebuildBrand();
    renderPrice();
  });

  // captura PNG
  $('btnShot').addEventListener('click', () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.download = 'padelstudio-cancha.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
    toast('Imagen descargada');
  });

  // compartir configuracion via URL
  $('btnShare').addEventListener('click', async () => {
    const { logoData, ...shareable } = state;
    const hash = btoa(unescape(encodeURIComponent(JSON.stringify(shareable))));
    const url = `${location.origin}${location.pathname}#${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado (el logo no viaja en el enlace)');
    } catch {
      prompt('Copia el enlace:', url);
    }
  });

  // cotizacion via correo
  $('btnQuote').addEventListener('click', () => {
    const { rows, total } = computePrice();
    const body = [
      'Hola, quiero cotizar la siguiente cancha de pádel configurada en PadelStudio:',
      '',
      ...rows.map(([l, v]) => `• ${l}: ${CLP.format(v)}`),
      '',
      `TOTAL REFERENCIAL: ${CLP.format(total)} + IVA`,
      '',
      `Tipo: ${state.tipo} · Entorno: ${state.entorno} · Luces: ${state.luces}`,
      `Césped: ${state.cesped} · Estructura: ${state.estructura} · Postes luz: ${state.postesLuz} · Acento: ${state.acento}`,
      state.club ? `Club: ${state.club}` : '',
    ].join('\n');
    location.href = `mailto:?subject=${encodeURIComponent('Cotización cancha de pádel — PadelStudio')}&body=${encodeURIComponent(body)}`;
  });
}

function loadFromHash() {
  if (!location.hash || location.hash.length < 2) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
    for (const k of ['tipo', 'entorno', 'momento', 'cesped', 'estructura',
      'postesLuz', 'acento', 'luces', 'logoPos', 'logoSize', 'club']) {
      if (data[k] !== undefined) state[k] = data[k];
    }
    // migracion de enlaces antiguos
    if (state.tipo === 'clasica') state.tipo = 'normal';
    if (state.entorno === 'outdoor') state.entorno = 'estudio';
    if (state.luces === 'columna') state.luces = 'mastil';
    toast('Configuración cargada desde el enlace');
  } catch { /* hash invalido: ignorar */ }
}

// ----------------------------------------------------------------------------
// Loop
// ----------------------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) ||
      canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  controls.update();
  renderer.render(scene, camera);
}

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
loadFromHash();
initUI();
syncUI();
rebuildEnv();
rebuildCourt();
rebuildLights();
rebuildBrand();
onColors();
applyLighting();
renderPrice();
animate();
