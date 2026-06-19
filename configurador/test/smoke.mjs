/* Prueba de humo sin navegador: construye la escena en todas las
   combinaciones de configuracion y verifica que no haya excepciones. */
import * as THREE from '../js/vendor/three.module.min.js';
import {
  makeMaterials, updateMaterialColors, buildCourt, buildLights,
  buildEnvironment,
} from '../js/court3d.js';

let ok = 0, total = 0;
const fail = [];

for (const tipo of ['panoramica', 'semi', 'normal']) {
  for (const luces of ['curvo', 'mastil', 'esquina', 'rielLED']) {
    for (const entorno of ['estudio', 'estadio', 'indoor', 'patio', 'club', 'campo', 'azotea']) {
      total++;
      const state = {
        tipo, luces, entorno,
        cesped: '#1f4fd8', estructura: '#0e0f12',
        postesLuz: '#f2f3f5', acento: '#ff5a00', lineas: '#ffffff',
      };
      try {
        const mats = makeMaterials(state, null);
        mats.ledRail = new THREE.MeshStandardMaterial();
        mats.hallLight = new THREE.MeshStandardMaterial();
        mats.blob = null;

        const court = buildCourt(state, mats);
        const lights = buildLights(state, mats);
        const env = buildEnvironment(state, mats);

        let n = 0;
        for (const g of [court, lights.group, env]) g.traverse(() => n++);
        if (n < 80) throw new Error(`escena sospechosamente vacia (${n} nodos)`);
        const esperado = luces === 'rielLED' ? 10 : 4;
        if (lights.spots.length !== esperado) {
          throw new Error(`focos: esperaba ${esperado}, hay ${lights.spots.length}`);
        }
        updateMaterialColors(mats, state);
        ok++;
      } catch (e) {
        fail.push(`${tipo}/${luces}/${entorno}: ${e.message}`);
      }
    }
  }
}

if (fail.length) {
  console.error('FALLAS:\n' + fail.join('\n'));
  process.exit(1);
}
console.log(`${ok}/${total} combinaciones OK`);
