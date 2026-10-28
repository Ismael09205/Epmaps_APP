jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/storage/readings', () => ({
  verifyPendingReadings: jest.fn(),
}));

jest.mock('../reading-sync', () => ({
  syncPendingReadings: jest.fn().mockResolvedValue(0),
}));

import * as Network from 'expo-network';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { verifyPendingReadings } from '@/storage/readings';

import { meterReadingsQueryKey, setupReadingVerification } from '../reading-verification';
import { syncPendingReadings } from '../reading-sync';

const mockedVerifyPendingReadings = verifyPendingReadings as jest.Mock;

function flushPromises() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe('reading verification', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    mockedVerifyPendingReadings.mockReset().mockResolvedValue(1);
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    cleanup?.();
    jest.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  it('separa las lecturas por técnico y código normalizado', () => {
    expect(meterReadingsQueryKey('EPM-1001', ' med-123456 ')).toEqual([
      'meter-readings',
      'EPM-1001',
      'MED-123456',
    ]);
  });

  it('CA-03: verifica las pendientes al recuperar la conexión y refresca las lecturas', async () => {
    jest
      .spyOn(Network, 'getNetworkStateAsync')
      .mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    cleanup = setupReadingVerification(client);
    await flushPromises();

    expect(mockedVerifyPendingReadings).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await flushPromises();

    expect(mockedVerifyPendingReadings).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['meter-readings'] });
    // HU-009 CA-01: tras verificar, se envían los registros pendientes.
    expect(syncPendingReadings).toHaveBeenCalledWith(client);
  });

  it('verifica las pendientes al iniciar si ya hay conexión', async () => {
    jest
      .spyOn(Network, 'getNetworkStateAsync')
      .mockResolvedValue({ isConnected: true, isInternetReachable: true });
    cleanup = setupReadingVerification(new QueryClient());
    await flushPromises();

    expect(mockedVerifyPendingReadings).toHaveBeenCalledTimes(1);
  });

  it('no verifica al perder la conexión', async () => {
    jest
      .spyOn(Network, 'getNetworkStateAsync')
      .mockResolvedValue({ isConnected: false, isInternetReachable: false });
    onlineManager.setOnline(true);
    cleanup = setupReadingVerification(new QueryClient());

    onlineManager.setOnline(false);
    await flushPromises();

    expect(mockedVerifyPendingReadings).not.toHaveBeenCalled();
  });
});
