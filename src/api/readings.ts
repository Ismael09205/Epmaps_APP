import type { ReadingPayload } from '@/domain/reading-sync';

const READINGS_ENDPOINT = 'https://6ad90cb3f89c5702ed9a631a.mockapi.io/logs';

export class ReadingApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadingApiError';
  }
}

// El servidor no fue alcanzable (sin red o sin resolver el nombre del servidor).
export class ReadingNetworkError extends Error {
  constructor(readonly originalError: unknown) {
    super('No se pudo conectar con el servidor de lecturas.');
    this.name = 'ReadingNetworkError';
  }
}

// HU-009: el UUID del registro identifica el envío; el servidor garantiza la idempotencia.
export async function postReading(payload: ReadingPayload): Promise<void> {
  let response: Response;
  try {
    response = await fetch(READINGS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': payload.readingId,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ReadingNetworkError(error);
  }

  if (!response.ok) {
    throw new ReadingApiError(`El envío de la lectura falló con HTTP ${response.status}.`);
  }
}
