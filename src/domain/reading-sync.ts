import { isPhotoRequired, validateReadingForm, type MeterReading } from './reading';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Datos enviados a la oficina. La foto se conserva solo en el teléfono y no se envía.
export type ReadingPayload = {
  readingId: string;
  employeeCode: string;
  meterCode: string;
  condition: MeterReading['condition'];
  value: number | null;
  inaccessibleReason: string | null;
  damageDescription: string | null;
  recordedAt: string;
  previousReading: number;
  previousReadingDate: string;
  verificationStatus: MeterReading['status'];
  difference: number | null;
  monthlyAverageConsumption: number | null;
  consumption: number | null;
  consumptionCheck: MeterReading['consumptionCheck'];
  meterReviewConfirmed: boolean;
};

// HU-009: solo se envían registros completos que cumplen las validaciones de su estado.
export function isReadingReadyToSend(reading: MeterReading): boolean {
  if (reading.syncStatus !== 'pending' || !UUID_PATTERN.test(reading.readingUuid)) {
    return false;
  }

  const form = validateReadingForm({
    condition: reading.condition,
    value: reading.value === null ? '' : String(reading.value),
    inaccessibleReason: reading.inaccessibleReason ?? '',
    damageDescription: reading.damageDescription ?? '',
  });
  if (!form.success) {
    return false;
  }

  if (reading.consumptionCheck === 'elevated' && !reading.meterReviewConfirmed) {
    return false;
  }

  return !isPhotoRequired(reading.condition, reading.consumptionCheck) || reading.photoUri !== null;
}

export function toReadingPayload(reading: MeterReading): ReadingPayload {
  return {
    readingId: reading.readingUuid,
    employeeCode: reading.employeeCode,
    meterCode: reading.meterCode,
    condition: reading.condition,
    value: reading.value,
    inaccessibleReason: reading.inaccessibleReason,
    damageDescription: reading.damageDescription,
    recordedAt: reading.recordedAt,
    previousReading: reading.previousReading,
    previousReadingDate: reading.previousReadingDate,
    verificationStatus: reading.status,
    difference: reading.difference,
    monthlyAverageConsumption: reading.monthlyAverageConsumption,
    consumption: reading.consumption,
    consumptionCheck: reading.consumptionCheck,
    meterReviewConfirmed: reading.meterReviewConfirmed,
  };
}
