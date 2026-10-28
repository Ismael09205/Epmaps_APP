jest.mock('@/storage/readings', () => ({
  listUnsentReadings: jest.fn(),
  markReadingSent: jest.fn(),
}));

jest.mock('@/api/readings', () => ({
  ...jest.requireActual('@/api/readings'),
  postReading: jest.fn(),
}));

import { postReading, ReadingNetworkError } from '@/api/readings';
import type { MeterReading } from '@/domain/reading';
import { listUnsentReadings, markReadingSent } from '@/storage/readings';

import { sendPendingReadings, shouldRetrySync, syncRetryDelay } from '../reading-sync';

const mockedList = listUnsentReadings as jest.Mock;
const mockedMarkSent = markReadingSent as jest.Mock;
const mockedPost = postReading as jest.Mock;

const reading: MeterReading = {
  id: 3,
  employeeCode: 'EPM-1001',
  meterCode: 'MED-123456',
  condition: 'normal',
  value: 125.5,
  inaccessibleReason: null,
  damageDescription: null,
  recordedAt: '2026-10-27T15:30:00.000Z',
  previousReading: 120,
  previousReadingDate: '2025-01-14',
  status: 'verified',
  difference: 5.5,
  verifiedAt: '2026-10-27T15:30:00.000Z',
  monthlyAverageConsumption: 18.5,
  consumption: 5.5,
  consumptionCheck: 'normal',
  meterReviewConfirmed: false,
  photoUri: null,
  readingUuid: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  syncStatus: 'pending',
  sentAt: null,
  updatedAt: null,
};
const second = { ...reading, id: 4, readingUuid: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' };
const now = new Date('2026-10-28T13:00:00.000Z');

beforeEach(() => {
  mockedList.mockReset();
  mockedMarkSent.mockReset().mockResolvedValue(1);
  mockedPost.mockReset().mockResolvedValue(undefined);
});

describe('política de reintentos', () => {
  it('reintenta hasta 3 veces solo los fallos de red, esperando 2, 4 y 8 s', () => {
    const networkError = new ReadingNetworkError(new Error('fetch failed'));

    expect([0, 1, 2, 3].map((count) => shouldRetrySync(count, networkError))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(shouldRetrySync(0, new Error('HTTP 500'))).toBe(false);
    expect([0, 1, 2].map(syncRetryDelay)).toEqual([2000, 4000, 8000]);
  });
});

describe('sendPendingReadings', () => {
  it('CA-01: envía los registros pendientes y los marca como enviados', async () => {
    mockedList.mockResolvedValue([reading, second]);

    await expect(sendPendingReadings(() => now)).resolves.toBe(2);

    expect(mockedPost).toHaveBeenNthCalledWith(1, expect.objectContaining({ readingId: reading.readingUuid }));
    expect(mockedMarkSent).toHaveBeenCalledWith(3, now, null);
    expect(mockedMarkSent).toHaveBeenCalledWith(4, now, null);
  });

  it('CA-02: si la señal se corta, no marca el registro y lo reenvía con el mismo UUID', async () => {
    mockedList.mockResolvedValue([reading, second]);
    mockedPost.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(sendPendingReadings(() => now)).rejects.toThrow('Network request failed');
    expect(mockedMarkSent).not.toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalledTimes(1);

    await sendPendingReadings(() => now);
    expect(mockedPost).toHaveBeenNthCalledWith(2, expect.objectContaining({ readingId: reading.readingUuid }));
  });

  it('no envía registros que no cumplen sus validaciones', async () => {
    mockedList.mockResolvedValue([{ ...reading, value: null }]);

    await expect(sendPendingReadings(() => now)).resolves.toBe(0);
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
