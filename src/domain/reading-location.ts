// Ubicación del medidor registrada con cada lectura: por GPS (automática) o con el marcador
// del mapa (manual). La precisión del GPS se registra; una precisión baja solo genera advertencia.
export type LocationSource = 'gps' | 'manual';

export type ReadingLocation = {
  latitude: number;
  longitude: number;
  // Radio de precisión del GPS en metros; null en la ubicación manual o si el GPS no la informa.
  accuracy: number | null;
  source: LocationSource;
  capturedAt: string;
};

// Corrección de la ubicación de un registro: se conservan la anterior y la nueva.
export type ReadingLocationChange = {
  previous: ReadingLocation | null;
  next: ReadingLocation;
  changedAt: string;
};

export const LOW_ACCURACY_METERS = 30;

export class ReadingLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadingLocationError';
  }
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isValidReadingLocation(location: unknown): location is ReadingLocation {
  if (typeof location !== 'object' || location === null) {
    return false;
  }

  const record = location as Record<string, unknown>;
  return (
    typeof record.latitude === 'number' &&
    typeof record.longitude === 'number' &&
    isValidCoordinates(record.latitude, record.longitude) &&
    (record.accuracy === null ||
      (typeof record.accuracy === 'number' &&
        Number.isFinite(record.accuracy) &&
        record.accuracy >= 0)) &&
    (record.source === 'gps' || record.source === 'manual') &&
    typeof record.capturedAt === 'string' &&
    Number.isFinite(new Date(record.capturedAt).getTime())
  );
}

// Obligatoria en los tres estados del medidor.
export function requireReadingLocation(location: ReadingLocation | null): ReadingLocation {
  if (location === null) {
    throw new ReadingLocationError('Registre la ubicación del medidor.');
  }

  if (!isValidReadingLocation(location)) {
    throw new ReadingLocationError('La ubicación del medidor no es válida.');
  }

  return location;
}

export function isLowAccuracy(location: ReadingLocation): boolean {
  return location.source === 'gps' && (location.accuracy === null || location.accuracy > LOW_ACCURACY_METERS);
}

export function isSameLocation(a: ReadingLocation | null, b: ReadingLocation | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.accuracy === b.accuracy &&
    a.source === b.source &&
    a.capturedAt === b.capturedAt
  );
}

export function describeLocationChange(
  previous: ReadingLocation | null,
  next: ReadingLocation,
  changedAt: Date,
): ReadingLocationChange | null {
  if (isSameLocation(previous, next)) {
    return null;
  }

  return { previous, next, changedAt: changedAt.toISOString() };
}

export const HIGH_ACCURACY_METERS = 10;

// Calidad de la ubicación del GPS según su radio de precisión; null en la ubicación manual.
export type LocationQuality = 'high' | 'medium' | 'low' | 'unknown';

export function assessLocationQuality(location: ReadingLocation): LocationQuality | null {
  if (location.source === 'manual') {
    return null;
  }

  if (location.accuracy === null) {
    return 'unknown';
  }

  return location.accuracy <= HIGH_ACCURACY_METERS
    ? 'high'
    : location.accuracy <= LOW_ACCURACY_METERS
      ? 'medium'
      : 'low';
}

export const LOCATION_QUALITY_LABELS: Record<LocationQuality, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  unknown: 'No disponible',
};

// Explicación para el técnico del margen de error de la ubicación.
export function describeLocationMargin(location: ReadingLocation): string {
  if (location.source === 'manual') {
    return 'Ajustada por el técnico en el mapa; no depende de la señal del GPS.';
  }

  if (location.accuracy === null) {
    return 'El GPS no informó su margen de error.';
  }

  return `El punto puede desviarse hasta ${Math.round(location.accuracy)} m del lugar real.`;
}
