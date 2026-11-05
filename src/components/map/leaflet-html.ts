import { LEAFLET_CSS, LEAFLET_JS } from './leaflet-assets';

// Centro inicial del mapa (Quito) mientras no hay una ubicación.
export const DEFAULT_MAP_CENTER = { latitude: -0.1807, longitude: -78.4678 };

export type MapColors = { marker: string; accuracy: string; missingTile: string };

// Mensajes de la WebView hacia la aplicación.
export type MapMessage =
  | { type: 'ready' }
  | { type: 'tile'; id: number; z: number; x: number; y: number }
  | { type: 'manual'; latitude: number; longitude: number };

export function parseMapMessage(data: string): MapMessage | null {
  try {
    const message: unknown = JSON.parse(data);
    if (typeof message !== 'object' || message === null) {
      return null;
    }

    const record = message as Record<string, unknown>;
    const isNumber = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value);

    if (record.type === 'ready') {
      return { type: 'ready' };
    }

    if (
      record.type === 'tile' &&
      isNumber(record.id) &&
      isNumber(record.z) &&
      isNumber(record.x) &&
      isNumber(record.y)
    ) {
      return { type: 'tile', id: record.id, z: record.z, x: record.x, y: record.y };
    }

    if (record.type === 'manual' && isNumber(record.latitude) && isNumber(record.longitude)) {
      return { type: 'manual', latitude: record.latitude, longitude: record.longitude };
    }
  } catch {
    // Mensaje que no proviene del mapa.
  }

  return null;
}

// Página del mapa con Leaflet incluido en la aplicación. Las teselas no se piden a internet desde
// la WebView: cada una se solicita a la aplicación, que la entrega desde el teléfono o la descarga.
// Con `interactive` en false el marcador queda fijo: el mapa solo muestra la ubicación registrada.
export function buildLeafletHtml(colors: MapColors, { interactive = true } = {}): string {
  const script = `
(function () {
  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  var interactive = ${interactive};
  var center = [${DEFAULT_MAP_CENTER.latitude}, ${DEFAULT_MAP_CENTER.longitude}];
  var map = L.map('map', { zoomControl: true }).setView(center, 15);
  var pending = {};
  var nextTileId = 1;

  var AppTileLayer = L.GridLayer.extend({
    createTile: function (coords, done) {
      var tile = document.createElement('div');
      var id = nextTileId++;
      pending[id] = { tile: tile, done: done };
      post({ type: 'tile', id: id, z: coords.z, x: coords.x, y: coords.y });
      return tile;
    }
  });
  new AppTileLayer({
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  window.epmapsTile = function (id, src) {
    var entry = pending[id];
    if (!entry) return;
    delete pending[id];
    if (!src) {
      entry.tile.className += ' missing';
      entry.done(null, entry.tile);
      return;
    }
    var image = document.createElement('img');
    image.alt = '';
    image.onload = function () { entry.done(null, entry.tile); };
    image.onerror = function () { entry.tile.className += ' missing'; entry.done(null, entry.tile); };
    image.src = src;
    entry.tile.appendChild(image);
  };

  var icon = L.divIcon({ className: 'pin', html: '<div class="pin-head"></div>', iconSize: [28, 28], iconAnchor: [14, 28] });
  var marker = null;
  var accuracyCircle = null;

  function placeMarker(latlng) {
    if (marker) {
      marker.setLatLng(latlng);
      return;
    }
    marker = L.marker(latlng, { draggable: interactive, icon: icon, keyboard: false }).addTo(map);
    marker.on('dragend', function () {
      var position = marker.getLatLng();
      post({ type: 'manual', latitude: position.lat, longitude: position.lng });
    });
  }

  if (interactive) map.on('click', function (event) {
    placeMarker(event.latlng);
    post({ type: 'manual', latitude: event.latlng.lat, longitude: event.latlng.lng });
  });

  window.epmapsSetLocation = function (location, recenter) {
    var latlng = [location.latitude, location.longitude];
    placeMarker(latlng);
    if (accuracyCircle) {
      map.removeLayer(accuracyCircle);
      accuracyCircle = null;
    }
    if (location.source === 'gps' && location.accuracy) {
      accuracyCircle = L.circle(latlng, {
        radius: location.accuracy,
        color: '${colors.accuracy}',
        weight: 1,
        fillOpacity: 0.15,
        interactive: false
      }).addTo(map);
    }
    if (recenter) {
      map.setView(latlng, Math.max(map.getZoom(), 17));
    }
  };

  post({ type: 'ready' });
})();`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
  .leaflet-tile-container div { background: ${colors.missingTile}; }
  .leaflet-tile-container img { display: block; width: 100%; height: 100%; }
  .pin { background: transparent; border: 0; }
  .pin-head {
    width: 22px; height: 22px; margin: 0 3px; border-radius: 50% 50% 50% 0;
    background: ${colors.marker}; border: 3px solid #ffffff; box-sizing: border-box;
    transform: rotate(-45deg); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>${script}</script>
</body>
</html>`;
}
