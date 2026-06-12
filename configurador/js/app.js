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
  tipo: 'panoramica',
  entorno: 'outdoor',
  momento: 'dia',
  cesped: '#15161a',
  estructura: '#0e0f12',
  acento: '#ff5a00',
  luces: 'curvo',
  logoData: null,
  logoPos: 'pista',
  logoSize: 2.4,
  club: '',
};

const PRESETS = {
  fluor:     { cesped: '#15161a', estructura: '#0e0f12', acento: '#ff5a00' },
  azulpro:   { cesped: '#1f4fd8', estructura: '#0e0f12', acento: '#eaff00' },
  verdeclub: { cesped: '#2e7d32', estructura: '#1d3a2a', acento: '#ffffff' },
  ice:       { cesped: '#b9bfc7', estructura: '#f2f3f5', acento: '#00b3d6' },
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
  // celda 50x50mm; el lienzo representa 0.5m
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
  // celda 45mm; lienzo = 0.45m
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

function skyTexture(night) {
  const t = canvasTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (night) {
      g.addColorStop(0, '#04060c');
      g.addColorStop(0.62, '#0c1119');
      g.addColorStop(1, '#161c26');
    } else {
      g.addColorStop(0, '#bcccdf');
      g.addColorStop(0.55, '#dfe7ef');
      g.addColorStop(1, '#f2f4f6');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 4, 512);
  t.mapping = THREE.EquirectangularReflectionMapping;
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
const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 500);
camera.position.set(17.5, 11.0, 21.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 55;
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
for (const px of [-8, 0, 8]) {
  const p = new THREE.PointLight(0xf2f5ff, 0, 40, 2);
  p.position.set(px, 8.2, 0);
  indoorLights.add(p);
}
scene.add(indoorLights);

// texturas + materiales
const tex = {
  grid: gridTexture(),
  net: netTexture(),
  turfBump: turfBumpTexture(),
};
const skyDay = skyTexture(false);
const skyNight = skyTexture(true);

const mats = makeMaterials(state, tex);
mats.ledRail = new THREE.MeshStandardMaterial({
  color: 0x16181c, emissive: state.acento, emissiveIntensity: 1.4,
});
mats.hallLight = new THREE.MeshStandardMaterial({
  color: 0x101114, emissive: 0xffffff, emissiveIntensity: 2.4,
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
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.9), mat);
      p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.position.set(sx * (D.WALL_X - 0.06), 3.55, 0);
      gBrand.add(p);
    }
  }
  scene.add(gBrand);
}

// ----------------------------------------------------------------------------
// Iluminacion dia/noche + entorno
// ----------------------------------------------------------------------------
function applyLighting() {
  const night = state.momento === 'noche';
  const indoor = state.entorno === 'indoor';

  // la luz ambiental IBL debe apagarse de noche y atenuarse indoor
  const envInt = indoor ? (night ? 0.05 : 0.32) : (night ? 0.06 : 1.0);
  for (const m of [mats.turf, mats.steel, mats.accent, mats.white, mats.fence,
    mats.net, mats.slab, mats.led, mats.ground, mats.hallFloor, mats.hallWall]) {
    if (m) m.envMapIntensity = envInt;
  }
  mats.glass.envMapIntensity = night ? 0.15 : (indoor ? 0.5 : 1.4);

  if (indoor) {
    scene.background = new THREE.Color(0x0b0d10);
    sun.visible = false;
    hemi.intensity = night ? 0.16 : 0.78;
    hemi.color.set(0xdfe8f6);
    indoorLights.children.forEach((p) => { p.intensity = night ? 14 : 160; });
    mats.hallLight.emissiveIntensity = night ? 0.22 : 3.2;
    controls.maxDistance = 24;
  } else {
    scene.background = night ? skyNight : skyDay;
    sun.visible = !night;
    hemi.intensity = night ? 0.14 : 0.95;
    hemi.color.set(night ? 0x96a8c8 : 0xe9eef6);
    indoorLights.children.forEach((p) => { p.intensity = 0; });
    controls.maxDistance = 55;
  }

  spots.forEach((s) => { s.intensity = night ? 420 : 0; });

  mats.led.emissiveIntensity = night ? 3.6 : 0.5;
  mats.ledRail.emissiveIntensity = night ? 4.2 : 1.4;
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
  const base = state.tipo === 'panoramica' ? 18900000 : 14900000;
  rows.push([state.tipo === 'panoramica'
    ? 'Cancha panorámica 20×10 (vidrio templado 12 mm)'
    : 'Cancha clásica 20×10 (vidrio + estructura)', base]);

  const luces = { curvo: 2600000, columna: 1950000, rielLED: 3400000 }[state.luces];
  rows.push([{
    curvo: 'Iluminación · 4 brazos curvos LED',
    columna: 'Iluminación · 4 columnas LED',
    rielLED: 'Iluminación · riel LED perimetral',
  }[state.luces], luces]);

  if (state.entorno === 'indoor') rows.push(['Kit montaje indoor (anclajes y reparto de cargas)', 850000]);
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

const HINT_TIPO = {
  panoramica: 'Fondos de vidrio continuo, sin postes intermedios. Máxima visibilidad para espectadores.',
  clasica: 'Estructura tradicional con postes intermedios en los fondos. Gran robustez y menor costo.',
};
const HINT_LUCES = {
  curvo: '4 brazos curvos montados sobre la estructura con barra LED de 200 W.',
  columna: '4 columnas rectas de 6 m ancladas al piso, con proyector LED.',
  rielLED: 'Línea LED continua integrada al riel perimetral. Luz envolvente sin postes.',
};

function onColors() {
  updateMaterialColors(mats, state);
  mats.ledRail.emissive.set(state.acento);
  rebuildBrand();   // el banner usa el color de acento
  renderPrice();
}

function onStructure() {
  $('hintTipo').textContent = HINT_TIPO[state.tipo];
  rebuildCourt();
  rebuildBrand();
  renderPrice();
}

function onEnv() {
  rebuildEnv();
  applyLighting();
  renderPrice();
}

function onLights() {
  $('hintLuces').textContent = HINT_LUCES[state.luces];
  document.querySelectorAll('#cardsLuces .cardopt').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === state.luces);
  });
  rebuildLights();
  applyLighting();
  renderPrice();
}

function syncUI() {
  syncSegmented('segTipo', state.tipo);
  syncSegmented('segEntorno', state.entorno);
  syncSegmented('segMomento', state.momento);
  syncSegmented('segLogoPos', state.logoPos);
  syncSwatch($('swCesped'), state.cesped);
  syncSwatch($('swEstructura'), state.estructura);
  syncSwatch($('swAcento'), state.acento);
  document.querySelectorAll('#cardsLuces .cardopt').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === state.luces);
  });
  $('hintTipo').textContent = HINT_TIPO[state.tipo];
  $('hintLuces').textContent = HINT_LUCES[state.luces];
  $('clubName').value = state.club;
  $('logoSize').value = state.logoSize;
}

function initUI() {
  buildSwatches('swCesped', [
    ['#15161a', 'Negro'], ['#2b2e33', 'Grafito'], ['#1f4fd8', 'Azul'],
    ['#2e7d32', 'Verde'], ['#b3502b', 'Terracota'], ['#d6447e', 'Rosa'],
  ], 'cesped', onColors);

  buildSwatches('swEstructura', [
    ['#0e0f12', 'Negro'], ['#3a3f46', 'Antracita'], ['#f2f3f5', 'Blanco'],
    ['#1c2c54', 'Azul marino'], ['#1d3a2a', 'Verde bosque'],
  ], 'estructura', onColors);

  buildSwatches('swAcento', [
    ['#ff5a00', 'Naranjo flúor'], ['#eaff00', 'Amarillo flúor'],
    ['#39ff14', 'Verde flúor'], ['#00e5ff', 'Cian'],
    ['#ff1744', 'Rojo'], ['#ffffff', 'Blanco'],
  ], 'acento', onColors);

  bindSegmented('segTipo', 'tipo', onStructure);
  bindSegmented('segEntorno', 'entorno', onEnv);
  bindSegmented('segMomento', 'momento', applyLighting);
  bindSegmented('segLogoPos', 'logoPos', rebuildBrand);

  document.querySelectorAll('#cardsLuces .cardopt').forEach((b) => {
    b.addEventListener('click', () => { state.luces = b.dataset.v; onLights(); });
  });

  document.querySelectorAll('#presets .chip').forEach((b) => {
    b.addEventListener('click', () => {
      Object.assign(state, PRESETS[b.dataset.preset]);
      syncUI();
      onColors();
      toast(`Preset aplicado: ${b.textContent}`);
    });
  });

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
      `Césped: ${state.cesped} · Estructura: ${state.estructura} · Acento: ${state.acento}`,
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
      'acento', 'luces', 'logoPos', 'logoSize', 'club']) {
      if (data[k] !== undefined) state[k] = data[k];
    }
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
