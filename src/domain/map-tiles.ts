// Teselas OpenStreetMap (esquema XYZ / Web Mercator) para guardar el mapa de una zona de trabajo.
export type TileCoordinate = { z: number; x: number; y: number };

export const OFFLINE_ZOOM_LEVELS = [14, 15, 16, 17] as const;
export const OFFLINE_RADIUS_METERS = 1500;
const MAX_TILES_PER_AREA = 400;
const METERS_PER_DEGREE_LATITUDE = 111_320;

export function isValidTile({ z, x, y }: TileCoordinate): boolean {
  const size = 2 ** z;
  return (
    Number.isInteger(z) &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    z >= 0 &&
    z <= 19 &&
    x >= 0 &&
    x < size &&
    y >= 0 &&
    y < size
  );
}

export function toTile(latitude: number, longitude: number, z: number): TileCoordinate {
  const size = 2 ** z;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const x = Math.floor(((longitude + 180) / 360) * size);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * size,
  );
  const clamp = (value: number) => Math.min(size - 1, Math.max(0, value));

  return { z, x: clamp(x), y: clamp(y) };
}

// Teselas que cubren un cuadrado de `radiusMeters` alrededor del punto en cada nivel de zoom.
export function tilesAround(
  latitude: number,
  longitude: number,
  radiusMeters: number = OFFLINE_RADIUS_METERS,
  zoomLevels: readonly number[] = OFFLINE_ZOOM_LEVELS,
): TileCoordinate[] {
  const latitudeDelta = radiusMeters / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta =
    radiusMeters / (METERS_PER_DEGREE_LATITUDE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  const tiles: TileCoordinate[] = [];

  for (const z of zoomLevels) {
    const northWest = toTile(latitude + latitudeDelta, longitude - longitudeDelta, z);
    const southEast = toTile(latitude - latitudeDelta, longitude + longitudeDelta, z);
    for (let x = northWest.x; x <= southEast.x; x += 1) {
      for (let y = northWest.y; y <= southEast.y; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }

  if (tiles.length > MAX_TILES_PER_AREA) {
    throw new RangeError('La zona solicitada es demasiado grande para descargarla.');
  }

  return tiles;
}
