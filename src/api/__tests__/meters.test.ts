import { fetchMeter, MeterApiError } from '../meters';
import { MeterValidationError } from '@/domain/meter';

const validMeter = {
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

function createResponse(
  body: unknown,
  options: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('fetchMeter', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  it('consulta por el código normalizado y devuelve la ficha', async () => {
    fetchMock.mockResolvedValue(createResponse([validMeter]));

    await expect(fetchMeter(' med-123456 ')).resolves.toEqual({
      status: 'found',
      meter: validMeter,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://6ad90cb3f89c5702ed9a631a.mockapi.io/medidores?meterCode=MED-123456',
    );
  });

  it('devuelve no encontrado para una colección vacía', async () => {
    fetchMock.mockResolvedValue(createResponse([]));

    await expect(fetchMeter(validMeter.meterCode)).resolves.toEqual({ status: 'not-found' });
  });

  it('devuelve respuesta ambigua para varios registros', async () => {
    fetchMock.mockResolvedValue(createResponse([validMeter, validMeter]));

    await expect(fetchMeter(validMeter.meterCode)).resolves.toEqual({ status: 'ambiguous' });
  });

  it('devuelve no encontrado cuando el filtro responde HTTP 404', async () => {
    fetchMock.mockResolvedValue(createResponse('Not found', { ok: false, status: 404 }));

    await expect(fetchMeter(validMeter.meterCode)).resolves.toEqual({ status: 'not-found' });
  });

  it('rechaza respuestas HTTP fallidas', async () => {
    fetchMock.mockResolvedValue(createResponse(null, { ok: false, status: 503 }));

    await expect(fetchMeter(validMeter.meterCode)).rejects.toThrow(MeterApiError);
  });

  it('propaga errores de red', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchMeter(validMeter.meterCode)).rejects.toThrow('Network request failed');
  });

  it('trata un cuerpo vacío como error de respuesta', async () => {
    const response = createResponse(null);
    jest.mocked(response.json).mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    fetchMock.mockResolvedValue(response);

    await expect(fetchMeter(validMeter.meterCode)).rejects.toThrow(MeterApiError);
  });

  it('rechaza registros que no cumplen el esquema', async () => {
    fetchMock.mockResolvedValue(createResponse([{ ...validMeter, lastReading: '120' }]));

    await expect(fetchMeter(validMeter.meterCode)).rejects.toThrow(MeterValidationError);
  });
});
