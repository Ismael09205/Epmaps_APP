import * as v from 'valibot';

import { getDateTimeParts, type Meter } from './meter';
import { normalizeMeterCode } from './meter-code';

const MAX_INTEGER_DIGITS = 5;
const MAX_DECIMAL_DIGITS = 4;
const DECIMAL_SCALE = 10 ** MAX_DECIMAL_DIGITS;
export const MIN_NOTE_LENGTH = 10;
export const MAX_NOTE_LENGTH = 100;
// Letras (con tildes y ñ), números, espacios, coma, punto y guion.
const NOTE_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ,.-]+$/;

export type MeterCondition = 'normal' | 'inaccessible' | 'damaged';

// `not-applicable`: registro sin lectura, no hay nada que comparar con la anterior.
export type ReadingStatus = 'pending-verification' | 'verified' | 'not-applicable';

// HU-006: `not-evaluated` identifica registros anteriores a la HU; `review-required`,
// lecturas menores que la anterior, sin consumo válido hasta verificar la causa.
export type ConsumptionCheck =
  | 'not-evaluated'
  | 'not-applicable'
  | 'normal'
  | 'elevated'
  | 'review-required';

export const ELEVATED_CONSUMPTION_FACTOR = 3;

export type ConsumptionAssessment =
  | { check: 'normal' | 'elevated'; consumption: number; threshold: number }
  | { check: 'review-required'; consumption: null; threshold: number }
  | { check: 'not-applicable'; consumption: null; threshold: null };

export type MeterReading = {
  id: number;
  employeeCode: string;
  meterCode: string;
  condition: MeterCondition;
  value: number | null;
  inaccessibleReason: string | null;
  damageDescription: string | null;
  recordedAt: string;
  // Contexto para verificar después: última lectura de la ficha en caché al registrar.
  previousReading: number;
  previousReadingDate: string;
  status: ReadingStatus;
  difference: number | null;
  verifiedAt: string | null;
  // Promedio mensual de la ficha en caché al registrar; null en registros anteriores a HU-006.
  monthlyAverageConsumption: number | null;
  consumption: number | null;
  consumptionCheck: ConsumptionCheck;
  meterReviewConfirmed: boolean;
  photoUri: string | null;
  // HU-009: identificador único conservado en cada reintento de envío.
  readingUuid: string;
  syncStatus: SyncStatus;
  sentAt: string | null;
  // HU-010: fecha de la última corrección; la fecha de registro original se conserva.
  updatedAt: string | null;
};

export type SyncStatus = 'pending' | 'sent';

// El almacenamiento asigna el id, el UUID y el estado de envío al guardar.
export type NewMeterReading = Omit<
  MeterReading,
  'id' | 'readingUuid' | 'syncStatus' | 'sentAt' | 'updatedAt'
>;

// Datos de la ficha necesarios para evaluar un registro.
export type ReadingMeterContext = Pick<
  Meter,
  'meterCode' | 'lastReading' | 'lastReadingDate' | 'monthlyAverageConsumption'
>;

export type ReadingValueResult =
  | { status: 'valid'; value: number }
  | { status: 'empty' | 'invalid' | 'negative' | 'integer-too-long' | 'decimals-too-long' };

export const READING_VALUE_MESSAGES: Record<
  Exclude<ReadingValueResult['status'], 'valid'>,
  string
> = {
  empty: 'Ingrese la lectura del medidor.',
  negative: 'La lectura no puede ser negativa.',
  'integer-too-long': 'La lectura admite hasta 5 dígitos enteros.',
  'decimals-too-long': 'La lectura admite hasta 4 decimales.',
  invalid: 'Ingrese solo números; use punto o coma para los decimales.',
};

export type ReadingDetails =
  | { condition: 'normal'; value: number }
  | { condition: 'inaccessible'; inaccessibleReason: string }
  | { condition: 'damaged'; damageDescription: string; value: number | null };

export type ReadingFormInput = {
  condition: MeterCondition | null;
  value: string;
  inaccessibleReason: string;
  damageDescription: string;
};

export type ReadingFormErrors = Partial<
  Record<'condition' | 'value' | 'inaccessibleReason' | 'damageDescription', string>
>;

export type ReadingFormResult =
  | { success: true; details: ReadingDetails }
  | { success: false; errors: ReadingFormErrors };

export class MeterReadingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeterReadingError';
  }
}

export function parseReadingValue(text: string): ReadingValueResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { status: 'empty' };
  }

  if (trimmed.startsWith('-')) {
    return { status: 'negative' };
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed.replace(',', '.'));
  if (!match) {
    return { status: 'invalid' };
  }

  const [, integerPart, decimalPart = ''] = match;
  if (integerPart.length > MAX_INTEGER_DIGITS) {
    return { status: 'integer-too-long' };
  }

  if (decimalPart.length > MAX_DECIMAL_DIGITS) {
    return { status: 'decimals-too-long' };
  }

  return { status: 'valid', value: Number(`${integerPart}.${decimalPart || '0'}`) };
}

const RequiredReadingValueSchema = v.pipe(
  v.string(),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const result = parseReadingValue(dataset.value);
    if (result.status === 'valid') {
      return result.value;
    }

    addIssue({ message: READING_VALUE_MESSAGES[result.status] });
    return NEVER;
  }),
);

const OptionalReadingValueSchema = v.pipe(
  v.string(),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const result = parseReadingValue(dataset.value);
    if (result.status === 'valid') {
      return result.value;
    }

    if (result.status === 'empty') {
      return null;
    }

    addIssue({ message: READING_VALUE_MESSAGES[result.status] });
    return NEVER;
  }),
);

function noteSchema(label: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(MIN_NOTE_LENGTH, `${label} debe tener al menos ${MIN_NOTE_LENGTH} caracteres.`),
    v.maxLength(MAX_NOTE_LENGTH, `${label} admite hasta ${MAX_NOTE_LENGTH} caracteres.`),
    v.regex(NOTE_PATTERN, `${label} solo admite letras, números, espacios, coma, punto y guion.`),
  );
}

// HU-005: la lectura es obligatoria si es normal, no se registra si es inaccesible
// y es opcional si está dañado.
const ReadingFormSchema = v.variant(
  'condition',
  [
    v.object({
      condition: v.literal('normal'),
      value: RequiredReadingValueSchema,
    }),
    v.object({
      condition: v.literal('inaccessible'),
      inaccessibleReason: noteSchema('El motivo'),
    }),
    v.object({
      condition: v.literal('damaged'),
      damageDescription: noteSchema('La descripción del daño'),
      value: OptionalReadingValueSchema,
    }),
  ],
  'Seleccione el estado del medidor.',
);

export function validateReadingForm(input: ReadingFormInput): ReadingFormResult {
  const result = v.safeParse(ReadingFormSchema, input);
  if (result.success) {
    return { success: true, details: result.output };
  }

  const errors: ReadingFormErrors = {};
  for (const issue of result.issues) {
    const key = issue.path?.[0]?.key;
    const field =
      key === 'value' || key === 'inaccessibleReason' || key === 'damageDescription'
        ? key
        : 'condition';
    errors[field] ??= issue.message;
  }

  return { success: false, errors };
}

export function calculateReadingDifference(value: number, previousReading: number): number {
  return Math.round(value * DECIMAL_SCALE - previousReading * DECIMAL_SCALE) / DECIMAL_SCALE;
}

// HU-006: consumo del mes = lectura actual - lectura anterior; es elevado si supera
// el triple del promedio mensual del medidor.
export function assessConsumption(
  value: number | null,
  previousReading: number,
  monthlyAverageConsumption: number,
): ConsumptionAssessment {
  if (value === null) {
    return { check: 'not-applicable', consumption: null, threshold: null };
  }

  const threshold =
    Math.round(monthlyAverageConsumption * ELEVATED_CONSUMPTION_FACTOR * DECIMAL_SCALE) /
    DECIMAL_SCALE;
  const consumption = calculateReadingDifference(value, previousReading);

  if (consumption < 0) {
    return { check: 'review-required', consumption: null, threshold };
  }

  return { check: consumption > threshold ? 'elevated' : 'normal', consumption, threshold };
}

// HU-007: la foto es obligatoria con consumo elevado o medidor dañado; opcional en los demás casos.
export function isPhotoRequired(
  condition: MeterCondition,
  consumptionCheck: ConsumptionCheck,
): boolean {
  return condition === 'damaged' || consumptionCheck === 'elevated';
}

export function createMeterReading(input: {
  employeeCode: string;
  meterCode: string;
  details: ReadingDetails;
  meter: ReadingMeterContext;
  recordedAt: Date;
  isOnline: boolean;
  meterReviewConfirmed: boolean;
  photoUri: string | null;
}): NewMeterReading {
  if (input.employeeCode.trim() === '') {
    throw new MeterReadingError('La lectura requiere el código del técnico.');
  }

  const meterCode = normalizeMeterCode(input.meterCode);
  if (normalizeMeterCode(input.meter.meterCode) !== meterCode) {
    throw new MeterReadingError('La ficha guardada no corresponde al medidor de la lectura.');
  }

  const { details } = input;
  const value = details.condition === 'inaccessible' ? null : details.value;
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new MeterReadingError('El valor de la lectura no es válido.');
  }

  if (!Number.isFinite(input.recordedAt.getTime())) {
    throw new RangeError('La fecha de registro no es válida.');
  }

  const assessment = assessConsumption(
    value,
    input.meter.lastReading,
    input.meter.monthlyAverageConsumption,
  );
  const isElevated = assessment.check === 'elevated';
  if (isElevated && !input.meterReviewConfirmed) {
    throw new MeterReadingError('Debe confirmar que revisó el medidor de agua.');
  }

  const photoUri = input.photoUri?.trim() || null;
  if (isPhotoRequired(details.condition, assessment.check) && photoUri === null) {
    throw new MeterReadingError(
      isElevated
        ? 'La foto del medidor es obligatoria por consumo elevado.'
        : 'La foto del medidor es obligatoria si el medidor está dañado.',
    );
  }

  const reading: NewMeterReading = {
    employeeCode: input.employeeCode,
    meterCode,
    condition: details.condition,
    value,
    inaccessibleReason: details.condition === 'inaccessible' ? details.inaccessibleReason : null,
    damageDescription: details.condition === 'damaged' ? details.damageDescription : null,
    recordedAt: input.recordedAt.toISOString(),
    previousReading: input.meter.lastReading,
    previousReadingDate: input.meter.lastReadingDate,
    status: value === null ? 'not-applicable' : 'pending-verification',
    difference: null,
    verifiedAt: null,
    monthlyAverageConsumption: input.meter.monthlyAverageConsumption,
    consumption: assessment.consumption,
    consumptionCheck: assessment.check,
    meterReviewConfirmed: isElevated,
    photoUri,
  };

  return input.isOnline ? verifyReading(reading, input.recordedAt) : reading;
}

export function verifyReading<T extends NewMeterReading>(reading: T, now: Date): T {
  if (reading.status !== 'pending-verification' || reading.value === null) {
    return reading;
  }

  return {
    ...reading,
    status: 'verified',
    difference: calculateReadingDifference(reading.value, reading.previousReading),
    verifiedAt: now.toISOString(),
  };
}

export function formatReadingDifference(difference: number): string {
  return difference > 0 ? `+${difference}` : `${difference}`;
}

// HU-010: mes calendario del registro en hora de Ecuador, con formato `YYYY-MM`.
export function getReadingMonth(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('La fecha de registro no es válida.');
  }

  const parts = getDateTimeParts(date);
  return `${parts.year}-${parts.month}`;
}

// HU-010: corrige todos los campos de un registro no enviado. Se recalculan el consumo, el umbral
// y las validaciones con la ficha guardada en el registro; la fecha de registro se conserva.
export function correctMeterReading(
  existing: MeterReading,
  input: {
    details: ReadingDetails;
    meterReviewConfirmed: boolean;
    photoUri: string | null;
    isOnline: boolean;
    correctedAt: Date;
  },
): MeterReading {
  if (existing.syncStatus !== 'pending') {
    throw new MeterReadingError('Un registro enviado no se puede corregir.');
  }

  if (existing.monthlyAverageConsumption === null) {
    throw new MeterReadingError(
      'El registro no tiene el promedio mensual necesario para recalcular el consumo.',
    );
  }

  const recalculated = createMeterReading({
    employeeCode: existing.employeeCode,
    meterCode: existing.meterCode,
    details: input.details,
    meter: {
      meterCode: existing.meterCode,
      lastReading: existing.previousReading,
      lastReadingDate: existing.previousReadingDate,
      monthlyAverageConsumption: existing.monthlyAverageConsumption,
    },
    recordedAt: input.correctedAt,
    isOnline: input.isOnline,
    meterReviewConfirmed: input.meterReviewConfirmed,
    photoUri: input.photoUri,
  });

  return {
    ...existing,
    ...recalculated,
    recordedAt: existing.recordedAt,
    updatedAt: input.correctedAt.toISOString(),
  };
}

export function formatReadingTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('La fecha de registro no es válida.');
  }

  const parts = getDateTimeParts(date);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
