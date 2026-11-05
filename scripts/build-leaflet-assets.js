// Genera `src/components/map/leaflet-assets.ts` con el JS y el CSS de Leaflet instalados en
// node_modules, para cargar el mapa dentro de la WebView sin conexión (sin CDN).
// Uso: npm run build:leaflet (volver a ejecutar al actualizar la versión de leaflet).
const fs = require('fs');
const path = require('path');

// Se ejecuta con npm desde la raíz del proyecto.
const root = process.cwd();
const dist = path.join(root, 'node_modules', 'leaflet', 'dist');
const { version } = require(path.join(root, 'node_modules', 'leaflet', 'package.json'));
const js = fs.readFileSync(path.join(dist, 'leaflet.js'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'leaflet.css'), 'utf8');
const output = path.join(root, 'src', 'components', 'map', 'leaflet-assets.ts');

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  [
    `// Archivo generado por scripts/build-leaflet-assets.js a partir de leaflet@${version}. No editar.`,
    '/* eslint-disable */',
    `export const LEAFLET_VERSION = ${JSON.stringify(version)};`,
    `export const LEAFLET_CSS = ${JSON.stringify(css)};`,
    `export const LEAFLET_JS = ${JSON.stringify(js)};`,
    '',
  ].join('\n'),
);

console.log(`Leaflet ${version} copiado en ${path.relative(root, output)}`);
