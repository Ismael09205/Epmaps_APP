import { Directory, File, Paths } from 'expo-file-system';

import { isValidTile, tilesAround, type TileCoordinate } from '../domain/map-tiles';

const TILES_DIRECTORY = 'map-tiles';
const TILE_URL = 'https://tile.openstreetmap.org';
// La política de uso de las teselas de OpenStreetMap exige identificar la aplicación.
const TILE_HEADERS = { 'User-Agent': 'EPMAPS-Medidores/1.0 (lecturas de medidores)' };

function tileFile({ z, x, y }: TileCoordinate): File {
  return new File(Paths.document, TILES_DIRECTORY, String(z), String(x), `${y}.png`);
}

async function downloadTile(tile: TileCoordinate): Promise<File> {
  const directory = new Directory(Paths.document, TILES_DIRECTORY, String(tile.z), String(tile.x));
  directory.create({ idempotent: true, intermediates: true });

  return File.downloadFileAsync(`${TILE_URL}/${tile.z}/${tile.x}/${tile.y}.png`, tileFile(tile), {
    headers: TILE_HEADERS,
    idempotent: true,
  });
}

// Devuelve la tesela como data URI: primero la guardada en el teléfono; con conexión, la descarga
// y la guarda para verla después sin conexión. Sin conexión y sin tesela guardada devuelve null.
export async function loadTile(tile: TileCoordinate, isOnline: boolean): Promise<string | null> {
  if (!isValidTile(tile)) {
    return null;
  }

  try {
    const cached = tileFile(tile);
    const file = cached.exists ? cached : isOnline ? await downloadTile(tile) : null;

    return file ? `data:image/png;base64,${await file.base64()}` : null;
  } catch (error: unknown) {
    console.warn('No se pudo cargar la tesela del mapa.', error);
    return null;
  }
}

// Indica si el mapa de la zona de trabajo alrededor del punto ya está guardado en el teléfono.
export async function isAreaDownloaded(latitude: number, longitude: number): Promise<boolean> {
  try {
    return tilesAround(latitude, longitude).every((tile) => tileFile(tile).exists);
  } catch (error: unknown) {
    console.warn('No se pudo comprobar el mapa guardado de la zona.', error);
    return false;
  }
}

export type AreaDownloadResult = { total: number; downloaded: number; failed: number };

// Guarda el mapa de la zona de trabajo alrededor de un punto. Las teselas ya guardadas no se
// vuelven a descargar; las descargas son secuenciales para no saturar el servidor de teselas.
export async function downloadAreaTiles(
  latitude: number,
  longitude: number,
  onProgress?: (done: number, total: number) => void,
): Promise<AreaDownloadResult> {
  const tiles = tilesAround(latitude, longitude);
  let downloaded = 0;
  let failed = 0;

  for (const [index, tile] of tiles.entries()) {
    if (!tileFile(tile).exists) {
      try {
        await downloadTile(tile);
        downloaded += 1;
      } catch (error: unknown) {
        console.warn('No se pudo descargar la tesela del mapa.', error);
        failed += 1;
      }
    }
    onProgress?.(index + 1, tiles.length);
  }

  return { total: tiles.length, downloaded, failed };
}
