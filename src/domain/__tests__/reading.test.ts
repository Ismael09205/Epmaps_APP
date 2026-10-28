import {
  describeReadingDifference,
  assessConsumption,
  correctMeterReading,
  getReadingMonth,
  isPhotoRequired,
  calculateReadingDifference,
  createMeterReading,
  formatReadingDifference,
  formatReadingTimestamp,
  MeterReadingError,
  parseReadingValue,
  validateReadingForm,
  verifyReading,
} from '../reading';

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

const recordedAt = new Date('2026-10-27T15:30:00.000Z');

const emptyForm = {
  condition: null,
  value: '',
  inaccessibleReason: '',
  damageDescription: '',
};

describe('parseReadingValue', () => {
  it.each([
    ['0', 0],
    ['125', 125],
    ['12345', 12345],
    ['125.5', 125.5],
    ['125,75', 125.75],
    ['12345.6789', 12345.6789],
    [' 7.0001 ', 7.0001],
  ])('acepta %p como lectura decimal válida', (text, value) => {
    expect(parseReadingValue(text)).toEqual({ status: 'valid', value });
  });

  it('rechaza el campo vacío', () => {
    expect(parseReadingValue('  ')).toEqual({ status: 'empty' });
  });

  it('rechaza valores negativos', () => {
    expect(parseReadingValue('-5')).toEqual({ status: 'negative' });
  });

  it('rechaza más de cinco dígitos enteros', () => {
    expect(parseReadingValue('123456')).toEqual({ status: 'integer-too-long' });
  });

  it('rechaza más de cuatro decimales', () => {
    expect(parseReadingValue('1.23456')).toEqual({ status: 'decimals-too-long' });
  });

  it.each(['abc', '1.2.3', '.5', '5.', '1e3', '12 3'])('rechaza el formato %p', (text) => {
    expect(parseReadingValue(text)).toEqual({ status: 'invalid' });
  });
});

describe('validateReadingForm', () => {
  it('CA-01: exige que el técnico elija el estado del medidor', () => {
    expect(validateReadingForm({ ...emptyForm, value: '125' })).toEqual({
      success: false,
      errors: { condition: 'Seleccione el estado del medidor.' },
    });
  });

  it('CA-02: con estado normal la lectura es obligatoria', () => {
    expect(validateReadingForm({ ...emptyForm, condition: 'normal' })).toEqual({
      success: false,
      errors: { value: 'Ingrese la lectura del medidor.' },
    });
    expect(validateReadingForm({ ...emptyForm, condition: 'normal', value: '125,5' })).toEqual({
      success: true,
      details: { condition: 'normal', value: 125.5 },
    });
  });

  it('con estado normal aplica las validaciones de la lectura', () => {
    expect(validateReadingForm({ ...emptyForm, condition: 'normal', value: '-1' })).toEqual({
      success: false,
      errors: { value: 'La lectura no puede ser negativa.' },
    });
  });

  it('CA-03: con estado inaccesible el motivo es obligatorio', () => {
    expect(validateReadingForm({ ...emptyForm, condition: 'inaccessible' })).toEqual({
      success: false,
      errors: { inaccessibleReason: 'El motivo debe tener al menos 10 caracteres.' },
    });
  });

  it('CA-03: con estado inaccesible no registra la lectura aunque se haya escrito', () => {
    expect(
      validateReadingForm({
        ...emptyForm,
        condition: 'inaccessible',
        value: '125',
        inaccessibleReason: '  Portón cerrado, sin acceso  ',
      }),
    ).toEqual({
      success: true,
      details: { condition: 'inaccessible', inaccessibleReason: 'Portón cerrado, sin acceso' },
    });
  });

  it('CA-04: con estado dañado la descripción es obligatoria', () => {
    expect(validateReadingForm({ ...emptyForm, condition: 'damaged', value: '125' })).toEqual({
      success: false,
      errors: { damageDescription: 'La descripción del daño debe tener al menos 10 caracteres.' },
    });
  });

  it('CA-04: con estado dañado la lectura es opcional, pero si se ingresa debe ser válida', () => {
    const damaged = { ...emptyForm, condition: 'damaged' as const, damageDescription: 'Vidrio roto' };

    expect(validateReadingForm(damaged)).toEqual({
      success: true,
      details: { condition: 'damaged', damageDescription: 'Vidrio roto', value: null },
    });
    expect(validateReadingForm({ ...damaged, value: '98.25' })).toEqual({
      success: true,
      details: { condition: 'damaged', damageDescription: 'Vidrio roto', value: 98.25 },
    });
    expect(validateReadingForm({ ...damaged, value: '123456' })).toEqual({
      success: false,
      errors: { value: 'La lectura admite hasta 5 dígitos enteros.' },
    });
  });

  it.each([
    ['menos de 10 caracteres', 'Corto', 'El motivo debe tener al menos 10 caracteres.'],
    ['más de 100 caracteres', 'a'.repeat(101), 'El motivo admite hasta 100 caracteres.'],
    [
      'caracteres especiales',
      'Perro bravo #2 @ casa',
      'El motivo solo admite letras, números, espacios, coma, punto y guion.',
    ],
  ])('rechaza un motivo con %s', (_case, inaccessibleReason, message) => {
    expect(
      validateReadingForm({ ...emptyForm, condition: 'inaccessible', inaccessibleReason }),
    ).toEqual({ success: false, errors: { inaccessibleReason: message } });
  });

  it('acepta textos de 10 y 100 caracteres con tildes, ñ, coma, punto y guion', () => {
    for (const text of ['Ñandú-roto', `Daño, vidrio. ${'a'.repeat(86)}`]) {
      expect(
        validateReadingForm({ ...emptyForm, condition: 'damaged', damageDescription: text }),
      ).toMatchObject({ success: true });
    }
  });

  it('aplica la misma restricción de caracteres a la descripción del daño', () => {
    expect(
      validateReadingForm({
        ...emptyForm,
        condition: 'damaged',
        damageDescription: 'Medidor roto / fuga',
      }),
    ).toEqual({
      success: false,
      errors: {
        damageDescription:
          'La descripción del daño solo admite letras, números, espacios, coma, punto y guion.',
      },
    });
  });
});

describe('calculateReadingDifference', () => {
  it('calcula la diferencia sin errores de coma flotante', () => {
    expect(calculateReadingDifference(12345.6789, 12000.1)).toBe(345.5789);
    expect(calculateReadingDifference(0.3, 0.1)).toBe(0.2);
  });

  it('devuelve una diferencia negativa si la lectura es menor que la anterior', () => {
    expect(calculateReadingDifference(100, 120)).toBe(-20);
  });
});

describe('assessConsumption', () => {
  it('CA-01: calcula el consumo del mes como lectura actual menos la anterior', () => {
    expect(assessConsumption(125.5, 120, 18.5)).toEqual({
      check: 'normal',
      consumption: 5.5,
      threshold: 55.5,
    });
  });

  it('CA-02: marca como elevado el consumo que supera el triple del promedio', () => {
    expect(assessConsumption(175.6, 120, 18.5)).toEqual({
      check: 'elevated',
      consumption: 55.6,
      threshold: 55.5,
    });
  });

  it('no marca como elevado el consumo igual al triple del promedio', () => {
    expect(assessConsumption(175.5, 120, 18.5)).toMatchObject({ check: 'normal' });
  });

  it('marca para revisión, sin consumo válido, una lectura menor que la anterior', () => {
    expect(assessConsumption(110, 120, 18.5)).toEqual({
      check: 'review-required',
      consumption: null,
      threshold: 55.5,
    });
  });

  it('no evalúa el consumo de un registro sin lectura', () => {
    expect(assessConsumption(null, 120, 18.5)).toEqual({
      check: 'not-applicable',
      consumption: null,
      threshold: null,
    });
  });
});

describe('isPhotoRequired', () => {
  it.each([
    ['damaged', 'not-applicable', true],
    ['damaged', 'normal', true],
    ['normal', 'elevated', true],
    ['damaged', 'elevated', true],
    ['normal', 'normal', false],
    ['normal', 'review-required', false],
    ['inaccessible', 'not-applicable', false],
  ] as const)('%s con consumo %s → %p', (condition, check, required) => {
    expect(isPhotoRequired(condition, check)).toBe(required);
  });
});

describe('createMeterReading con consumo elevado', () => {
  const elevated = {
    employeeCode: 'EPM-1001',
    meterCode: 'MED-123456',
    meter,
    recordedAt,
    isOnline: false,
    details: { condition: 'normal' as const, value: 200 },
  };
  const photoUri = 'file:///documents/reading-photos/MED-123456-1.jpg';

  it('CA-03: exige confirmar que se revisó el medidor', () => {
    expect(() =>
      createMeterReading({ ...elevated, meterReviewConfirmed: false, photoUri }),
    ).toThrow('Debe confirmar que revisó el medidor de agua.');
  });

  it('CA-04: exige la foto del medidor', () => {
    expect(() =>
      createMeterReading({ ...elevated, meterReviewConfirmed: true, photoUri: null }),
    ).toThrow('La foto del medidor es obligatoria por consumo elevado.');
    expect(() =>
      createMeterReading({ ...elevated, meterReviewConfirmed: true, photoUri: '  ' }),
    ).toThrow(MeterReadingError);
  });

  it('guarda el consumo, la confirmación y la foto asociados al registro', () => {
    expect(
      createMeterReading({ ...elevated, meterReviewConfirmed: true, photoUri }),
    ).toMatchObject({
      meterCode: 'MED-123456',
      value: 200,
      monthlyAverageConsumption: 18.5,
      consumption: 80,
      consumptionCheck: 'elevated',
      meterReviewConfirmed: true,
      photoUri,
      status: 'pending-verification',
    });
  });

  it('aplica la regla a un medidor dañado con lectura', () => {
    const damaged = {
      ...elevated,
      details: { condition: 'damaged' as const, damageDescription: 'Vidrio roto', value: 200 },
    };

    expect(() =>
      createMeterReading({ ...damaged, meterReviewConfirmed: false, photoUri: null }),
    ).toThrow(MeterReadingError);
    expect(
      createMeterReading({ ...damaged, meterReviewConfirmed: true, photoUri }),
    ).toMatchObject({ consumptionCheck: 'elevated', photoUri });
  });

  it('no exige confirmación si el consumo no es elevado y conserva la foto opcional', () => {
    expect(
      createMeterReading({
        ...elevated,
        details: { condition: 'normal', value: 130 },
        meterReviewConfirmed: true,
        photoUri,
      }),
    ).toMatchObject({ consumptionCheck: 'normal', meterReviewConfirmed: false, photoUri });
  });

  it('HU-007 CA-01: exige la foto si el medidor está dañado, con o sin lectura', () => {
    for (const value of [null, 130]) {
      expect(() =>
        createMeterReading({
          ...elevated,
          details: { condition: 'damaged', damageDescription: 'Vidrio roto', value },
          meterReviewConfirmed: false,
          photoUri: null,
        }),
      ).toThrow('La foto del medidor es obligatoria si el medidor está dañado.');
    }
  });

  it('HU-007 CA-02: la foto es opcional en un medidor normal o inaccesible', () => {
    const optional = { ...elevated, meterReviewConfirmed: false, photoUri: null };

    expect(
      createMeterReading({ ...optional, details: { condition: 'normal', value: 130 } }),
    ).toMatchObject({ photoUri: null });
    expect(
      createMeterReading({
        ...optional,
        details: { condition: 'inaccessible', inaccessibleReason: 'Portón cerrado' },
      }),
    ).toMatchObject({ photoUri: null });
  });

  it('registra la lectura menor que la anterior marcada para revisión', () => {
    expect(
      createMeterReading({
        ...elevated,
        details: { condition: 'normal', value: 100 },
        meterReviewConfirmed: false,
        photoUri: null,
      }),
    ).toMatchObject({ consumption: null, consumptionCheck: 'review-required' });
  });

  it('marca la evaluación como no aplica en un medidor inaccesible', () => {
    expect(
      createMeterReading({
        ...elevated,
        details: { condition: 'inaccessible', inaccessibleReason: 'Portón cerrado' },
        meterReviewConfirmed: false,
        photoUri: null,
      }),
    ).toMatchObject({ consumption: null, consumptionCheck: 'not-applicable' });
  });
});

describe('createMeterReading', () => {
  const base = {
    employeeCode: 'EPM-1001',
    meterCode: 'MED-123456',
    meter,
    recordedAt,
    meterReviewConfirmed: false,
    photoUri: null,
  };

  it('HU-004: sin conexión registra la lectura normal como pendiente de verificar', () => {
    expect(
      createMeterReading({
        ...base,
        meterCode: 'med-123456',
        details: { condition: 'normal', value: 125.5 },
        isOnline: false,
      }),
    ).toEqual({
      employeeCode: 'EPM-1001',
      meterCode: 'MED-123456',
      condition: 'normal',
      value: 125.5,
      inaccessibleReason: null,
      damageDescription: null,
      recordedAt: '2026-10-27T15:30:00.000Z',
      previousReading: 120,
      previousReadingDate: '2025-01-14',
      status: 'pending-verification',
      difference: null,
      verifiedAt: null,
      monthlyAverageConsumption: 18.5,
      consumption: 5.5,
      consumptionCheck: 'normal',
      meterReviewConfirmed: false,
      photoUri: null,
    });
  });

  it('HU-004: con conexión compara al momento con la lectura anterior', () => {
    const reading = createMeterReading({
      ...base,
      details: { condition: 'normal', value: 125.5 },
      isOnline: true,
    });

    expect(reading.status).toBe('verified');
    expect(reading.difference).toBe(5.5);
    expect(reading.verifiedAt).toBe('2026-10-27T15:30:00.000Z');
  });

  it('inaccesible: guarda el motivo sin lectura y marca la comparación como no aplica', () => {
    for (const isOnline of [true, false]) {
      expect(
        createMeterReading({
          ...base,
          details: { condition: 'inaccessible', inaccessibleReason: 'Portón cerrado' },
          isOnline,
        }),
      ).toMatchObject({
        condition: 'inaccessible',
        value: null,
        inaccessibleReason: 'Portón cerrado',
        damageDescription: null,
        status: 'not-applicable',
        difference: null,
        verifiedAt: null,
      });
    }
  });

  it('dañado sin lectura: guarda la descripción y marca la comparación como no aplica', () => {
    expect(
      createMeterReading({
        ...base,
        details: { condition: 'damaged', damageDescription: 'Vidrio roto', value: null },
        isOnline: true,
        photoUri: 'file:///documents/reading-photos/MED-123456-1.jpg',
      }),
    ).toMatchObject({
      condition: 'damaged',
      value: null,
      damageDescription: 'Vidrio roto',
      status: 'not-applicable',
      difference: null,
    });
  });

  it('dañado con lectura: queda pendiente sin conexión y se compara con conexión', () => {
    const details = { condition: 'damaged' as const, damageDescription: 'Vidrio roto', value: 118 };

    const withPhoto = { ...base, photoUri: 'file:///documents/reading-photos/MED-123456-1.jpg' };

    expect(createMeterReading({ ...withPhoto, details, isOnline: false })).toMatchObject({
      value: 118,
      status: 'pending-verification',
      difference: null,
    });
    expect(createMeterReading({ ...withPhoto, details, isOnline: true })).toMatchObject({
      value: 118,
      status: 'verified',
      difference: -2,
    });
  });

  it('no registra con la ficha de otro medidor', () => {
    expect(() =>
      createMeterReading({
        ...base,
        meterCode: 'MED-654321',
        details: { condition: 'normal', value: 125 },
        isOnline: false,
      }),
    ).toThrow(MeterReadingError);
  });

  it('no registra sin técnico ni con valores no válidos', () => {
    const offline = { ...base, isOnline: false };

    expect(() =>
      createMeterReading({
        ...offline,
        employeeCode: ' ',
        details: { condition: 'normal', value: 1 },
      }),
    ).toThrow(MeterReadingError);
    expect(() =>
      createMeterReading({ ...offline, details: { condition: 'normal', value: -1 } }),
    ).toThrow(MeterReadingError);
    expect(() =>
      createMeterReading({ ...offline, details: { condition: 'normal', value: Number.NaN } }),
    ).toThrow(MeterReadingError);
  });
});

describe('verifyReading', () => {
  const pending = createMeterReading({
    employeeCode: 'EPM-1001',
    meterCode: 'MED-123456',
    details: { condition: 'normal', value: 118 },
    meter,
    recordedAt,
    isOnline: false,
    meterReviewConfirmed: false,
    photoUri: null,
  });

  it('HU-004 CA-03: compara la lectura pendiente con la anterior guardada al registrar', () => {
    const verifiedAt = new Date('2026-10-28T13:00:00.000Z');

    expect(verifyReading({ ...pending, id: 7 }, verifiedAt)).toEqual({
      ...pending,
      id: 7,
      status: 'verified',
      difference: -2,
      verifiedAt: '2026-10-28T13:00:00.000Z',
    });
  });

  it('no altera una lectura ya verificada', () => {
    const verified = verifyReading(pending, new Date('2026-10-28T13:00:00.000Z'));

    expect(verifyReading(verified, new Date('2026-10-29T13:00:00.000Z'))).toBe(verified);
  });

  it('no altera un registro sin lectura', () => {
    const inaccessible = createMeterReading({
      employeeCode: 'EPM-1001',
      meterCode: 'MED-123456',
      details: { condition: 'inaccessible', inaccessibleReason: 'Portón cerrado' },
      meter,
      recordedAt,
      isOnline: false,
      meterReviewConfirmed: false,
      photoUri: null,
    });

    expect(verifyReading(inaccessible, new Date())).toBe(inaccessible);
  });
});

describe('formateo', () => {
  it('muestra el signo de la diferencia', () => {
    expect(formatReadingDifference(5.5)).toBe('+5.5');
    expect(formatReadingDifference(-2)).toBe('-2');
    expect(formatReadingDifference(0)).toBe('0');
  });

  it('detalla la comparación con la lectura anterior', () => {
    const base = { previousReading: 1250, previousReadingDate: '2026-09-27' };

    expect(describeReadingDifference({ ...base, value: 1265.5, difference: 15.5 }, 'm³')).toEqual([
      'Lectura actual: 1265.5 m³',
      'Lectura anterior: 1250 m³ del 27/09/2026',
      'Diferencia: 1265.5 − 1250 = +15.5 m³',
      'El medidor avanzó 15.5 m³ desde la lectura anterior.',
    ]);
    expect(describeReadingDifference({ ...base, value: 1250, difference: 0 }, 'm³')[3]).toBe(
      'El medidor no avanzó: la lectura es igual a la anterior.',
    );
    expect(describeReadingDifference({ ...base, value: 1248, difference: -2 }, 'm³')[3]).toBe(
      'La lectura es menor que la anterior por 2 m³. Revise el valor ingresado o el estado del medidor.',
    );
  });

  it('muestra el momento del registro en hora de Ecuador', () => {
    expect(formatReadingTimestamp('2026-10-27T15:30:00.000Z')).toBe('27/10/2026 10:30');
  });
});

describe('HU-010', () => {
  it('CA-03: usa el mes calendario de Ecuador', () => {
    expect(getReadingMonth(new Date('2026-10-31T23:30:00.000-05:00'))).toBe('2026-10');
    expect(getReadingMonth(new Date('2026-11-01T03:00:00.000Z'))).toBe('2026-10');
    expect(getReadingMonth(new Date('2026-11-01T05:00:00.000Z'))).toBe('2026-11');
  });

  const saved = {
    ...createMeterReading({
      employeeCode: 'EPM-1001',
      meterCode: 'MED-123456',
      details: { condition: 'normal', value: 125.5 },
      meter,
      recordedAt,
      isOnline: false,
      meterReviewConfirmed: false,
      photoUri: null,
    }),
    id: 3,
    readingUuid: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
    syncStatus: 'pending' as const,
    sentAt: null,
    updatedAt: null,
  };
  const correctedAt = new Date('2026-10-28T13:00:00.000Z');

  it('CA-01: corrige un registro no enviado y recalcula con la ficha guardada', () => {
    expect(
      correctMeterReading(saved, {
        details: { condition: 'normal', value: 200 },
        meterReviewConfirmed: true,
        photoUri: 'file:///documents/reading-photos/MED-123456-2.jpg',
        isOnline: false,
        correctedAt,
      }),
    ).toMatchObject({
      id: 3,
      readingUuid: saved.readingUuid,
      value: 200,
      consumption: 80,
      consumptionCheck: 'elevated',
      recordedAt: saved.recordedAt,
      updatedAt: '2026-10-28T13:00:00.000Z',
      syncStatus: 'pending',
    });
  });

  it('CA-01: aplica las validaciones del nuevo estado', () => {
    expect(() =>
      correctMeterReading(saved, {
        details: { condition: 'damaged', damageDescription: 'Vidrio roto', value: null },
        meterReviewConfirmed: false,
        photoUri: null,
        isOnline: false,
        correctedAt,
      }),
    ).toThrow('La foto del medidor es obligatoria si el medidor está dañado.');
  });

  it('CA-02: no permite corregir un registro enviado', () => {
    expect(() =>
      correctMeterReading(
        { ...saved, syncStatus: 'sent', sentAt: '2026-10-27T16:00:00.000Z' },
        {
          details: { condition: 'normal', value: 130 },
          meterReviewConfirmed: false,
          photoUri: null,
          isOnline: true,
          correctedAt,
        },
      ),
    ).toThrow('Un registro enviado no se puede corregir.');
  });
});
