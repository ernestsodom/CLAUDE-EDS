// Genera src/static-images.js con las imágenes incluidas en public/img (para la biblioteca del back office).
import { readdirSync, writeFileSync } from 'node:fs';
const files = readdirSync(new URL('../public/img/', import.meta.url)).filter(f => /\.(webp|png|jpe?g|svg|gif|avif)$/i.test(f)).sort();
writeFileSync(new URL('../src/static-images.js', import.meta.url),
  `// Archivo generado por scripts/static-images.mjs\nexport const STATIC_IMAGES = ${JSON.stringify(files.map(f => '/img/' + f), null, 2)};\n`);
console.log(files.length, 'imágenes');
