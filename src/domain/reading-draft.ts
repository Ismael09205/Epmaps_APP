import type { Meter } from './meter';
import type { ReadingFormInput } from './reading';

// HU-008: captura en curso de un técnico, desde que ingresa el código del medidor.
export type ReadingDraft = {
  employeeCode: string;
  meterDigits: string;
  form: ReadingFormInput;
  meterReviewConfirmed: boolean;
  photoUri: string | null;
  // Ficha usada en la captura, para continuar sin conexión si la caché venció.
  meter: Meter | null;
  updatedAt: string;
};

export type DraftMeterSource =
  | 'cache'
  | 'refresh'
  | 'outdated-snapshot'
  | 'requires-connection';

// Al continuar: se reutiliza la caché vigente; si no existe, se actualiza con conexión;
// sin conexión se usa la ficha guardada en la captura o se solicita conexión.
export function decideDraftMeterSource(input: {
  hasValidCache: boolean;
  hasSnapshot: boolean;
  isOnline: boolean;
}): DraftMeterSource {
  if (input.hasValidCache) {
    return 'cache';
  }

  if (input.isOnline) {
    return 'refresh';
  }

  return input.hasSnapshot ? 'outdated-snapshot' : 'requires-connection';
}
