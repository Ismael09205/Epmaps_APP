import * as Location from 'expo-location';

import type { ReadingLocation } from '@/domain/reading-location';

const GPS_TIMEOUT_MS = 20_000;

export type GpsResult =
  | { status: 'ok'; location: ReadingLocation }
  | { status: 'denied' | 'services-off' | 'unavailable' };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toReadingLocation(position: Location.LocationObject): ReadingLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    source: 'gps',
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

// Pide permiso y obtiene la posición actual. El GPS funciona sin conexión; si no responde a tiempo
// se usa la última posición conocida.
export async function requestGpsLocation(): Promise<GpsResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      return { status: 'services-off' };
    }

    const position =
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        GPS_TIMEOUT_MS,
      )) ?? (await Location.getLastKnownPositionAsync());

    return position ? { status: 'ok', location: toReadingLocation(position) } : { status: 'unavailable' };
  } catch (error: unknown) {
    console.warn('No se pudo obtener la ubicación del GPS.', error);
    return { status: 'unavailable' };
  }
}

// Última posición conocida sin pedir permiso: null si no hay permiso concedido o posición guardada.
export async function getKnownGpsLocation(): Promise<ReadingLocation | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    const position = await Location.getLastKnownPositionAsync();
    return position ? toReadingLocation(position) : null;
  } catch {
    return null;
  }
}
