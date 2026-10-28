import {
  formatMeterReadingDate,
  getCacheExpiry,
  isValidMeterDate,
  MeterValidationError,
  parseMeterResults,
} from '../meter';

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

describe('parseMeterResults', () => {
  it('clasifica una colección vacía como medidor no encontrado', () => {
    expect(parseMeterResults([], validMeter.meterCode)).toEqual({ status: 'not-found' });
  });

  it('clasifica varias coincidencias como respuesta ambigua', () => {
    expect(parseMeterResults([validMeter, validMeter], validMeter.meterCode)).toEqual({
      status: 'ambiguous',
    });
  });

  it('devuelve una ficha válida que coincide con el código consultado', () => {
    expect(parseMeterResults([validMeter], ' med-123456 ')).toEqual({
      status: 'found',
      meter: validMeter,
    });
  });

  it('rechaza una respuesta que no es una colección', () => {
    expect(() => parseMeterResults(null, validMeter.meterCode)).toThrow(MeterValidationError);
  });

  it.each([
    ['address', undefined],
    ['sector', 2],
    ['accountNumber', null],
    ['status', false],
    ['lastReading', '120'],
    ['monthlyAverageConsumption', Number.NaN],
    ['monthlyAverageConsumptionUnit', undefined],
  ])('rechaza un campo faltante o con tipo inválido: %s', (field, value) => {
    const invalidMeter = { ...validMeter, [field]: value };

    expect(() => parseMeterResults([invalidMeter], validMeter.meterCode)).toThrow(
      MeterValidationError,
    );
  });

  it('rechaza una fecha inválida', () => {
    expect(() =>
      parseMeterResults([{ ...validMeter, lastReadingDate: '2025-02-29' }], validMeter.meterCode),
    ).toThrow(MeterValidationError);
  });

  it('rechaza una ficha asociada a otro código', () => {
    expect(() =>
      parseMeterResults([validMeter], 'MED-654321'),
    ).toThrow(MeterValidationError);
  });
});

describe('meter date formatting', () => {
  it.each([
    ['2025-01-14', true],
    ['2024-02-29', true],
    ['2025-02-29', false],
    ['2025-13-01', false],
    ['14/01/2025', false],
  ])('validates %s', (date, isValid) => {
    expect(isValidMeterDate(date)).toBe(isValid);
  });

  it('formats the reading date as dd/MM/yyyy', () => {
    expect(formatMeterReadingDate('2025-01-14')).toBe('14/01/2025');
  });

  it('rejects formatting an invalid date', () => {
    expect(() => formatMeterReadingDate('2025-02-29')).toThrow(MeterValidationError);
  });
});

describe('getCacheExpiry', () => {
  it('expires at the next midnight in Ecuador before midnight', () => {
    expect(getCacheExpiry(new Date('2025-01-15T04:59:59.000Z'))).toEqual(
      new Date('2025-01-15T05:00:00.000Z'),
    );
  });

  it('uses the following day after Ecuador midnight', () => {
    expect(getCacheExpiry(new Date('2025-01-15T05:00:00.000Z'))).toEqual(
      new Date('2025-01-16T05:00:00.000Z'),
    );
  });
});
