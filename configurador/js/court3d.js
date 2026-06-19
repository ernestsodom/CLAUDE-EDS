/* court3d.js — construccion parametrica de la cancha (sin dependencias DOM).
   Sistema de coordenadas Y-up: largo en X (±10), ancho en Z (±5), altura Y.
   Reglamento FIP: vidrio 3 m + 1 m de malla superior = 4 m total. */
import * as THREE from './vendor/three.module.min.js';

// ---- dimensiones reglamentarias (m) ----
export const DIM = {
  L: 20, W: 10, HX: 10, HY: 5,
  WALL_X: 10.03, WALL_Z: 5.03,
  SLAB_TOP: 0.07, TURF: 0.084,
  GLASS_H: 3.0,            // 3 m de vidrio
  Z3: 3.07,               // tope de vidrio (slab + 3)
  Z4: 4.07,               // tope de malla (slab + 4)
  DOOR_HALF: 1.15, DOOR_H: 2.12,
  GLASS_T: 0.012,
};

// ----------------------------------------------------------------------------
// Materiales compartidos
// ----------------------------------------------------------------------------
export function makeMaterials(state, tex) {
  const mats = {};
  const std = (opts) => new THREE.MeshStandardMaterial(opts);

  mats.turf = std({ color: state.cesped, roughness: 0.93 });
  if (tex && tex.turfBump) {
    mats.turf.bumpMap = tex.turfBump;
    mats.turf.bumpScale = 0.6;
  }
  mats.steel = std({ color: state.estructura, roughness: 0.45, metalness: 0.55 });
  mats.pole = std({ color: state.postesLuz, roughness: 0.42, metalness: 0.55 });
  mats.bolt = std({ color: 0x2e3138, roughness: 0.35, metalness: 0.85 });
  mats.silicone = std({ color: 0x14161a, roughness: 0.9 });
  mats.accent = std({
    color: state.acento, roughness: 0.4,
    emissive: state.acento, emissiveIntensity: 0.25,
  });
  mats.lines = std({ color: state.lineas || '#e8e8e8', roughness: 0.55 });
  mats.white = std({ color: 0xe8e8e8, roughness: 0.6 });
  mats.glass = new THREE.MeshPhysicalMaterial({
    color: 0xe9f1ef, roughness: 0.05, metalness: 0,
    transmission: 0.92, ior: 1.45, thickness: 0.02,
    envMapIntensity: 1.2,
  });
  mats.fence = std({
    color: state.estructura, roughness: 0.5, metalness: 0.6,
    side: THREE.DoubleSide,
  });
  if (tex && tex.grid) {
    mats.fence.map = tex.grid;
    mats.fence.alphaTest = 0.35;
  }
  mats.net = std({ color: 0x15171a, roughness: 0.8, side: THREE.DoubleSide });
  if (tex && tex.net) {
    mats.net.map = tex.net;
    mats.net.alphaTest = 0.3;
    mats.net.color = new THREE.Color(0xffffff);
  }
  mats.led = std({ color: 0x202226, emissive: 0xfff4e0, emissiveIntensity: 0.4 });
  mats.slab = std({ color: 0x0c0d0f, roughness: 0.7, metalness: 0.1 });

  // ---- entornos ----
  mats.ground = std({ color: 0xb9bdc4, roughness: 0.96 });
  mats.lawn = std({ color: 0x4f7a3f, roughness: 0.95 });
  if (tex && tex.grass) { mats.lawn.map = tex.grass; mats.lawn.color.set(0xffffff); }
  mats.grassField = std({ color: 0x5c8349, roughness: 0.96 });
  if (tex && tex.grass) { mats.grassField.map = tex.grass; mats.grassField.color.set(0xeef3ea); }
  mats.asphalt = std({ color: 0x44484e, roughness: 0.95 });
  mats.concrete = std({ color: 0x9296 - 0x10, roughness: 0.9 });
  mats.concrete.color.set(0x8b8e94);
  mats.deck = std({ color: 0x8a6a45, roughness: 0.82 });
  mats.roofSlab = std({ color: 0x5e6166, roughness: 0.9 });
  mats.parapet = std({ color: 0x9a9da3, roughness: 0.85 });
  mats.wood = std({ color: 0x7a5b3e, roughness: 0.85 });
  mats.houseWall = std({ color: 0xeae3d2, roughness: 0.8 });
  mats.houseWall2 = std({ color: 0xc9bca4, roughness: 0.82 });
  mats.roof = std({ color: 0x6c3f33, roughness: 0.8 });
  mats.trunk = std({ color: 0x5a4630, roughness: 0.9 });
  mats.leaf = std({ color: 0x3c6b32, roughness: 0.92 });
  mats.leaf2 = std({ color: 0x4d7d3a, roughness: 0.92 });
  mats.hedge = std({ color: 0x2f5429, roughness: 0.92 });
  mats.water = std({ color: 0x2b86c7, roughness: 0.12, metalness: 0.2 });
  mats.cityA = std({ color: 0x33373f, roughness: 0.82 });
  mats.cityB = std({ color: 0x4a505a, roughness: 0.82 });
  mats.cityC = std({ color: 0x6a7280, roughness: 0.8 });
  mats.hallFloor = std({ color: 0x3c4046, roughness: 0.92 });
  mats.hallWall = std({ color: 0x181b20, roughness: 0.95, side: THREE.BackSide });
  mats.hallWall2 = std({ color: 0x24282f, roughness: 0.9 });

  // ventanas con grilla emisiva (edificios)
  mats.windowGlow = std({ color: 0x12151c, emissive: 0xffffff, emissiveIntensity: 0.05 });
  if (tex && tex.windows) mats.windowGlow.emissiveMap = tex.windows;

  // estadio
  mats.crowd = std({ color: 0xffffff, roughness: 0.96, side: THREE.DoubleSide });
  if (tex && tex.crowd) mats.crowd.map = tex.crowd;
  mats.stand = std({ color: 0x23262d, roughness: 0.9 });
  mats.standFront = std({ color: 0x16181d, roughness: 0.85, side: THREE.DoubleSide });
  mats.adboard = std({ color: 0x0b0c0f, roughness: 0.5, metalness: 0.1, emissiveIntensity: 0.55, side: THREE.DoubleSide });
  if (tex && tex.adRing) {
    mats.adboard.map = tex.adRing;
    mats.adboard.emissiveMap = tex.adRing;
    mats.adboard.emissive = new THREE.Color(0xffffff);
  }
  mats.arenaRoof = std({ color: 0x0c0e12, roughness: 0.95, side: THREE.BackSide });
  return mats;
}

export function updateMaterialColors(mats, state) {
  mats.turf.color.set(state.cesped);
  mats.steel.color.set(state.estructura);
  mats.pole.color.set(state.postesLuz);
  mats.fence.color.set(state.estructura).multiplyScalar(1.25);
  mats.accent.color.set(state.acento);
  mats.accent.emissive.set(state.acento);
  mats.lines.color.set(state.lineas || '#e8e8e8');
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function addBox(g, mat, w, h, d, x, y, z, shadows = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  g.add(m);
  return m;
}
function addCylX(g, mat, r, len, x, y, z, seg = 16) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg); geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function addCylZ(g, mat, r, len, x, y, z, seg = 16) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg); geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function addCylY(g, mat, r, len, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function addSphere(g, mat, r, x, y, z, sy = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z); m.scale.y = sy; g.add(m); return m;
}
function addPlane(g, mat, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}

/* Placa base de anclaje con 4 pernos hexagonales (detalle de terminacion). */
function anchorPlate(g, mats, x, z, w = 0.2) {
  addBox(g, mats.steel, w, 0.014, w, x, DIM.SLAB_TOP + 0.007, z);
  const o = w / 2 - 0.032;
  for (const dx of [-o, o]) for (const dz of [-o, o]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.04, 6), mats.bolt);
    b.position.set(x + dx, DIM.SLAB_TOP + 0.03, z + dz); b.castShadow = true; g.add(b);
  }
}

/* Panel de malla con UVs escalados (celda textura = 0.5 m). */
function meshPanel(g, mat, orient, fixed, u0, u1, y0, y1) {
  const w = u1 - u0, h = y1 - y0;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.5), uv.getY(i) * (h / 0.5));
  const m = new THREE.Mesh(geo, mat);
  if (orient === 'x') m.position.set((u0 + u1) / 2, (y0 + y1) / 2, fixed);
  else { m.rotation.y = Math.PI / 2; m.position.set(fixed, (y0 + y1) / 2, (u0 + u1) / 2); }
  m.castShadow = false; g.add(m); return m;
}

function treePine(g, mats, x, z, s = 1) {
  addCylY(g, mats.trunk, 0.1 * s, 1.3 * s, x, 0.65 * s, z, 8);
  const leaf = Math.random() > 0.5 ? mats.leaf : mats.leaf2;
  for (let i = 0; i < 3; i++) {
    const r = (1.25 - i * 0.32) * s, hh = (1.4 - i * 0.25) * s;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 9), leaf);
    c.position.set(x, (1.3 + i * 0.85) * s + hh / 2 - 0.2, z);
    c.castShadow = true; g.add(c);
  }
}
function treeRound(g, mats, x, z, s = 1) {
  addCylY(g, mats.trunk, 0.11 * s, 1.5 * s, x, 0.75 * s, z, 8);
  const leaf = Math.random() > 0.5 ? mats.leaf : mats.leaf2;
  addSphere(g, leaf, 1.15 * s, x, 2.0 * s, z, 0.9);
  addSphere(g, leaf, 0.78 * s, x + 0.55 * s, 2.5 * s, z - 0.25 * s, 0.9);
  addSphere(g, leaf, 0.7 * s, x - 0.45 * s, 2.35 * s, z + 0.35 * s, 0.9);
}

// ----------------------------------------------------------------------------
// Cancha — 3 tipos: panoramica / semi / normal
//   Todas: vidrio 3 m + franja de malla 1 m (3->4 m). Postes de esquina y
//   marco superior comunes. La diferencia es el tratamiento de las juntas de
//   vidrio bajo los 3 m.
// ----------------------------------------------------------------------------
export function buildCourt(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'court';
  const tipo = state.tipo;

  // losa y cesped
  addBox(g, mats.slab, D.L + 0.7, D.SLAB_TOP, D.W + 0.7, 0, D.SLAB_TOP / 2, 0);
  const turf = addBox(g, mats.turf, D.L + 0.05, D.TURF - D.SLAB_TOP, D.W + 0.05,
    0, (D.SLAB_TOP + D.TURF) / 2, 0);
  turf.castShadow = false;

  // lineas reglamentarias (color propio)
  const lineY = D.TURF + 0.003;
  for (const sx of [-1, 1]) addBox(g, mats.lines, 0.05, 0.004, D.W, sx * 6.95, lineY, 0, false);
  addBox(g, mats.lines, 13.95, 0.004, 0.05, 0, lineY, 0, false);

  // zocalo perimetral
  for (const sz of [-1, 1]) addBox(g, mats.steel, D.L + 0.1, 0.1, 0.025, 0, D.TURF + 0.05, sz * D.WALL_Z);
  for (const sx of [-1, 1]) addBox(g, mats.steel, 0.025, 0.1, D.W + 0.1, sx * D.WALL_X, D.TURF + 0.05, 0);

  // ---- vidrios (3 m): fondos 5 panos de 2 m + esquinas laterales de 2 m ----
  const gH = D.GLASS_H - 0.015;
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const zc = -D.HY + 1 + 2 * i;
    addBox(g, mats.glass, D.GLASS_T, gH, 2.0 - 0.012, sx * D.WALL_X, D.SLAB_TOP + 1.5, zc, false);
  }
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    addBox(g, mats.glass, 2.0 - 0.012, gH, D.GLASS_T, sx * (D.HX - 1), D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
  }

  // ---- tratamiento de juntas de vidrio BAJO 3 m, segun tipo ----
  if (tipo === 'panoramica') {
    // 100% panoramica: juntas de silicona estructural, sin perfiles de fierro
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) addBox(g, mats.silicone, 0.016, gH, 0.014, sx * D.WALL_X, D.SLAB_TOP + 1.5, zj, false);
      for (const sz of [-1, 1]) {
        addBox(g, mats.silicone, 0.02, gH, 0.02, sx * D.WALL_X, D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
        addBox(g, mats.silicone, 0.014, gH, 0.016, sx * 8.0, D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
      }
    }
  } else if (tipo === 'semi') {
    // semi: perfiles solo en las 4 esquinas + botones en juntas de fondo
    for (const sx of [-1, 1]) for (const zj of [-3, -1, 1, 3]) for (const yj of [0.45, 1.55, 2.65])
      addCylX(g, mats.steel, 0.026, 0.024, sx * D.WALL_X, D.SLAB_TOP + yj, zj, 12);
  } else {
    // normal: pilar vertical en cada junta de vidrio (sin vigas intermedias)
    for (const sx of [-1, 1]) for (const zj of [-3, -1, 1, 3]) {
      addBox(g, mats.steel, 0.07, D.GLASS_H, 0.07, sx * D.WALL_X, D.SLAB_TOP + 1.5, zj);
    }
  }

  // ---- franja de malla superior 3->4 m en TODO el perimetro ----
  const F = mats.fence;
  for (const sx of [-1, 1]) meshPanel(g, F, 'z', sx * D.WALL_X, -D.HY, D.HY, D.Z3, D.Z4);
  for (const sz of [-1, 1]) meshPanel(g, F, 'x', sz * 0 + sz * D.WALL_Z, -D.HX, D.HX, D.Z3, D.Z4);

  // ---- malla lateral central (zona de acceso) ----
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    meshPanel(g, F, 'x', wz, -D.HX + 2, -D.DOOR_HALF, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, D.DOOR_HALF, D.HX - 2, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, -D.DOOR_HALF, D.DOOR_HALF, D.DOOR_H, D.Z3);
  }

  // ---- postes de esquina (comunes) + placas + tapa de acento ----
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addBox(g, mats.steel, 0.09, D.Z4 - D.SLAB_TOP, 0.09, sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, sz * D.WALL_Z);
    addBox(g, mats.accent, 0.102, 0.07, 0.102, sx * D.WALL_X, D.Z4 + 0.035, sz * D.WALL_Z);
    anchorPlate(g, mats, sx * D.WALL_X, sz * D.WALL_Z, 0.24);
  }

  // ---- postes laterales (zona de malla) ----
  for (const sz of [-1, 1]) for (const px of [-8, -6, -4, -2, 2, 4, 6, 8]) {
    addBox(g, mats.steel, 0.08, D.Z3 - D.SLAB_TOP, 0.08, px, (D.SLAB_TOP + D.Z3) / 2, sz * D.WALL_Z);
    anchorPlate(g, mats, px, sz * D.WALL_Z, 0.2);
  }
  // ---- montantes del marco superior (sostienen la franja de malla) ----
  for (const sz of [-1, 1]) for (const px of [-8, -4, 0, 4, 8])
    addBox(g, mats.steel, 0.045, D.Z4 - D.Z3, 0.045, px, (D.Z3 + D.Z4) / 2, sz * D.WALL_Z);
  for (const sx of [-1, 1]) for (const zz of [-3, 0, 3])
    addBox(g, mats.steel, 0.045, D.Z4 - D.Z3, 0.045, sx * D.WALL_X, (D.Z3 + D.Z4) / 2, zz);

  // ---- riel de acento a 3 m (tope de vidrio) en todo el perimetro ----
  const RR = 0.034;
  for (const sz of [-1, 1]) addCylX(g, mats.accent, RR, D.L + 0.06, 0, D.Z3, sz * D.WALL_Z);
  for (const sx of [-1, 1]) addCylZ(g, mats.accent, RR, D.W + 0.06, sx * D.WALL_X, D.Z3, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addSphere(g, mats.accent, RR, sx * D.WALL_X, D.Z3, sz * D.WALL_Z);
  // manguitos de union riel-poste
  for (const sz of [-1, 1]) for (const px of [-8, -6, -4, -2, 2, 4, 6, 8])
    addBox(g, mats.steel, 0.1, 0.09, 0.09, px, D.Z3, sz * D.WALL_Z);

  // ---- marco superior a 4 m (remate de malla) ----
  for (const sz of [-1, 1]) addCylX(g, mats.steel, 0.026, D.L + 0.06, 0, D.Z4, sz * D.WALL_Z);
  for (const sx of [-1, 1]) addCylZ(g, mats.steel, 0.026, D.W + 0.06, sx * D.WALL_X, D.Z4, 0);

  // ---- marcos de acceso (puerta unica por lado) ----
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    for (const xj of [-D.DOOR_HALF, D.DOOR_HALF]) {
      addBox(g, mats.accent, 0.07, D.DOOR_H - D.SLAB_TOP, 0.07, xj, (D.SLAB_TOP + D.DOOR_H) / 2, wz);
      anchorPlate(g, mats, xj, wz, 0.16);
    }
    addBox(g, mats.accent, 2 * D.DOOR_HALF + 0.07, 0.07, 0.07, 0, D.DOOR_H, wz);
  }

  // ---- red ----
  const netTop = D.TURF + 0.88;
  const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(D.W, netTop - 0.06 - D.TURF), mats.net);
  { const uv = netPlane.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (D.W / 0.45), uv.getY(i) * ((netTop - 0.06 - D.TURF) / 0.45)); }
  netPlane.rotation.y = Math.PI / 2;
  netPlane.position.set(0, (D.TURF + netTop - 0.06) / 2, 0);
  g.add(netPlane);
  addBox(g, mats.white, 0.024, 0.06, D.W, 0, netTop - 0.03, 0);
  addBox(g, mats.white, 0.03, netTop - D.TURF, 0.05, 0.014, (D.TURF + netTop) / 2, 0, false);
  for (const sz of [-1, 1]) {
    addCylY(g, mats.steel, 0.045, 0.94, 0, D.TURF + 0.47, sz * (D.HY - 0.05));
    addCylY(g, mats.accent, 0.047, 0.05, 0, D.TURF + 0.955, sz * (D.HY - 0.05));
    anchorPlate(g, mats, 0, sz * (D.HY - 0.05), 0.16);
  }

  return g;
}

// ----------------------------------------------------------------------------
// Iluminacion — 4 modelos, TODOS nacen de los postes de esquina como una
// sola pieza continua (sin apendices ni abrazaderas sueltas).
// ----------------------------------------------------------------------------
export function buildLights(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'lights';
  const spots = [];

  const addSpot = (x, y, z, tx, ty, tz, angle = 0.85) => {
    const s = new THREE.SpotLight(0xfff2dd, 0, 0, angle, 0.55, 1.4);
    s.position.set(x, y, z); s.target.position.set(tx, ty, tz);
    g.add(s); g.add(s.target); spots.push(s);
  };

  const ledHead = (x, y, z, rotY = 0, w = 1.1) => {
    const grp = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.28), mats.pole);
    hb.castShadow = true; grp.add(hb);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, 0.19), mats.led);
    strip.rotation.x = Math.PI / 2; strip.position.y = -0.05; grp.add(strip);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.09, 0.28), mats.accent);
      tip.position.x = s * (w / 2 + 0.009); grp.add(tip);
    }
    grp.position.set(x, y, z); grp.rotation.y = rotY; g.add(grp);
  };

  const flood = (x, y, z, tx, ty, tz) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.07), mats.pole));
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.23), mats.led);
    lens.position.z = 0.038; grp.add(lens);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, 0.075), mats.accent);
    edge.position.y = -0.165; grp.add(edge);
    grp.position.set(x, y, z); grp.lookAt(tx, ty, tz); g.add(grp);
  };

  // las 4 esquinas: el brazo arranca DENTRO del poste de esquina (continuo)
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx, sz]);

  if (state.luces === 'curvo') {
    for (const [sx, sz] of corners) {
      const bx = sx * D.WALL_X, bz = sz * D.WALL_Z;
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(bx, D.Z3 - 0.1, bz),               // dentro del poste
        new THREE.Vector3(bx, 5.3, bz),
        new THREE.Vector3(bx - sx * 0.25, 6.0, bz - sz * 0.95),
        new THREE.Vector3(bx - sx * 0.95, 6.05, bz - sz * 1.75),
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.052, 12), mats.pole);
      tube.castShadow = true; g.add(tube);
      const hx = bx - sx * 0.95, hz = bz - sz * 1.75;
      ledHead(hx, 6.0, hz, Math.atan2(-sz, -sx) + Math.PI / 2);
      addSpot(hx, 5.9, hz, bx * 0.3, 0, bz * 0.3);
    }
  } else if (state.luces === 'mastil') {
    for (const [sx, sz] of corners) {
      const bx = sx * D.WALL_X, bz = sz * D.WALL_Z;
      // mastil = continuacion vertical del poste de esquina
      addCylY(g, mats.pole, 0.05, 6.4 - (D.Z3 - 0.1), bx, (D.Z3 - 0.1 + 6.4) / 2, bz);
      addCylY(g, mats.accent, 0.052, 0.03, bx, 6.42, bz, 12);
      // cruceta hacia el centro + doble proyector
      const arm = 1.0;
      addCylX(g, mats.pole, 0.04, arm * 1.2, bx - sx * arm / 2, 6.15, bz - sz * 0.05);
      addCylZ(g, mats.pole, 0.04, arm * 1.2, bx - sx * 0.05, 6.15, bz - sz * arm / 2);
      flood(bx - sx * 0.7, 6.1, bz - sz * 0.2, bx * 0.3, 0, bz * 0.3);
      flood(bx - sx * 0.2, 6.1, bz - sz * 0.7, bx * 0.3, 0, bz * 0.3);
      addSpot(bx - sx * 0.5, 6.0, bz - sz * 0.5, bx * 0.25, 0, bz * 0.25, 0.95);
    }
  } else if (state.luces === 'esquina') {
    for (const [sx, sz] of corners) {
      const bx = sx * D.WALL_X, bz = sz * D.WALL_Z;
      // brazo corto a 45° que nace del poste
      const tip = new THREE.Vector3(bx - sx * 1.15, 5.7, bz - sz * 1.15);
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(bx, D.Z4 - 0.15, bz),
        new THREE.Vector3(bx - sx * 0.2, 5.2, bz - sz * 0.2),
        new THREE.Vector3(bx - sx * 0.7, 5.6, bz - sz * 0.7),
        tip,
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.05, 10), mats.pole);
      tube.castShadow = true; g.add(tube);
      ledHead(tip.x, tip.y, tip.z, Math.atan2(-sz, -sx) + Math.PI / 2, 0.95);
      addSpot(tip.x, tip.y - 0.1, tip.z, bx * 0.25, 0, bz * 0.25, 0.95);
    }
  } else {
    // riel LED perimetral integrado (sin postes)
    const ledRail = mats.ledRail;
    for (const sz of [-1, 1]) addCylX(g, ledRail, 0.022, D.L + 0.02, 0, D.Z3 + 0.055, sz * D.WALL_Z);
    for (const sx of [-1, 1]) addCylZ(g, ledRail, 0.022, D.W + 0.02, sx * D.WALL_X, D.Z3 + 0.055, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      addBox(g, mats.steel, 0.12, 0.08, 0.12, sx * D.WALL_X, D.Z3 + 0.06, sz * D.WALL_Z);
    for (const px of [-7, -3.5, 0, 3.5, 7]) for (const sz of [-1, 1])
      addSpot(px, D.Z3 + 0.05, sz * (D.WALL_Z - 0.15), px * 0.7, 0, sz * 1.0, 1.0);
  }
  return { group: g, spots };
}

// ----------------------------------------------------------------------------
// Entornos
// ----------------------------------------------------------------------------
export function buildEnvironment(state, mats) {
  const g = new THREE.Group();
  g.name = 'env';
  const E = state.entorno;

  const groundCircle = (mat, r = 220) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 56), mat);
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; g.add(m); return m;
  };

  if (E === 'estudio') {
    // estudio fotografico premium: ciclorama curvo + plataforma
    const floor = new THREE.Mesh(new THREE.CircleGeometry(120, 64), mats.ground);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    // plataforma elevada bajo la cancha
    addBox(g, mats.concrete, 24, 0.25, 14, 0, -0.13, 0);
    const trim = addBox(g, mats.accent, 24.3, 0.06, 14.3, 0, 0.02, 0, false);
    trim.material = mats.accent;
    // pedestales de foco suaves (solo decorativos)
    for (const [px, pz] of [[-26, -16], [26, -16], [-26, 16], [26, 16]]) {
      addCylY(g, mats.steel, 0.06, 7, px, 3.5, pz, 10);
      addBox(g, mats.led, 1.0, 0.5, 0.18, px, 6.9, pz, false);
    }

  } else if (E === 'estadio') {
    // ====== ARENA estilo Premier/WPT (referencia foto 1) ======
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 56), mats.asphalt);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    // plataforma del court con faldón de vallas publicitarias
    addBox(g, mats.standFront, 24, 0.4, 14, 0, -0.2, 0);
    for (const sz of [-1, 1]) addPlane(g, mats.adboard, 24, 0.34, 0, 0.17, sz * 7.02, 0, sz < 0 ? 0 : Math.PI);
    for (const sx of [-1, 1]) addPlane(g, mats.adboard, 14, 0.34, sx * 12.02, 0.17, 0, 0, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
    // vallas LED perimetrales (los paneles brillantes alrededor del court)
    for (const sz of [-1, 1]) addPlane(g, mats.adboard, 22, 0.9, 0, 0.55, sz * 9.5, 0, sz < 0 ? 0 : Math.PI);
    for (const sx of [-1, 1]) addPlane(g, mats.adboard, 18, 0.9, sx * 15.5, 0.55, 0, 0, sx < 0 ? Math.PI / 2 : -Math.PI / 2);

    // graderias en bowl (4 lados con huecos en esquinas) + multitud.
    // Frame local: la cancha esta hacia -z, la grada sube hacia +z y +y.
    const stand = (cx, cz, len, rotY) => {
      const grp = new THREE.Group();
      const depth = 17, rise = 10;
      // muro frontal hacia la cancha con valla LED
      addBox(grp, mats.standFront, len, 1.3, 0.6, 0, 0.65, -0.2, false);
      addPlane(grp, mats.adboard, len, 0.9, 0, 0.7, -0.51, 0, Math.PI);
      // rampa de gradas inclinada con textura de publico (doble cara)
      const ang = Math.atan2(rise, depth);
      const diag = Math.hypot(depth, rise);
      const rake = new THREE.Mesh(new THREE.PlaneGeometry(len, diag), mats.crowd);
      rake.rotation.x = -(Math.PI / 2 + ang);
      rake.position.set(0, 1.3 + rise / 2, 0.1 + depth / 2);
      const uv = rake.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / 3.0), uv.getY(i) * (diag / 3.4));
      grp.add(rake);
      // muro trasero alto que cierra la grada
      addBox(grp, mats.standFront, len, rise + 1.5, 0.5, 0, (rise + 1.5) / 2, 0.1 + depth, false);
      grp.position.set(cx, 0, cz); grp.rotation.y = rotY; g.add(grp);
    };
    stand(0, -12.5, 40, Math.PI);
    stand(0, 12.5, 40, 0);
    stand(-21, 0, 28, -Math.PI / 2);
    stand(21, 0, 28, Math.PI / 2);

    // techo de la arena alto, con cerchas finas y rampa de focos
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(120, 70, 90), mats.arenaRoof);
    ceil.position.y = 32; g.add(ceil);
    for (let i = -2; i <= 2; i++) {
      addBox(g, mats.steel, 0.3, 0.4, 60, i * 13, 26.8, 0, false);
      for (let j = -1; j <= 1; j++) addBox(g, mats.led, 2.0, 0.22, 1.2, i * 13, 26.4, j * 12, false);
    }
    // marcador colgante central
    addBox(g, mats.standFront, 5, 2.2, 5, 0, 22, 0, false);
    for (const sz of [-1, 1]) addPlane(g, mats.adboard, 4.6, 1.8, 0, 22, sz * 2.55, 0, sz < 0 ? 0 : Math.PI);
    for (const sx of [-1, 1]) addPlane(g, mats.adboard, 4.6, 1.8, sx * 2.55, 22, 0, 0, sx < 0 ? Math.PI / 2 : -Math.PI / 2);

  } else if (E === 'patio') {
    groundCircle(mats.lawn, 130);
    // deck de madera bajo la cancha
    addBox(g, mats.deck, 25, 0.12, 15, 0, 0.0, 0);
    // casa de dos pisos con ventanas
    addBox(g, mats.houseWall, 12, 7.2, 9, -19, 3.6, -7);
    addBox(g, mats.roof, 13, 0.4, 10, -19, 7.6, -7);
    addBox(g, mats.houseWall2, 5, 3.6, 6, -19, 1.8, -1.5);
    addBox(g, mats.roof, 5.6, 0.32, 6.6, -19, 3.7, -1.5);
    for (const wy of [2.2, 4.9]) for (const wz of [-9.5, -7, -4.5]) addPlane(g, mats.windowGlow, 1.4, 1.7, -12.97, wy, wz, 0, Math.PI / 2);
    // puerta corredera
    addPlane(g, mats.water, 2.2, 2.4, -12.97, 1.4, -0.5, 0, Math.PI / 2);
    // piscina
    addBox(g, mats.concrete, 7, 0.2, 4.2, 15.5, 0.05, -9, false);
    addBox(g, mats.water, 6.4, 0.12, 3.6, 15.5, 0.12, -9, false);
    // cerco perimetral de madera
    const PW = 23, PD = 15;
    for (const sz of [-1, 1]) addBox(g, mats.wood, PW * 2, 1.9, 0.12, 0, 0.95, sz * PD, false);
    for (const sx of [-1, 1]) addBox(g, mats.wood, 0.12, 1.9, PD * 2, sx * PW, 0.95, 0, false);
    for (let i = -5; i <= 5; i++) for (const sz of [-1, 1]) addBox(g, mats.wood, 0.16, 2.1, 0.16, i * 4.2, 1.05, sz * PD, false);
    // jardin
    treeRound(g, mats, -21, 10, 1.5); treeRound(g, mats, 20, 11, 1.3); treePine(g, mats, 21, -12, 1.4);
    for (const [bx, bz] of [[-9, 13.4], [-3, 13.6], [3, 13.6], [9, 13.4], [13, 13]]) addSphere(g, mats.hedge, 0.8, bx, 0.6, bz, 0.8);
    for (let i = 0; i < 7; i++) addBox(g, mats.concrete, 1.2, 0.04, 0.9, -14 + i * 1.8, 0.03, -6.5, false);

  } else if (E === 'club') {
    groundCircle(mats.asphalt, 200);
    // casa club moderna con frente vidriado
    addBox(g, mats.concrete, 22, 5.2, 9, -2, 2.6, 21);
    addBox(g, mats.roofSlab, 23.4, 0.35, 10, -2, 5.4, 21);
    for (let i = -4; i <= 4; i++) addPlane(g, mats.windowGlow, 1.9, 3.0, -2 + i * 2.2, 2.4, 16.45, 0, Math.PI);
    addBox(g, mats.accent, 8, 0.9, 0.25, -2, 6.0, 16.3, false);
    // dos canchas vecinas (estructura simple) a los lados
    for (const ox of [-26, 26]) {
      addBox(g, mats.slab, 20.6, 0.07, 10.6, ox, 0.035, -3);
      addBox(g, mats.turf, 20, 0.02, 10, ox, 0.08, -3, false);
      for (const sz of [-1, 1]) meshPanel(g, mats.fence, 'x', -3 + sz * 5.03, ox - 10, ox + 10, 0.07, 3.07);
      for (const sx of [-1, 1]) meshPanel(g, mats.fence, 'z', ox + sx * 10.03, -8.03, 2.03, 0.07, 3.07);
      for (const c of [[-10, -8], [10, -8], [-10, 2], [10, 2]]) addBox(g, mats.steel, 0.08, 4, 0.08, ox + c[0], 2, c[1]);
    }
    // setos, banderas y estacionamiento
    for (let i = -3; i <= 3; i++) addBox(g, mats.hedge, 3.2, 1.0, 0.9, i * 4.4, 0.5, 13.5);
    for (const fx of [-15, -12, -9]) { addCylY(g, mats.pole, 0.04, 7, fx, 3.5, 15, 10); addPlane(g, mats.accent, 1.3, 0.7, fx + 0.68, 6.4, 15, 0, Math.PI / 2); }
    for (let i = 0; i < 7; i++) addBox(g, mats.lines, 0.1, 0.012, 5, -30 - i * 2.8, 0.012, 16, false);
    treeRound(g, mats, -34, -6, 1.6); treeRound(g, mats, 34, -6, 1.6);

  } else if (E === 'campo') {
    // terreno ondulado
    const field = new THREE.Mesh(new THREE.CircleGeometry(400, 64), mats.grassField);
    field.rotation.x = -Math.PI / 2; field.receiveShadow = true; g.add(field);
    // colinas lejanas
    for (const [hx, hz, hr] of [[-130, -70, 75], [120, -90, 90], [40, 150, 100], [-110, 100, 85], [160, 40, 95]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 24, 12), mats.leaf);
      hill.scale.y = 0.16; hill.position.set(hx, -3, hz); g.add(hill);
    }
    // bosque
    const arboles = [[-22, 10, 1.7], [-28, -7, 1.4], [-17, -17, 1.9], [15, -20, 1.5], [25, -10, 1.8],
      [29, 7, 1.4], [21, 17, 2.0], [5, 22, 1.5], [-11, 24, 1.7], [-33, 17, 2.1], [37, -17, 2.2],
      [-39, -15, 1.9], [45, 11, 2.3], [-13, -27, 1.6], [33, 24, 1.8], [-26, 28, 2.0]];
    for (const [tx, tz, ts] of arboles) (Math.random() > 0.5 ? treePine : treeRound)(g, mats, tx, tz, ts);
    // cerco rural y camino de tierra
    addBox(g, mats.deck, 3.4, 0.015, 70, -15, 0.01, 28, false);
    for (let i = -8; i <= 8; i++) { addCylY(g, mats.wood, 0.07, 1.2, i * 5, 0.6, 17, 6); }
    for (const yy of [0.7, 1.05]) addCylX(g, mats.wood, 0.03, 80, 0, yy, 17, 6);

  } else if (E === 'azotea') {
    addBox(g, mats.roofSlab, 40, 0.35, 24, 0, -0.175, 0);
    const PH = 1.15;
    for (const sz of [-1, 1]) addBox(g, mats.parapet, 40, PH, 0.3, 0, PH / 2, sz * 11.85);
    for (const sx of [-1, 1]) addBox(g, mats.parapet, 0.3, PH, 24, sx * 19.85, PH / 2, 0);
    // equipos de azotea
    for (const [ax, az] of [[-16, 9], [-13.3, 9], [16, -9.2]]) { addBox(g, mats.concrete, 1.7, 1.0, 1.2, ax, 0.5, az); addCylY(g, mats.bolt, 0.36, 0.1, ax, 1.05, az, 16); }
    addCylY(g, mats.steel, 0.7, 1.6, 17, 0.8, 9, 12); // estanque de agua
    // edificio propio + ciudad alrededor con ventanas
    addBox(g, mats.cityB, 38, 34, 22, 0, -17.2, 0, false);
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(420, 40), new THREE.MeshStandardMaterial({ color: 0x202329, roughness: 0.95 }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = -34.2; g.add(suelo);
    const city = [[mats.cityA, -42, -16, 15, 38, 15], [mats.cityC, -46, 18, 17, 50, 13], [mats.cityB, -22, -38, 13, 28, 13],
      [mats.cityA, 8, -42, 17, 44, 15], [mats.cityC, 38, -28, 15, 33, 13], [mats.cityB, 48, -2, 17, 56, 17],
      [mats.cityA, 42, 24, 13, 40, 13], [mats.cityC, 12, 40, 19, 30, 15], [mats.cityB, -18, 44, 15, 48, 13],
      [mats.cityA, -56, -40, 19, 42, 17], [mats.cityC, 62, -38, 17, 48, 15], [mats.cityB, -62, 42, 17, 60, 15]];
    for (const [m, bx, bz, w, h, d] of city) {
      addBox(g, m, w, h, d, bx, -34 + h / 2, bz, false);
      const facing = Math.atan2(-bz, -bx);
      const r = Math.hypot(bx, bz) - Math.max(w, d) / 2 - 0.05;
      const win = addPlane(g, mats.windowGlow, Math.min(w, d) * 0.82, h * 0.86, Math.cos(facing) * -r, -34 + h / 2, Math.sin(facing) * -r);
      win.lookAt(0, -34 + h / 2, 0);
    }

  } else {
    // indoor: nave alta (15 m) con muros, cerchas y luminarias
    const HALL_W = 62, HALL_D = 36, HALL_H = 15;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), mats.hallFloor);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(HALL_W, HALL_H, HALL_D), mats.hallWall);
    hall.position.y = HALL_H / 2; g.add(hall);
    // friso superior y rodapie de color
    for (const sz of [-1, 1]) addPlane(g, mats.hallWall2, HALL_W, 3, 0, HALL_H - 1.6, sz * (HALL_D / 2 - 0.02), 0, sz < 0 ? 0 : Math.PI);
    for (const sx of [-1, 1]) addPlane(g, mats.accent, HALL_D, 0.4, sx * (HALL_W / 2 - 0.02), 2.4, 0, 0, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
    // columnas + cerchas
    for (let i = -3; i <= 3; i++) {
      for (const sz of [-1, 1]) addBox(g, mats.steel, 0.35, HALL_H - 0.5, 0.35, i * 8.4, (HALL_H - 0.5) / 2, sz * (HALL_D / 2 - 0.4), false);
      addBox(g, mats.steel, 0.22, 0.5, HALL_D - 0.8, i * 8.4, HALL_H - 0.7, 0, false);
    }
    // luminarias lineales colgantes
    for (let i = -1; i <= 1; i++) for (const sz of [-1, 1]) {
      addPlane(g, mats.hallLight || mats.led, 9, 0.4, i * 12, HALL_H - 1.4, sz * 5.5, Math.PI / 2);
      addBox(g, mats.steel, 9, 0.07, 0.12, i * 12, HALL_H - 1.35, sz * 5.5, false);
    }
  }

  // sombra de contacto suave bajo la losa
  if (mats.blob) {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(26, 14.5), mats.blob);
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.006; g.add(blob);
  }
  return g;
}
