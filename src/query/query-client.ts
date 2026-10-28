import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {
  onlineManager,
  QueryClient,
  type Query,
} from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { isMeter, type Meter } from '@/domain/meter';
import { normalizeMeterCode } from '@/domain/meter-code';

const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const PERSISTED_CACHE_KEY = 'epmaps-meter-query-cache';
const METER_CACHE_QUERY_PREFIX = ['meter-cache'] as const;

export type MeterCacheEntry = {
  meter: Meter;
  expiresAt: number;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE,
      retry: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSISTED_CACHE_KEY,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: CACHE_MAX_AGE,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.queryKey[0] === METER_CACHE_QUERY_PREFIX[0] && query.state.data !== undefined,
  },
};

export function meterCacheQueryKey(employeeCode: string, meterCode: string) {
  return [
    ...METER_CACHE_QUERY_PREFIX,
    employeeCode,
    normalizeMeterCode(meterCode),
  ] as const;
}

export function pruneExpiredMeterCache(
  client: QueryClient,
  now: Date = new Date(),
): void {
  const nowTimestamp = now.getTime();

  for (const query of client.getQueryCache().findAll({ queryKey: METER_CACHE_QUERY_PREFIX })) {
    if (!isMeterCacheEntry(query.state.data) || query.state.data.expiresAt <= nowTimestamp) {
      client.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  }
}

export function isNetworkStateOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function setupNetworkManager(): void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isNetworkStateOnline(state));
    });

    Network.getNetworkStateAsync()
      .then((state) => {
        setOnline(isNetworkStateOnline(state));
      })
      .catch((error: unknown) => {
        console.error('No se pudo determinar la conectividad inicial.', error);
        setOnline(false);
      });

    return () => subscription.remove();
  });
}

function isMeterCacheEntry(value: unknown): value is MeterCacheEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.expiresAt === 'number' &&
    Number.isFinite(entry.expiresAt) &&
    isMeter(entry.meter)
  );
}
