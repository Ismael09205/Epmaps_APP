import { Directory, File, Paths } from 'expo-file-system';

import { normalizeMeterCode } from '../domain/meter-code';

const PHOTOS_DIRECTORY = 'reading-photos';

// Copia la foto temporal de la cámara al almacenamiento persistente de la aplicación,
// donde el sistema no la elimina, y devuelve su nueva ubicación.
export async function persistReadingPhoto(
  temporaryUri: string,
  meterCode: string,
  now: Date = new Date(),
): Promise<string> {
  const directory = new Directory(Paths.document, PHOTOS_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    directory,
    `${normalizeMeterCode(meterCode)}-${now.getTime()}.jpg`,
  );
  await new File(temporaryUri).copy(destination);

  return destination.uri;
}

// HU-008: elimina la foto de una captura descartada o reemplazada; nunca la de un registro guardado.
export function deleteReadingPhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
