import { normalizeMeterCode } from './meter-code';

export type Meter = {
  meterCode: string;
  address: string;
  sector: string;
  accountNumber: string;
  status: string;
  lastReading: number;
  lastReadingDate: string;
  monthlyAverageConsumption: number;
  monthlyAverageConsumptionUnit: string;
};

export type MeterLookupResult =
  | { status: 'found'; meter: Meter }
  | { status: 'not-found' }
  | { status: 'ambiguous' };

export class MeterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeterValidationError';
  }
}

export function parseMeterResults(
  results: unknown,
  requestedMeterCode: string,
): MeterLookupResult {
  if (!Array.isArray(results)) {
    throw new MeterValidationError('La respuesta del medidor no es una colección.');
  }

  if (results.length === 0) {
    return { status: 'not-found' };
  }

  if (results.length > 1) {
    return { status: 'ambiguous' };
  }

  const record = results[0];
  if (!isMeter(record)) {
    throw new MeterValidationError('La respuesta del medidor no cumple el esquema esperado.');
  }

  if (
    normalizeMeterCode(record.meterCode) !== normalizeMeterCode(requestedMeterCode)
  ) {
    throw new MeterValidationError('La respuesta no corresponde al medidor consultado.');
  }

  return { status: 'found', meter: record };
}

export function isValidMeterDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatMeterReadingDate(value: string): string {
  if (!isValidMeterDate(value)) {
    throw new MeterValidationError('La fecha de lectura no es válida.');
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function getCacheExpiry(now: Date): Date {
  if (!Number.isFinite(now.getTime())) {
    throw new RangeError('La fecha de consulta no es válida.');
  }

  const localParts = getDateParts(now);
  const nextDayUtc = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day) + 1,
  );
  let midnightTimestamp = nextDayUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const midnightParts = getDateTimeParts(new Date(midnightTimestamp));
    const representedAsUtc = Date.UTC(
      Number(midnightParts.year),
      Number(midnightParts.month) - 1,
      Number(midnightParts.day),
      Number(midnightParts.hour),
      Number(midnightParts.minute),
      Number(midnightParts.second),
    );
    const correction = nextDayUtc - representedAsUtc;
    midnightTimestamp += correction;

    if (correction === 0) {
      break;
    }
  }

  return new Date(midnightTimestamp);
}

export function isMeter(value: unknown): value is Meter {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.meterCode === 'string' &&
    typeof record.address === 'string' &&
    typeof record.sector === 'string' &&
    typeof record.accountNumber === 'string' &&
    typeof record.status === 'string' &&
    typeof record.lastReading === 'number' &&
    Number.isFinite(record.lastReading) &&
    isValidMeterDate(record.lastReadingDate) &&
    typeof record.monthlyAverageConsumption === 'number' &&
    Number.isFinite(record.monthlyAverageConsumption) &&
    typeof record.monthlyAverageConsumptionUnit === 'string'
  );
}

function getDateParts(date: Date): Record<string, string> {
  return getParts(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date),
  );
}

export function getDateTimeParts(date: Date): Record<string, string> {
  return getParts(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date),
  );
}

function getParts(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}
