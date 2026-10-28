import * as Network from 'expo-network';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { normalizeMeterCode } from '@/domain/meter-code';
import { verifyPendingReadings } from '@/storage/readings';

import { isNetworkStateOnline } from './query-client';
import { syncPendingReadings } from './reading-sync';

const METER_READINGS_QUERY_PREFIX = ['meter-readings'] as const;

export function meterReadingsQueryKey(employeeCode: string, meterCode: string) {
  return [...METER_READINGS_QUERY_PREFIX, employeeCode, normalizeMeterCode(meterCode)] as const;
}

export async function verifyPendingReadingsAndRefresh(client: QueryClient): Promise<void> {
  const verifiedCount = await verifyPendingReadings();
  if (verifiedCount > 0) {
    await client.invalidateQueries({ queryKey: METER_READINGS_QUERY_PREFIX });
  }
}

// HU-004 CA-03 y HU-009: al recuperar la conexión (o al abrir la app con conexión) se comparan las
// lecturas pendientes y después se envían los registros pendientes.
export function setupReadingVerification(client: QueryClient): () => void {
  const verify = () => {
    verifyPendingReadingsAndRefresh(client)
      .catch((error: unknown) => {
        console.error('No se pudieron verificar las lecturas pendientes.', error);
      })
      .then(() => syncPendingReadings(client))
      .catch((error: unknown) => {
        console.error('No se pudieron enviar las lecturas pendientes.', error);
      });
  };

  const unsubscribe = onlineManager.subscribe((isOnline) => {
    if (isOnline) {
      verify();
    }
  });

  Network.getNetworkStateAsync()
    .then((state) => {
      if (isNetworkStateOnline(state)) {
        verify();
      }
    })
    .catch((error: unknown) => {
      console.error('No se pudo determinar la conectividad para verificar lecturas.', error);
    });

  return unsubscribe;
}
