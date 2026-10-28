jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import * as Network from 'expo-network';
import { dehydrate, hydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import {
  meterCacheQueryKey,
  persistOptions,
  pruneExpiredMeterCache,
  setupNetworkManager,
} from '../query-client';

const meter = {
  meterCode: 'MED-123456',
  address: 'Av. Amazonas 123',
  sector: 'Centro',
  accountNumber: '001234',
  status: 'Activo',
  lastReading: 120,
  lastReadingDate: '2025-01-14',
  monthlyAverageConsumption: 18.5,
  monthlyAverageConsumptionUnit: 'm³',
};

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}

describe('meter query cache', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    onlineManager.setEventListener(() => undefined);
    onlineManager.setOnline(true);
  });

  it('isolates cached data by technician and normalized meter code', () => {
    expect(meterCacheQueryKey('EPM-1001', ' med-123456 ')).toEqual([
      'meter-cache',
      'EPM-1001',
      'MED-123456',
    ]);
    expect(meterCacheQueryKey('EPM-1001', 'MED-123456')).not.toEqual(
      meterCacheQueryKey('EPM-1002', 'MED-123456'),
    );
  });

  it('removes expired entries and preserves entries that are still valid', () => {
    const client = new QueryClient();
    const now = new Date('2025-01-15T05:00:00.000Z');
    const expiredKey = meterCacheQueryKey('EPM-1001', 'MED-123456');
    const validKey = meterCacheQueryKey('EPM-1001', 'MED-654321');

    client.setQueryData(expiredKey, { meter, expiresAt: now.getTime() - 1 });
    client.setQueryData(validKey, { meter, expiresAt: now.getTime() + 1 });

    pruneExpiredMeterCache(client, now);

    expect(client.getQueryData(expiredKey)).toBeUndefined();
    expect(client.getQueryData(validKey)).toEqual({
      meter,
      expiresAt: now.getTime() + 1,
    });
    client.clear();
  });

  it('restores persisted cache data into a new QueryClient', async () => {
    const storage = createMemoryStorage();
    const persister = createAsyncStoragePersister({
      storage,
      key: 'meter-query-cache-test',
      throttleTime: 0,
    });
    const originalClient = new QueryClient();
    const key = meterCacheQueryKey('EPM-1001', 'MED-123456');
    const data = { meter, expiresAt: Date.now() + 60_000 };
    originalClient.setQueryData(key, data);
    originalClient.setQueryData(['meter-lookup', 'EPM-1001', 'MED-123456'], {
      status: 'found',
      meter,
    });

    await persister.persistClient({
      timestamp: Date.now(),
      buster: '',
      clientState: dehydrate(originalClient, persistOptions.dehydrateOptions),
    });

    const restored = await createAsyncStoragePersister({
      storage,
      key: 'meter-query-cache-test',
      throttleTime: 0,
    }).restoreClient();
    const restoredClient = new QueryClient();

    if (!restored) {
      throw new Error('No se restauró la caché persistida.');
    }

    hydrate(restoredClient, restored.clientState);
    expect(restoredClient.getQueryData(key)).toEqual(data);
    expect(restoredClient.getQueryCache().getAll()).toHaveLength(1);
    originalClient.clear();
    restoredClient.clear();
  });

  it('resumes a paused query when connectivity returns', async () => {
    const addListener = jest.spyOn(Network, 'addNetworkStateListener');
    const getNetworkState = jest.spyOn(Network, 'getNetworkStateAsync');
    let emitNetworkState: ((state: Network.NetworkState) => void) | undefined;

    addListener.mockImplementation((listener) => {
      emitNetworkState = listener;
      return { remove: jest.fn() };
    });
    getNetworkState.mockReturnValue(new Promise(() => {}));
    setupNetworkManager();
    onlineManager.setOnline(false);

    const client = new QueryClient();
    client.mount();
    const queryFn = jest.fn().mockResolvedValue('respuesta');
    const result = client.fetchQuery({
      queryKey: ['network-test'],
      queryFn,
      networkMode: 'online',
      retry: false,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(queryFn).not.toHaveBeenCalled();

    if (!emitNetworkState) {
      throw new Error('No se registró el listener de conectividad.');
    }

    emitNetworkState({ isConnected: true, isInternetReachable: true });

    expect(onlineManager.isOnline()).toBe(true);
    await expect(result).resolves.toBe('respuesta');
    expect(queryFn).toHaveBeenCalledTimes(1);

    client.unmount();
    client.clear();
  });
});
