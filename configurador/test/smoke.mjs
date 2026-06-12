/* Prueba de humo sin navegador: construye la escena en todas las
   combinaciones de configuracion y verifica que no haya excepciones. */
import * as THREE from '../js/vendor/three.module.min.js';
import {
  makeMaterials, updateMaterialColors, buildCourt, buildLights,
  buildEnvironment,
} from '../js/court3d.js';

let ok = 0;
const fail = [];

for (const tipo of ['panoramica', 'clasica']) {
  for (const luces of ['curvo', 'columna', 'rielLED']) {
    for (const entorno of ['outdoor', 'indoor']) {
      const state = {
        tipo, luces, entorno,
        cesped: '#1f4fd8', estructura: '#0e0f12', acento: '#ff5a00',
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
        if (n < 60) throw new Error(`escena sospechosamente vacia (${n} nodos)`);
        if (luces !== 'rielLED' && lights.spots.length !== 4) {
          throw new Error(`se esperaban 4 focos, hay ${lights.spots.length}`);
        }
        updateMaterialColors(mats, state);
        ok++;
        console.log(`OK  ${tipo} / ${luces} / ${entorno}  (${n} nodos)`);
      } catch (e) {
        fail.push(`${tipo}/${luces}/${entorno}: ${e.message}`);
      }
    }
  }
}

if (fail.length) {
  console.error('\nFALLAS:\n' + fail.join('\n'));
  process.exit(1);
}
console.log(`\n${ok}/12 combinaciones OK`);
