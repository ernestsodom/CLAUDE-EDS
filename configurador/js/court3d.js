/* court3d.js — construccion parametrica de la cancha (sin dependencias DOM).
   Sistema de coordenadas Y-up: largo en X (±10), ancho en Z (±5), altura Y. */
import * as THREE from './vendor/three.module.min.js';

// ---- dimensiones reglamentarias (m) ----
export const DIM = {
  L: 20, W: 10, HX: 10, HY: 5,
  WALL_X: 10.03, WALL_Z: 5.03,
  SLAB_TOP: 0.07, TURF: 0.084,
  Z3: 3.07, Z4: 4.07,
  DOOR_HALF: 1.15, DOOR_H: 2.12,
  GLASS_T: 0.012,
  MOUNT_Y: 2.5,            // cota de arranque de mastiles (altura de vigas)
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
    emissive: state.acento, emissiveIntensity: 0.3,
  });
  mats.white = std({ color: 0xe8e8e8, roughness: 0.6 });
  mats.glass = new THREE.MeshPhysicalMaterial({
    color: 0xe9f1ef, roughness: 0.05, metalness: 0,
    transmission: 0.92, ior: 1.45, thickness: 0.02,
    envMapIntensity: 1.4,
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
  mats.led = std({ color: 0x202226, emissive: 0xfff4e0, emissiveIntensity: 0.5 });
  mats.slab = std({ color: 0x0c0d0f, roughness: 0.7, metalness: 0.1 });

  // entornos
  mats.ground = std({ color: 0xc6c9ce, roughness: 0.95 });
  mats.lawn = std({ color: 0x47703a, roughness: 0.95 });
  mats.grassField = std({ color: 0x59824a, roughness: 0.95 });
  mats.asphalt = std({ color: 0x4c5056, roughness: 0.92 });
  mats.concrete = std({ color: 0x8b8e94, roughness: 0.9 });
  mats.roofSlab = std({ color: 0x6d7076, roughness: 0.9 });
  mats.parapet = std({ color: 0x9a9da3, roughness: 0.85 });
  mats.wood = std({ color: 0x7a5b3e, roughness: 0.85 });
  mats.houseWall = std({ color: 0xe2dccb, roughness: 0.85 });
  mats.roof = std({ color: 0x4a3f38, roughness: 0.8 });
  mats.trunk = std({ color: 0x5a4630, roughness: 0.9 });
  mats.leaf = std({ color: 0x3f6b33, roughness: 0.9 });
  mats.hedge = std({ color: 0x2f5429, roughness: 0.92 });
  mats.cityA = std({ color: 0x3a3f48, roughness: 0.85 });
  mats.cityB = std({ color: 0x565c66, roughness: 0.85 });
  mats.cityC = std({ color: 0x767c86, roughness: 0.85 });
  mats.hallFloor = std({ color: 0x3c4046, roughness: 0.92 });
  mats.hallWall = std({ color: 0x181b20, roughness: 0.95, side: THREE.BackSide });
  mats.windowGlow = std({
    color: 0x12151c, emissive: 0xffffff, emissiveIntensity: 0.05,
  });
  if (tex && tex.windows) mats.windowGlow.emissiveMap = tex.windows;
  return mats;
}

export function updateMaterialColors(mats, state) {
  mats.turf.color.set(state.cesped);
  mats.steel.color.set(state.estructura);
  mats.pole.color.set(state.postesLuz);
  mats.fence.color.set(state.estructura).multiplyScalar(1.25);
  mats.accent.color.set(state.acento);
  mats.accent.emissive.set(state.acento);
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

function addCylX(g, mat, r, len, x, y, z, seg = 18) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addCylZ(g, mat, r, len, x, y, z, seg = 18) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addCylY(g, mat, r, len, x, y, z, seg = 18) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addSphere(g, mat, r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

/* Placa base de anclaje con 4 pernos hexagonales (detalle de terminacion). */
function anchorPlate(g, mats, x, z, w = 0.2) {
  addBox(g, mats.steel, w, 0.014, w, x, DIM.SLAB_TOP + 0.007, z);
  const o = w / 2 - 0.032;
  for (const dx of [-o, o]) {
    for (const dz of [-o, o]) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.045, 6), mats.bolt);
      b.position.set(x + dx, DIM.SLAB_TOP + 0.032, z + dz);
      b.castShadow = true;
      g.add(b);
    }
  }
}

/* Abrazadera de union mastil-poste con pernos (detalle de ensamble). */
function clampDetail(g, mats, x, y, z, axis = 'z', sign = 1) {
  addBox(g, mats.pole, 0.13, 0.075, 0.13, x, y, z);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.03, 6), mats.bolt);
    if (axis === 'z') {
      b.rotation.x = Math.PI / 2;
      b.position.set(x + s * 0.042, y, z + sign * 0.068);
    } else {
      b.rotation.z = Math.PI / 2;
      b.position.set(x + sign * 0.068, y, z + s * 0.042);
    }
    g.add(b);
  }
}

/* Panel de malla con UVs escalados (celda textura = 0.5 m). */
function meshPanel(g, mat, orient, fixed, u0, u1, y0, y1) {
  const w = u1 - u0, h = y1 - y0;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (w / 0.5), uv.getY(i) * (h / 0.5));
  }
  const m = new THREE.Mesh(geo, mat);
  if (orient === 'x') {
    m.position.set((u0 + u1) / 2, (y0 + y1) / 2, fixed);
  } else {
    m.rotation.y = Math.PI / 2;
    m.position.set(fixed, (y0 + y1) / 2, (u0 + u1) / 2);
  }
  m.castShadow = false;
  g.add(m);
  return m;
}

// ----------------------------------------------------------------------------
// Cancha — 3 tipos: panoramica / semi / normal
// ----------------------------------------------------------------------------
export function buildCourt(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'court';
  const tipo = state.tipo; // panoramica | semi | normal

  // losa y cesped
  addBox(g, mats.slab, D.L + 0.7, D.SLAB_TOP, D.W + 0.7, 0, D.SLAB_TOP / 2, 0);
  const turf = addBox(g, mats.turf, D.L + 0.05, D.TURF - D.SLAB_TOP, D.W + 0.05,
    0, (D.SLAB_TOP + D.TURF) / 2, 0);
  turf.castShadow = false;

  // lineas reglamentarias
  const lineY = D.TURF + 0.003;
  for (const sx of [-1, 1]) {
    addBox(g, mats.white, 0.05, 0.004, D.W, sx * 6.95, lineY, 0, false);
  }
  addBox(g, mats.white, 13.95, 0.004, 0.05, 0, lineY, 0, false);

  // zocalo perimetral
  for (const sz of [-1, 1]) {
    addBox(g, mats.steel, D.L + 0.1, 0.1, 0.025, 0, D.TURF + 0.05, sz * D.WALL_Z);
  }
  for (const sx of [-1, 1]) {
    addBox(g, mats.steel, 0.025, 0.1, D.W + 0.1, sx * D.WALL_X, D.TURF + 0.05, 0);
  }

  // ---- vidrios (fondos 5 panos de 2m + esquinas laterales de 2m) ----
  const glassH = 3.0 - 0.015;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const zc = -D.HY + 1 + 2 * i;
      addBox(g, mats.glass, D.GLASS_T, glassH, 2.0 - 0.012,
        sx * D.WALL_X, D.SLAB_TOP + 1.5, zc, false);
    }
  }
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      addBox(g, mats.glass, 2.0 - 0.012, glassH, D.GLASS_T,
        sx * (D.HX - 1), D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
    }
  }

  // ---- tratamiento de juntas/perfiles segun tipo ----
  if (tipo === 'panoramica') {
    // 100% panoramica: vidrio pegado con silicona estructural, sin perfiles
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) {
        addBox(g, mats.silicone, 0.016, glassH, 0.014,
          sx * D.WALL_X, D.SLAB_TOP + 1.5, zj, false);
      }
      for (const sz of [-1, 1]) {
        // junta vertical de esquina vidrio-vidrio
        addBox(g, mats.silicone, 0.022, glassH, 0.022,
          sx * D.WALL_X, D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
        // junta entre vidrio de esquina y poste ±8
        addBox(g, mats.silicone, 0.014, glassH, 0.016,
          sx * 8.0, D.SLAB_TOP + 1.5, sz * D.WALL_Z, false);
      }
    }
  } else if (tipo === 'semi') {
    // semi panoramica: perfiles SOLO en las 4 esquinas + botones en juntas
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) {
        for (const yj of [0.45, 1.55, 2.65]) {
          addCylX(g, mats.steel, 0.026, 0.024, sx * D.WALL_X, D.SLAB_TOP + yj, zj, 14);
        }
        addBox(g, mats.steel, 0.04, D.Z4 - D.Z3, 0.04,
          sx * D.WALL_X, (D.Z3 + D.Z4) / 2, zj);
      }
      for (const sz of [-1, 1]) {
        addBox(g, mats.steel, 0.09, D.Z4 - D.SLAB_TOP, 0.09,
          sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, sz * D.WALL_Z);
        addBox(g, mats.accent, 0.102, 0.07, 0.102,
          sx * D.WALL_X, D.Z4 + 0.035, sz * D.WALL_Z);
        anchorPlate(g, mats, sx * D.WALL_X, sz * D.WALL_Z, 0.24);
      }
    }
  } else {
    // normal: pilares verticales completos en cada junta (sin vigas intermedias)
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) {
        addBox(g, mats.steel, 0.08, D.Z4 - D.SLAB_TOP, 0.08,
          sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, zj);
        anchorPlate(g, mats, sx * D.WALL_X, zj, 0.2);
      }
      for (const sz of [-1, 1]) {
        addBox(g, mats.steel, 0.08, D.Z4 - D.SLAB_TOP, 0.08,
          sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, sz * D.WALL_Z);
        addBox(g, mats.accent, 0.092, 0.07, 0.092,
          sx * D.WALL_X, D.Z4 + 0.035, sz * D.WALL_Z);
        anchorPlate(g, mats, sx * D.WALL_X, sz * D.WALL_Z, 0.22);
      }
    }
  }

  // ---- malla metalica ----
  const F = mats.fence;
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    meshPanel(g, F, 'x', wz, -D.HX + 2, -D.DOOR_HALF, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, D.DOOR_HALF, D.HX - 2, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, -D.DOOR_HALF, D.DOOR_HALF, D.DOOR_H, D.Z3);
  }
  // franja 3-4m: solo semi y normal (panoramica = linea de vidrio limpia)
  if (tipo !== 'panoramica') {
    for (const sz of [-1, 1]) {
      const wz = sz * D.WALL_Z;
      meshPanel(g, F, 'x', wz, -D.HX, -D.HX + 2, D.Z3, D.Z4);
      meshPanel(g, F, 'x', wz, D.HX - 2, D.HX, D.Z3, D.Z4);
    }
    for (const sx of [-1, 1]) {
      meshPanel(g, F, 'z', sx * D.WALL_X, -D.HY, D.HY, D.Z3, D.Z4);
    }
  }

  // ---- postes laterales (zona de malla) con placas de anclaje ----
  const sideTop = tipo === 'panoramica' ? D.Z3 : null;
  for (const sz of [-1, 1]) {
    for (const px of [-8, -6, -4, -2, 2, 4, 6, 8]) {
      const h = (Math.abs(px) === 8 && tipo !== 'panoramica') ? D.Z4 : D.Z3;
      addBox(g, mats.steel, 0.08, h - D.SLAB_TOP, 0.08,
        px, (D.SLAB_TOP + h) / 2, sz * D.WALL_Z);
      anchorPlate(g, mats, px, sz * D.WALL_Z, 0.2);
    }
  }

  // ---- riel perimetral acento a 3m + manguitos de union en cada poste ----
  const RR = 0.034;
  if (tipo === 'panoramica') {
    // solo sobre la zona de malla lateral (el vidrio queda limpio)
    for (const sz of [-1, 1]) {
      addCylX(g, mats.accent, RR, 16.06, 0, D.Z3, sz * D.WALL_Z);
      for (const s of [-1, 1]) {
        addSphere(g, mats.accent, RR, s * 8.03, D.Z3, sz * D.WALL_Z);
      }
    }
  } else {
    for (const sz of [-1, 1]) {
      addCylX(g, mats.accent, RR, D.L + 0.06, 0, D.Z3, sz * D.WALL_Z);
    }
    for (const sx of [-1, 1]) {
      addCylZ(g, mats.accent, RR, D.W + 0.06, sx * D.WALL_X, D.Z3, 0);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addSphere(g, mats.accent, RR, sx * D.WALL_X, D.Z3, sz * D.WALL_Z);
      }
    }
    // remate superior negro a 4m
    for (const sx of [-1, 1]) {
      addCylZ(g, mats.steel, 0.025, D.W + 0.06, sx * D.WALL_X, D.Z4, 0);
      for (const sz of [-1, 1]) {
        addCylX(g, mats.steel, 0.025, 2.06, sx * (D.HX - 1), D.Z4, sz * D.WALL_Z);
      }
    }
  }
  // manguitos de ensamble riel-poste
  for (const sz of [-1, 1]) {
    for (const px of [-8, -6, -4, -2, 2, 4, 6, 8]) {
      addBox(g, mats.steel, 0.105, 0.095, 0.095, px, D.Z3, sz * D.WALL_Z);
    }
  }

  // ---- marcos de acceso (puerta unica por lado) ----
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    for (const xj of [-D.DOOR_HALF, D.DOOR_HALF]) {
      addBox(g, mats.accent, 0.07, D.DOOR_H - D.SLAB_TOP, 0.07,
        xj, (D.SLAB_TOP + D.DOOR_H) / 2, wz);
      anchorPlate(g, mats, xj, wz, 0.16);
    }
    addBox(g, mats.accent, 2 * D.DOOR_HALF + 0.07, 0.07, 0.07, 0, D.DOOR_H, wz);
  }

  // ---- red ----
  const netTop = D.TURF + 0.88;
  const netPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(D.W, netTop - 0.06 - D.TURF), mats.net);
  {
    const uv = netPlane.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (D.W / 0.45),
        uv.getY(i) * ((netTop - 0.06 - D.TURF) / 0.45));
    }
  }
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
// Iluminacion — 4 modelos, todos montados sobre la estructura
// ----------------------------------------------------------------------------
export function buildLights(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'lights';
  const spots = [];

  const addSpot = (x, y, z, tx, ty, tz, angle = 0.95) => {
    const s = new THREE.SpotLight(0xfff2dd, 0, 0, angle, 0.6, 1.6);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    g.add(s);
    g.add(s.target);
    spots.push(s);
  };

  /* barra LED horizontal (cabezal plano) */
  const ledBar = (x, y, z, rotY = 0, w = 1.15) => {
    const grp = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.095, 0.3), mats.pole);
    hb.castShadow = true;
    grp.add(hb);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.17, 0.21), mats.led);
    strip.rotation.x = Math.PI / 2;
    strip.position.y = -0.052;
    grp.add(strip);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.095, 0.3), mats.accent);
      tip.position.x = s * (w / 2 + 0.01);
      grp.add(tip);
    }
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;
    g.add(grp);
  };

  /* proyector plano tipo estadio que mira hacia un punto de la cancha */
  const floodPanel = (x, y, z, tx, ty, tz) => {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.07), mats.pole);
    frame.castShadow = true;
    grp.add(frame);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.25), mats.led);
    lens.position.z = 0.038;
    grp.add(lens);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.075), mats.accent);
    edge.position.y = -0.175;
    grp.add(edge);
    grp.position.set(x, y, z);
    grp.lookAt(tx, ty, tz);
    g.add(grp);
  };

  if (state.luces === 'curvo') {
    // brazos curvos desde la estructura (x=±6)
    for (const px of [-6, 6]) {
      for (const side of [-1, 1]) {
        const zo = side * (D.WALL_Z + 0.115);
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(px, D.MOUNT_Y, zo),
          new THREE.Vector3(px, 5.1, zo),
          new THREE.Vector3(px, 5.95, zo - side * 0.7),
          new THREE.Vector3(px, 6.03, zo - side * 1.55),
        );
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.05, 12), mats.pole);
        tube.castShadow = true;
        g.add(tube);
        for (const yb of [D.MOUNT_Y + 0.15, D.MOUNT_Y + 0.55]) {
          clampDetail(g, mats, px, yb, side * (D.WALL_Z + 0.055), 'z', -side);
        }
        addCylY(g, mats.accent, 0.052, 0.02, px, D.MOUNT_Y - 0.01, zo, 14);
        ledBar(px, 6.05, zo - side * 1.78);
        addSpot(px, 5.95, zo - side * 1.78, px * 0.45, 0, zo * 0.25);
      }
    }
  } else if (state.luces === 'mastil') {
    // mastiles rectos estilo WPT: verticales con cruceta y doble proyector
    for (const px of [-6, 6]) {
      for (const side of [-1, 1]) {
        const zo = side * (D.WALL_Z + 0.115);
        addCylY(g, mats.pole, 0.048, 6.05 - D.MOUNT_Y, px,
          (D.MOUNT_Y + 6.05) / 2, zo);
        for (const yb of [D.MOUNT_Y + 0.12, D.MOUNT_Y + 0.55]) {
          clampDetail(g, mats, px, yb, side * (D.WALL_Z + 0.055), 'z', -side);
        }
        addCylY(g, mats.accent, 0.05, 0.025, px, 6.07, zo, 14);
        // cruceta
        addBox(g, mats.pole, 0.95, 0.06, 0.06, px, 5.88, zo);
        for (const s of [-1, 1]) {
          floodPanel(px + s * 0.34, 5.86, zo - side * 0.08,
            px + s * 1.6, 0, zo * 0.12);
        }
        addSpot(px, 5.8, zo, px * 0.5, 0, zo * 0.18, 1.0);
      }
    }
  } else if (state.luces === 'esquina') {
    // mastiles de esquina 45° estilo Premier Padel
    const cx = state.tipo === 'panoramica' ? 8.0 : D.WALL_X;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const mx = sx * cx, mz = sz * (D.WALL_Z + 0.115);
        addCylY(g, mats.pole, 0.05, 6.25 - D.MOUNT_Y, mx,
          (D.MOUNT_Y + 6.25) / 2, mz);
        for (const yb of [D.MOUNT_Y + 0.12, D.MOUNT_Y + 0.55]) {
          clampDetail(g, mats, mx, yb, sz * (D.WALL_Z + 0.055), 'z', -sz);
        }
        addCylY(g, mats.accent, 0.052, 0.025, mx, 6.27, mz, 14);
        // barra LED girada 45° apuntando al centro
        const ang = Math.atan2(-sz, -sx) + Math.PI / 2;
        ledBar(mx - sx * 0.35, 6.12, mz - sz * 0.3, ang, 1.0);
        addSpot(mx - sx * 0.35, 6.0, mz - sz * 0.3, sx * 2.6, 0, sz * 0.6, 1.05);
      }
    }
  } else {
    // riel LED perimetral integrado: linea continua emisiva + bano de luz
    const ledRail = mats.ledRail;
    for (const sz of [-1, 1]) {
      addCylX(g, ledRail, 0.022, D.L + 0.02, 0, D.Z3 + 0.055, sz * D.WALL_Z);
    }
    for (const sx of [-1, 1]) {
      addCylZ(g, ledRail, 0.022, D.W + 0.02, sx * D.WALL_X, D.Z3 + 0.055, 0);
    }
    // drivers en esquinas (detalle)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(g, mats.steel, 0.12, 0.08, 0.12, sx * D.WALL_X, D.Z3 + 0.06,
          sz * D.WALL_Z);
      }
    }
    // bano de luz perimetral (10 puntos)
    for (const px of [-7, -3.5, 0, 3.5, 7]) {
      for (const sz of [-1, 1]) {
        addSpot(px, D.Z3 + 0.05, sz * (D.WALL_Z - 0.15),
          px * 0.75, 0, sz * 1.1, 1.15);
      }
    }
  }
  return { group: g, spots };
}

// ----------------------------------------------------------------------------
// Entornos: estudio / patio / club / campo / azotea / indoor
// ----------------------------------------------------------------------------
function tree(g, mats, x, z, s = 1) {
  addCylY(g, mats.trunk, 0.09 * s, 1.4 * s, x, 0.7 * s, z, 8);
  addSphere(g, mats.leaf, 1.05 * s, x, 1.9 * s, z);
  addSphere(g, mats.leaf, 0.7 * s, x + 0.5 * s, 2.5 * s, z - 0.2 * s);
}

function building(g, mats, mat, x, z, w, h, d, baseY = 0, glow = null) {
  addBox(g, mat, w, h, d, x, baseY + h / 2, z, false);
  if (glow) {
    // franjas de ventanas hacia la cancha
    const facing = Math.atan2(-z, -x);
    for (let i = -1; i <= 1; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w, d) * 0.16, h * 0.72), glow);
      const r = Math.sqrt(x * x + z * z) - Math.max(w, d) / 2 - 0.05;
      p.position.set(Math.cos(facing) * -r + Math.sin(facing) * i * w * 0.22,
        baseY + h * 0.5,
        Math.sin(facing) * -r - Math.cos(facing) * i * w * 0.22);
      p.lookAt(0, baseY + h * 0.5, 0);
      g.add(p);
    }
  }
}

export function buildEnvironment(state, mats) {
  const g = new THREE.Group();
  g.name = 'env';
  const E = state.entorno;

  const groundPlane = (mat, r = 220) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 56), mat);
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  if (E === 'estudio') {
    groundPlane(mats.ground, 240);

  } else if (E === 'patio') {
    groundPlane(mats.lawn, 200);
    // muro perimetral del patio
    const PW = 21, PD = 14, H = 1.9;
    for (const sz of [-1, 1]) {
      addBox(g, mats.wood, PW * 2, H, 0.12, 0, H / 2, sz * PD);
    }
    for (const sx of [-1, 1]) {
      addBox(g, mats.wood, 0.12, H, PD * 2, sx * PW, H / 2, 0);
    }
    for (let i = -5; i <= 5; i++) {
      for (const sz of [-1, 1]) {
        addBox(g, mats.wood, 0.18, H + 0.15, 0.18, i * 4, (H + 0.15) / 2, sz * PD);
      }
    }
    // casa
    addBox(g, mats.houseWall, 9, 6.2, 7, -16.2, 3.1, -8.5);
    addBox(g, mats.roof, 9.8, 0.35, 7.8, -16.2, 6.45, -8.5);
    addBox(g, mats.houseWall, 4.5, 3.4, 5, -16.2, 1.7, -2.8);
    addBox(g, mats.roof, 5.1, 0.3, 5.6, -16.2, 3.55, -2.8);
    for (const wx of [-18.4, -16.2, -14]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), mats.windowGlow);
      win.position.set(wx, 3.4, -4.97);
      g.add(win);
    }
    // sendero y vegetacion
    for (let i = 0; i < 6; i++) {
      addBox(g, mats.concrete, 1.1, 0.04, 0.8, -12.5 + i * 1.6, 0.02, -6.4, false);
    }
    tree(g, mats, -19, 8, 1.4);
    tree(g, mats, 16, -11.5, 1.2);
    tree(g, mats, 18.5, 9.5, 1.5);
    for (const [bx, bz] of [[-8, 12.6], [0, 12.8], [8, 12.6], [14, -13.2]]) {
      addSphere(g, mats.hedge, 0.75, bx, 0.55, bz);
    }

  } else if (E === 'club') {
    groundPlane(mats.asphalt, 220);
    // casa club con frente vidriado
    addBox(g, mats.concrete, 18, 4.6, 8, -3, 2.3, 19);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.6), mats.windowGlow);
    front.position.set(-3, 2.1, 14.96);
    front.rotation.y = Math.PI;
    g.add(front);
    addBox(g, mats.roofSlab, 19.4, 0.3, 9, -3, 4.75, 19);
    addBox(g, mats.accent, 6, 0.8, 0.2, -3, 5.4, 14.8);
    // cancha vecina simplificada
    addBox(g, mats.slab, 20.6, 0.07, 10.6, 27, 0.035, -2);
    addBox(g, mats.turf, 20, 0.02, 10, 27, 0.08, -2, false);
    for (const szz of [-1, 1]) {
      meshPanel(g, mats.fence, 'x', -2 + szz * 5.03, 17.05, 36.95, 0.07, 3.07);
    }
    for (const sxx of [-1, 1]) {
      meshPanel(g, mats.fence, 'z', 27 + sxx * 10.03, -7.03, 3.03, 0.07, 3.07);
    }
    // setos y mastiles de banderas
    for (let i = -3; i <= 3; i++) {
      addBox(g, mats.hedge, 3.2, 1.0, 0.9, i * 4.2, 0.5, 12.2);
    }
    for (const fx of [-14, -11.5, -9]) {
      addCylY(g, mats.pole, 0.04, 7, fx, 3.5, 14, 10);
      addBox(g, mats.accent, 1.3, 0.7, 0.04, fx + 0.68, 6.4, 14, false);
    }
    // estacionamiento
    for (let i = 0; i < 6; i++) {
      addBox(g, mats.white, 0.1, 0.012, 5, -22 - i * 2.8, 0.01, 14, false);
    }

  } else if (E === 'campo') {
    groundPlane(mats.grassField, 400);
    const arboles = [
      [-22, 9, 1.6], [-27, -6, 1.3], [-16, -16, 1.8], [14, -19, 1.4],
      [24, -9, 1.7], [28, 6, 1.3], [20, 16, 1.9], [4, 21, 1.4],
      [-10, 23, 1.6], [-32, 16, 2.0], [36, -16, 2.1], [-38, -14, 1.8],
      [44, 10, 2.2], [-12, -26, 1.5],
    ];
    for (const [tx, tz, ts] of arboles) tree(g, mats, tx, tz, ts);
    // lomas en el horizonte
    for (const [hx, hz, hr] of [[-120, -60, 70], [110, -80, 85], [40, 130, 95], [-100, 90, 80]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 24, 12), mats.leaf);
      hill.scale.y = 0.18;
      hill.position.set(hx, -2, hz);
      g.add(hill);
    }
    // camino de tierra
    addBox(g, mats.wood, 3.2, 0.015, 60, -14.5, 0.008, 24, false);

  } else if (E === 'azotea') {
    // losa de azotea con antepecho
    addBox(g, mats.roofSlab, 36, 0.35, 22, 0, -0.175, 0);
    const PH = 1.15;
    for (const sz of [-1, 1]) {
      addBox(g, mats.parapet, 36, PH, 0.3, 0, PH / 2, sz * 10.85);
    }
    for (const sx of [-1, 1]) {
      addBox(g, mats.parapet, 0.3, PH, 22, sx * 17.85, PH / 2, 0);
    }
    // unidades de clima
    for (const [ax, az] of [[-15.5, 8.2], [-13.2, 8.2], [15.5, -8.4]]) {
      addBox(g, mats.concrete, 1.6, 1.0, 1.1, ax, 0.5, az);
      addCylY(g, mats.bolt, 0.34, 0.1, ax, 1.05, az, 16);
    }
    // cuerpo del edificio y ciudad alrededor
    addBox(g, mats.cityB, 34, 30, 20, 0, -15.2, 0, false);
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(400, 40),
      new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.95 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -30.2;
    g.add(suelo);
    const city = [
      [mats.cityA, -38, -14, 14, 34, 14], [mats.cityC, -42, 16, 16, 46, 12],
      [mats.cityB, -20, -34, 12, 26, 12], [mats.cityA, 6, -38, 16, 40, 14],
      [mats.cityC, 34, -26, 14, 30, 12], [mats.cityB, 44, -2, 16, 52, 16],
      [mats.cityA, 38, 22, 12, 36, 12], [mats.cityC, 10, 36, 18, 28, 14],
      [mats.cityB, -16, 40, 14, 44, 12], [mats.cityA, -52, -36, 18, 38, 16],
      [mats.cityC, 58, -34, 16, 44, 14], [mats.cityB, -58, 38, 16, 56, 14],
    ];
    for (const [m, bx, bz, w, h, d] of city) {
      building(g, mats, m, bx, bz, w, h, d, -30, mats.windowGlow);
    }

  } else {
    // indoor: nave deportiva alta (14.5 m) y amplia
    const HALL_W = 60, HALL_D = 34, HALL_H = 14.5;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W, HALL_D), mats.hallFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(HALL_W, HALL_H, HALL_D), mats.hallWall);
    hall.position.y = HALL_H / 2;
    g.add(hall);
    // columnas y cerchas
    for (let i = -3; i <= 3; i++) {
      for (const sz of [-1, 1]) {
        addBox(g, mats.steel, 0.35, HALL_H - 0.5, 0.35, i * 8.2,
          (HALL_H - 0.5) / 2, sz * (HALL_D / 2 - 0.4), false);
      }
      addBox(g, mats.steel, 0.22, 0.5, HALL_D - 0.8, i * 8.2, HALL_H - 0.7, 0, false);
    }
    // luminarias lineales colgantes
    for (let i = -1; i <= 1; i++) {
      for (const sz of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.4), mats.hallLight);
        strip.rotation.x = Math.PI / 2;
        strip.position.set(i * 12, HALL_H - 1.3, sz * 5.5);
        g.add(strip);
        addBox(g, mats.steel, 9, 0.07, 0.12, i * 12, HALL_H - 1.25, sz * 5.5, false);
      }
    }
  }

  // sombra de contacto suave bajo la losa
  if (mats.blob) {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(26, 14.5), mats.blob);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.004;
    g.add(blob);
  }
  return g;
}
