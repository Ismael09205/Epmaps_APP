import { parseMeterResults, type MeterLookupResult } from '@/domain/meter';
import { normalizeMeterCode } from '@/domain/meter-code';

const METERS_ENDPOINT =
  'https://6ad90cb3f89c5702ed9a631a.mockapi.io/api/v1/medidores';

export class MeterApiError extends Error {
  constructor(
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'MeterApiError';
  }
}

export async function fetchMeter(meterCode: string): Promise<MeterLookupResult> {
  const normalizedCode = normalizeMeterCode(meterCode);
  const response = await fetch(
    `${METERS_ENDPOINT}?meterCode=${encodeURIComponent(normalizedCode)}`,
  );

  if (!response.ok) {
    throw new MeterApiError(`La consulta del medidor falló con HTTP ${response.status}.`);
  }

  let results: unknown;
  try {
    results = await response.json();
  } catch (error) {
    throw new MeterApiError('La respuesta del servidor no contiene JSON válido.', error);
  }

  return parseMeterResults(results, normalizedCode);
}
