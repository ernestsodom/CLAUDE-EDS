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
};

// ----------------------------------------------------------------------------
// Materiales compartidos
// ----------------------------------------------------------------------------
export function makeMaterials(state, tex) {
  const mats = {};
  mats.turf = new THREE.MeshStandardMaterial({
    color: state.cesped, roughness: 0.93, metalness: 0.0,
  });
  if (tex && tex.turfBump) {
    mats.turf.bumpMap = tex.turfBump;
    mats.turf.bumpScale = 0.6;
  }
  mats.steel = new THREE.MeshStandardMaterial({
    color: state.estructura, roughness: 0.45, metalness: 0.55,
  });
  mats.accent = new THREE.MeshStandardMaterial({
    color: state.acento, roughness: 0.4, metalness: 0.0,
    emissive: state.acento, emissiveIntensity: 0.3,
  });
  mats.white = new THREE.MeshStandardMaterial({
    color: 0xe8e8e8, roughness: 0.6,
  });
  mats.glass = new THREE.MeshPhysicalMaterial({
    color: 0xe9f1ef, roughness: 0.05, metalness: 0,
    transmission: 0.92, ior: 1.45, thickness: 0.02,
    envMapIntensity: 1.4,
  });
  mats.fence = new THREE.MeshStandardMaterial({
    color: state.estructura, roughness: 0.5, metalness: 0.6,
    side: THREE.DoubleSide,
  });
  if (tex && tex.grid) {
    mats.fence.map = tex.grid;
    mats.fence.alphaTest = 0.35;
  }
  mats.net = new THREE.MeshStandardMaterial({
    color: 0x15171a, roughness: 0.8, side: THREE.DoubleSide,
  });
  if (tex && tex.net) {
    mats.net.map = tex.net;
    mats.net.alphaTest = 0.3;
    mats.net.color = new THREE.Color(0xffffff);
  }
  mats.led = new THREE.MeshStandardMaterial({
    color: 0x202226, emissive: 0xfff4e0, emissiveIntensity: 0.5,
  });
  mats.slab = new THREE.MeshStandardMaterial({
    color: 0x0c0d0f, roughness: 0.7, metalness: 0.1,
  });
  return mats;
}

export function updateMaterialColors(mats, state) {
  mats.turf.color.set(state.cesped);
  mats.steel.color.set(state.estructura);
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

function addCylX(g, mat, r, len, x, y, z) {
  const geo = new THREE.CylinderGeometry(r, r, len, 18);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addCylZ(g, mat, r, len, x, y, z) {
  const geo = new THREE.CylinderGeometry(r, r, len, 18);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addCylY(g, mat, r, len, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), mat);
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

/* Panel de malla con UVs escalados para el patron 50x50mm (celda textura=0.5m).
   orient: 'x' plano paralelo a X (muro lateral), 'z' paralelo a Z (fondo). */
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
// Cancha (estructura fija segun tipo)
// ----------------------------------------------------------------------------
export function buildCourt(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'court';
  const panoramic = state.tipo === 'panoramica';

  // losa y cesped
  addBox(g, mats.slab, D.L + 0.7, D.SLAB_TOP, D.W + 0.7, 0, D.SLAB_TOP / 2, 0);
  const turf = addBox(g, mats.turf, D.L + 0.05, D.TURF - D.SLAB_TOP, D.W + 0.05,
    0, (D.SLAB_TOP + D.TURF) / 2, 0);
  turf.castShadow = false;

  // lineas reglamentarias (saque a 6.95m + central)
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

  // ---- vidrios ----
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

  // fijaciones puntuales (panoramica) o postes intermedios (clasica) en fondos
  if (panoramic) {
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) {
        for (const yj of [0.45, 1.55, 2.65]) {
          addCylX(g, mats.steel, 0.026, 0.024, sx * D.WALL_X, D.SLAB_TOP + yj, zj);
        }
        addBox(g, mats.steel, 0.04, D.Z4 - D.Z3, 0.04,
          sx * D.WALL_X, (D.Z3 + D.Z4) / 2, zj);
      }
    }
  } else {
    for (const sx of [-1, 1]) {
      for (const zj of [-3, -1, 1, 3]) {
        addBox(g, mats.steel, 0.08, D.Z4 - D.SLAB_TOP, 0.08,
          sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, zj);
      }
      // marcos horizontales de vidrio en cancha clasica
      addBox(g, mats.steel, 0.06, 0.06, D.W, sx * D.WALL_X, D.SLAB_TOP + 1.5, 0);
    }
  }

  // ---- malla metalica (texturizada) ----
  const F = mats.fence;
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    meshPanel(g, F, 'x', wz, -D.HX + 2, -D.DOOR_HALF, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, D.DOOR_HALF, D.HX - 2, D.SLAB_TOP, D.Z3);
    meshPanel(g, F, 'x', wz, -D.DOOR_HALF, D.DOOR_HALF, D.DOOR_H, D.Z3);
    meshPanel(g, F, 'x', wz, -D.HX, -D.HX + 2, D.Z3, D.Z4);
    meshPanel(g, F, 'x', wz, D.HX - 2, D.HX, D.Z3, D.Z4);
  }
  for (const sx of [-1, 1]) {
    meshPanel(g, F, 'z', sx * D.WALL_X, -D.HY, D.HY, D.Z3, D.Z4);
  }

  // ---- postes ----
  for (const sz of [-1, 1]) {
    for (const px of [-8, -6, -4, -2, 2, 4, 6, 8]) {
      const h = Math.abs(px) === 8 ? D.Z4 : D.Z3;
      addBox(g, mats.steel, 0.08, h - D.SLAB_TOP, 0.08,
        px, (D.SLAB_TOP + h) / 2, sz * D.WALL_Z);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(g, mats.steel, 0.08, D.Z4 - D.SLAB_TOP, 0.08,
        sx * D.WALL_X, (D.SLAB_TOP + D.Z4) / 2, sz * D.WALL_Z);
      addBox(g, mats.accent, 0.092, 0.07, 0.092,
        sx * D.WALL_X, D.Z4 + 0.035, sz * D.WALL_Z);
    }
  }

  // ---- riel perimetral acento a 3m ----
  const RR = 0.034;
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
  // remate superior a 4m
  for (const sx of [-1, 1]) {
    addCylZ(g, mats.steel, 0.025, D.W + 0.06, sx * D.WALL_X, D.Z4, 0);
    for (const sz of [-1, 1]) {
      addCylX(g, mats.steel, 0.025, 2.06, sx * (D.HX - 1), D.Z4, sz * D.WALL_Z);
    }
  }

  // ---- marcos de acceso (puerta unica por lado) ----
  for (const sz of [-1, 1]) {
    const wz = sz * D.WALL_Z;
    for (const xj of [-D.DOOR_HALF, D.DOOR_HALF]) {
      addBox(g, mats.accent, 0.07, D.DOOR_H - D.SLAB_TOP, 0.07,
        xj, (D.SLAB_TOP + D.DOOR_H) / 2, wz);
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
      uv.setXY(i, uv.getX(i) * (D.W / 0.45), uv.getY(i) * ((netTop - 0.06 - D.TURF) / 0.45));
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
  }

  return g;
}

// ----------------------------------------------------------------------------
// Modelos de iluminacion. Devuelve {group, spots} (spots se encienden de noche)
// ----------------------------------------------------------------------------
export function buildLights(state, mats) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'lights';
  const spots = [];

  const addSpot = (x, y, z) => {
    const s = new THREE.SpotLight(0xfff2dd, 0, 0, 0.95, 0.6, 1.6);
    s.position.set(x, y, z);
    s.target.position.set(x * 0.45, 0, z * 0.3);
    g.add(s);
    g.add(s.target);
    spots.push(s);
  };

  const headAt = (x, y, z) => {
    addBox(g, mats.steel, 1.15, 0.095, 0.3, x, y, z);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.21), mats.led);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, y - 0.052, z);
    strip.rotation.z = Math.PI;
    g.add(strip);
    for (const s of [-1, 1]) {
      addBox(g, mats.accent, 0.02, 0.095, 0.3, x + s * 0.585, y, z);
    }
    addSpot(x, y - 0.1, z);
  };

  if (state.luces === 'curvo') {
    // brazos curvos montados a la estructura en x=±6
    for (const px of [-6, 6]) {
      for (const sz of [-1, 1]) {
        const zo = sz * (D.WALL_Z + 0.115);
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(px, 2.25, zo),
          new THREE.Vector3(px, 5.1, zo),
          new THREE.Vector3(px, 5.95, zo - sz * 0.7),
          new THREE.Vector3(px, 6.03, zo - sz * 1.55),
        );
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.05, 12), mats.steel);
        tube.castShadow = true;
        g.add(tube);
        for (const yb of [2.4, 2.9]) {
          addBox(g, mats.steel, 0.13, 0.07, 0.13, px, yb, sz * (D.WALL_Z + 0.055));
        }
        addCylY(g, mats.accent, 0.052, 0.02, px, 2.24, zo);
        headAt(px, 6.05, zo - sz * 1.78);
      }
    }
  } else if (state.luces === 'columna') {
    // columnas rectas al suelo en las 4 posiciones x=±6
    for (const px of [-6, 6]) {
      for (const sz of [-1, 1]) {
        const zo = sz * (D.WALL_Z + 1.15);
        addCylY(g, mats.steel, 0.06, 6.1, px, 3.05, zo);
        addCylY(g, mats.steel, 0.14, 0.03, px, 0.015, zo);
        addBox(g, mats.steel, 0.06, 0.06, 1.3, px, 5.98, zo - sz * 0.65);
        addCylY(g, mats.accent, 0.062, 0.05, px, 6.07, zo);
        headAt(px, 6.0, zo - sz * 1.35);
      }
    }
  } else {
    // riel LED perimetral integrado (sin postes): tubo emisivo sobre el riel
    const ledRail = mats.ledRail;
    for (const sz of [-1, 1]) {
      addCylX(g, ledRail, 0.018, D.L + 0.02, 0, D.Z3 + 0.05, sz * D.WALL_Z);
    }
    for (const sx of [-1, 1]) {
      addCylZ(g, ledRail, 0.018, D.W + 0.02, sx * D.WALL_X, D.Z3 + 0.05, 0);
    }
    for (const px of [-5, 5]) {
      for (const sz of [-1, 1]) {
        addSpot(px, D.Z3 + 0.1, sz * (D.WALL_Z - 0.2));
      }
    }
  }
  return { group: g, spots };
}

// ----------------------------------------------------------------------------
// Entorno: outdoor (suelo abierto) o indoor (nave deportiva)
// ----------------------------------------------------------------------------
export function buildEnvironment(state, mats) {
  const g = new THREE.Group();
  g.name = 'env';
  const indoor = state.entorno === 'indoor';

  if (!indoor) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(160, 48),
      new THREE.MeshStandardMaterial({ color: 0xc6c9ce, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
  } else {
    const HALL_W = 44, HALL_D = 26, HALL_H = 9.2;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W, HALL_D),
      new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(HALL_W, HALL_H, HALL_D),
      new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.95, side: THREE.BackSide }));
    hall.position.y = HALL_H / 2;
    g.add(hall);
    // cerchas y luminarias lineales
    for (let i = -2; i <= 2; i++) {
      addBox(g, mats.steel, 0.18, 0.35, HALL_D - 0.5, i * 8, HALL_H - 0.45, 0, false);
    }
    for (let i = -1; i <= 1; i++) {
      for (const sz of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 0.32), mats.hallLight);
        strip.rotation.x = Math.PI / 2;
        strip.position.set(i * 10, HALL_H - 0.62, sz * 5.5);
        g.add(strip);
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
