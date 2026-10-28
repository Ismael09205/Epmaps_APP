import type { QueryClient } from '@tanstack/react-query';

import { postReading } from '@/api/readings';
import { isReadingReadyToSend, toReadingPayload } from '@/domain/reading-sync';
import { listUnsentReadings, markReadingSent } from '@/storage/readings';

export const READING_SYNC_MUTATION_KEY = ['reading-sync'] as const;

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

// HU-009: un único envío a la vez (scope) y sin reintentos automáticos. Sin conexión, la mutación
// queda en pausa y TanStack Query la reanuda al recuperarla.
export function syncPendingReadings(client: QueryClient): Promise<number> {
  return client
    .getMutationCache()
    .build(client, {
      mutationKey: READING_SYNC_MUTATION_KEY,
      mutationFn: () => sendPendingReadings(),
      scope: { id: 'reading-sync' },
      retry: false,
      onSettled: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: ['reading-sync', 'pending-count'] }),
          client.invalidateQueries({ queryKey: ['meter-readings'] }),
        ]);
      },
    })
    .execute(undefined);
}
