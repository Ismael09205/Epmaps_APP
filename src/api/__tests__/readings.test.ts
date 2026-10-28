import { postReading, ReadingApiError, ReadingNetworkError } from '../readings';
import type { ReadingPayload } from '@/domain/reading-sync';

const payload = {
  readingId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  employeeCode: 'EPM-1001',
  meterCode: 'MED-123456',
} as ReadingPayload;

describe('postReading', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  afterEach(() => fetchMock.mockReset());

  it('envía la lectura con su UUID como clave de idempotencia', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 } as Response);

    await postReading(payload);

    expect(fetchMock).toHaveBeenCalledWith('https://6ad90cb3f89c5702ed9a631a.mockapi.io/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': payload.readingId,
      },
      body: JSON.stringify(payload),
    });
  });

  it('falla si el servidor no confirma el envío', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(postReading(payload)).rejects.toThrow(ReadingApiError);
  });

  it('distingue la falta de acceso al servidor de un error HTTP', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed: No address associated with hostname'));

    await expect(postReading(payload)).rejects.toThrow(ReadingNetworkError);
  });
});
