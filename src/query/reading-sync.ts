import type { QueryClient } from '@tanstack/react-query';

import { postReading, ReadingNetworkError } from '@/api/readings';
import { isReadingReadyToSend, toReadingPayload } from '@/domain/reading-sync';
import { listUnsentReadings, markReadingSent } from '@/storage/readings';

export const READING_SYNC_MUTATION_KEY = ['reading-sync'] as const;

// Fallos de red: hasta 3 reintentos esperando 2, 4 y 8 s. Los errores HTTP no se reintentan.
export const SYNC_NETWORK_RETRIES = 3;

export function isNetworkError(error: unknown): boolean {
  return error instanceof ReadingNetworkError;
}

export function shouldRetrySync(failureCount: number, error: unknown): boolean {
  return failureCount < SYNC_NETWORK_RETRIES && isNetworkError(error);
}

export function syncRetryDelay(failureCount: number): number {
  return 2000 * 2 ** failureCount;
}

export function pendingSyncCountQueryKey(employeeCode: string) {
  return ['reading-sync', 'pending-count', employeeCode] as const;
}

// Envía uno a uno los registros pendientes. Ante el primer fallo se detiene: los restantes
// siguen pendientes hasta el próximo intento (reconexión, apertura de la app o nuevo registro).
export async function sendPendingReadings(now: () => Date = () => new Date()): Promise<number> {
  const readings = await listUnsentReadings();
  let sentCount = 0;

  for (const reading of readings) {
    if (!isReadingReadyToSend(reading)) {
      continue;
    }

    await postReading(toReadingPayload(reading));
    sentCount += await markReadingSent(reading.id, now(), reading.updatedAt);
  }

  return sentCount;
}

// HU-009: un único envío a la vez (scope). Al reconectar, la red puede tardar unos segundos en
// resolver el servidor; los fallos de red se reintentan. Sin conexión, la mutación queda en pausa
// y TanStack Query la reanuda al recuperarla. Cada reintento vuelve a leer los pendientes, así que
// no se reenvían los ya marcados.
export function syncPendingReadings(client: QueryClient): Promise<number> {
  return client
    .getMutationCache()
    .build(client, {
      mutationKey: READING_SYNC_MUTATION_KEY,
      mutationFn: () => sendPendingReadings(),
      scope: { id: 'reading-sync' },
      retry: shouldRetrySync,
      retryDelay: syncRetryDelay,
      onSettled: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: ['reading-sync', 'pending-count'] }),
          client.invalidateQueries({ queryKey: ['meter-readings'] }),
        ]);
      },
    })
    .execute(undefined);
}
