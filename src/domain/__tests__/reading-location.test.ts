import {
  assessLocationQuality,
  describeLocationChange,
  describeLocationMargin,
  isLowAccuracy,
  isValidReadingLocation,
  requireReadingLocation,
  type ReadingLocation,
} from '../reading-location';

const gps: ReadingLocation = {
  latitude: -0.180653,
  longitude: -78.467834,
  accuracy: 8,
  source: 'gps',
  capturedAt: '2026-10-27T15:29:00.000Z',
};

describe('ubicación de la lectura', () => {
  it('valida coordenadas, precisión, origen y fecha', () => {
    expect(isValidReadingLocation(gps)).toBe(true);
    expect(isValidReadingLocation({ ...gps, longitude: -181 })).toBe(false);
    expect(isValidReadingLocation({ ...gps, latitude: Number.NaN })).toBe(false);
    expect(isValidReadingLocation({ ...gps, accuracy: -1 })).toBe(false);
    expect(isValidReadingLocation({ ...gps, source: 'wifi' })).toBe(false);
    expect(isValidReadingLocation({ ...gps, capturedAt: 'ayer' })).toBe(false);
    expect(isValidReadingLocation(null)).toBe(false);
  });

  it('exige la ubicación', () => {
    expect(() => requireReadingLocation(null)).toThrow('Registre la ubicación del medidor.');
    expect(requireReadingLocation(gps)).toBe(gps);
  });

  it('advierte la precisión baja del GPS sin bloquear la ubicación manual', () => {
    expect(isLowAccuracy(gps)).toBe(false);
    expect(isLowAccuracy({ ...gps, accuracy: 31 })).toBe(true);
    expect(isLowAccuracy({ ...gps, accuracy: null })).toBe(true);
    expect(isLowAccuracy({ ...gps, accuracy: null, source: 'manual' })).toBe(false);
  });

  it('registra el cambio solo si la ubicación es distinta', () => {
    const changedAt = new Date('2026-10-28T13:00:00.000Z');
    const manual: ReadingLocation = { ...gps, latitude: -0.1811, accuracy: null, source: 'manual' };

    expect(describeLocationChange(gps, { ...gps }, changedAt)).toBeNull();
    expect(describeLocationChange(gps, manual, changedAt)).toEqual({
      previous: gps,
      next: manual,
      changedAt: '2026-10-28T13:00:00.000Z',
    });
    expect(describeLocationChange(null, gps, changedAt)).toEqual({
      previous: null,
      next: gps,
      changedAt: '2026-10-28T13:00:00.000Z',
    });
  });

  it('clasifica la precisión del GPS', () => {
    expect(assessLocationQuality(gps)).toBe('high');
    expect(assessLocationQuality({ ...gps, accuracy: 10 })).toBe('high');
    expect(assessLocationQuality({ ...gps, accuracy: 25 })).toBe('medium');
    expect(assessLocationQuality({ ...gps, accuracy: 31 })).toBe('low');
    expect(assessLocationQuality({ ...gps, accuracy: null })).toBe('unknown');
    expect(assessLocationQuality({ ...gps, source: 'manual', accuracy: null })).toBeNull();
  });

  it('explica el margen de error de la ubicación', () => {
    expect(describeLocationMargin({ ...gps, accuracy: 7.6 })).toBe(
      'El punto puede desviarse hasta 8 m del lugar real.',
    );
    expect(describeLocationMargin({ ...gps, accuracy: null })).toBe(
      'El GPS no informó su margen de error.',
    );
    expect(describeLocationMargin({ ...gps, source: 'manual', accuracy: null })).toContain(
      'Ajustada por el técnico en el mapa',
    );
  });
});
