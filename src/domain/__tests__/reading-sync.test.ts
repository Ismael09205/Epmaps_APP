import type { MeterReading } from '../reading';
import { isReadingReadyToSend, toReadingPayload } from '../reading-sync';

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
  photoUri: 'file:///documents/reading-photos/MED-123456-1.jpg',
  readingUuid: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  syncStatus: 'pending',
  sentAt: null,
  updatedAt: null,
};

describe('isReadingReadyToSend', () => {
  it('acepta registros completos normal, inaccesible y dañado', () => {
    expect(isReadingReadyToSend(reading)).toBe(true);
    expect(
      isReadingReadyToSend({
        ...reading,
        condition: 'inaccessible',
        value: null,
        inaccessibleReason: 'Portón cerrado',
        status: 'not-applicable',
        consumptionCheck: 'not-applicable',
      }),
    ).toBe(true);
    expect(
      isReadingReadyToSend({ ...reading, condition: 'damaged', damageDescription: 'Vidrio roto' }),
    ).toBe(true);
  });

  it.each([
    ['ya enviado', { syncStatus: 'sent' as const }],
    ['sin UUID válido', { readingUuid: '' }],
    ['normal sin lectura', { value: null }],
    ['inaccesible sin motivo', { condition: 'inaccessible' as const, value: null }],
    ['dañado sin foto', { condition: 'damaged' as const, damageDescription: 'Vidrio roto', photoUri: null }],
    ['consumo elevado sin confirmación', { consumptionCheck: 'elevated' as const }],
  ])('no envía un registro %s', (_case, changes) => {
    expect(isReadingReadyToSend({ ...reading, ...changes })).toBe(false);
  });
});

describe('toReadingPayload', () => {
  it('envía el UUID del registro y no incluye la foto', () => {
    const payload = toReadingPayload(reading);

    expect(payload.readingId).toBe(reading.readingUuid);
    expect(payload).not.toHaveProperty('photoUri');
    expect(JSON.stringify(payload)).not.toContain('file://');
  });
});
