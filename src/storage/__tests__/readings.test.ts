import type * as ReadingsModule from '../readings';

const mockedOpenDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockedOpenDatabaseAsync(...args),
}));

const database = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  withTransactionAsync: jest.fn(),
};

const pendingReading = {
  employeeCode: 'EPM-1001',
  meterCode: 'MED-123456',
  condition: 'normal' as const,
  value: 125.5,
  inaccessibleReason: null,
  damageDescription: null,
  recordedAt: '2026-10-27T15:30:00.000Z',
  previousReading: 120,
  previousReadingDate: '2025-01-14',
  status: 'pending-verification' as const,
  difference: null,
  verifiedAt: null,
  monthlyAverageConsumption: 18.5,
  consumption: 5.5,
  consumptionCheck: 'normal' as const,
  meterReviewConfirmed: false,
  photoUri: null,
};

const pendingRow = {
  id: 3,
  employee_code: 'EPM-1001',
  meter_code: 'MED-123456',
  condition: 'normal',
  value: 125.5,
  inaccessible_reason: null,
  damage_description: null,
  recorded_at: '2026-10-27T15:30:00.000Z',
  previous_reading: 120,
  previous_reading_date: '2025-01-14',
  status: 'pending-verification',
  difference: null,
  verified_at: null,
  monthly_average_consumption: 18.5,
  consumption: 5.5,
  consumption_check: 'normal',
  meter_review_confirmed: 0,
  photo_uri: null,
};

const TEST_UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

// Cada prueba carga el módulo de nuevo para empezar sin una base de datos abierta.
let readings: typeof ReadingsModule;

beforeEach(() => {
  mockedOpenDatabaseAsync.mockReset().mockResolvedValue(database);
  database.execAsync.mockReset().mockResolvedValue(undefined);
  database.runAsync.mockReset();
  database.getAllAsync.mockReset();
  database.getFirstAsync
    .mockReset()
    .mockImplementation(async (sql: string) =>
      sql.startsWith('PRAGMA')
        ? { user_version: 6 }
        : sql.includes('AS uuid')
          ? { uuid: TEST_UUID }
          : null,
    );
  database.withTransactionAsync.mockReset().mockImplementation((task: () => Promise<void>) => task());
  jest.isolateModules(() => {
    readings = require('../readings');
  });
});

describe('readings migrations', () => {
  it('crea la tabla original y la migra al esquema de HU-005 en una base nueva', async () => {
    database.getFirstAsync.mockResolvedValue({ user_version: 0 });
    database.getAllAsync.mockResolvedValue([]);

    await readings.listMeterReadings('EPM-1001', 'MED-123456');

    expect(database.execAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS meter_readings'),
    );
    expect(database.execAsync).toHaveBeenNthCalledWith(2, 'PRAGMA user_version = 1');
    expect(database.execAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('CREATE TABLE meter_readings_v2'),
    );
    expect(database.execAsync).toHaveBeenNthCalledWith(4, 'PRAGMA user_version = 2');
    expect(database.execAsync).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('ADD COLUMN consumption_check'),
    );
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(database.execAsync).toHaveBeenLastCalledWith('PRAGMA user_version = 6');
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(6);
  });

  it('conserva las lecturas de HU-004 con sus ids y estado normal', async () => {
    database.getFirstAsync.mockResolvedValue({ user_version: 1 });
    database.getAllAsync.mockResolvedValue([]);

    await readings.listMeterReadings('EPM-1001', 'MED-123456');

    const migration = database.execAsync.mock.calls[0][0] as string;
    expect(migration).toMatch(
      /INSERT INTO meter_readings_v2 \(\s*id,[\s\S]*SELECT\s+id, employee_code, meter_code, 'normal', value/,
    );
    expect(migration.indexOf('INSERT INTO meter_readings_v2')).toBeLessThan(
      migration.indexOf('DROP TABLE meter_readings'),
    );
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
  });

  it('HU-006: añade las columnas de consumo sin reemplazar los registros existentes', async () => {
    database.getFirstAsync.mockResolvedValue({ user_version: 2 });
    database.getAllAsync.mockResolvedValue([]);

    await readings.listMeterReadings('EPM-1001', 'MED-123456');

    const migration = database.execAsync.mock.calls[0][0] as string;
    expect(migration).not.toMatch(/DROP TABLE|DELETE|UPDATE/);
    expect(migration).toContain("DEFAULT 'not-evaluated'");
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
  });

  it('no repite migraciones ya aplicadas y abre la base una sola vez', async () => {
    database.getAllAsync.mockResolvedValue([]);

    await readings.listMeterReadings('EPM-1001', 'MED-123456');
    await readings.listMeterReadings('EPM-1001', 'MED-123456');

    expect(mockedOpenDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(mockedOpenDatabaseAsync).toHaveBeenCalledWith('epmaps.db');
    expect(database.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('readings storage', () => {
  it('guarda el registro con estado, lectura, motivo, descripción y contexto de verificación', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 3, changes: 1 });

    await expect(readings.saveReading(pendingReading)).resolves.toEqual({
      ...pendingReading,
      id: 3,
      readingUuid: TEST_UUID,
      syncStatus: 'pending',
      sentAt: null,
      updatedAt: null,
    });

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO meter_readings'),
      'EPM-1001',
      'MED-123456',
      'normal',
      125.5,
      null,
      null,
      '2026-10-27T15:30:00.000Z',
      120,
      '2025-01-14',
      'pending-verification',
      null,
      null,
      18.5,
      5.5,
      'normal',
      0,
      null,
      '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
    );
  });

  it('HU-006: guarda la confirmación como 1 y la foto asociada al registro', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 5, changes: 1 });
    const photoUri = 'file:///documents/reading-photos/MED-123456-1.jpg';

    await readings.saveReading({
      ...pendingReading,
      value: 200,
      consumption: 80,
      consumptionCheck: 'elevated',
      meterReviewConfirmed: true,
      photoUri,
    });

    expect(database.runAsync.mock.calls[0].slice(-6, -1)).toEqual([
      18.5,
      80,
      'elevated',
      1,
      photoUri,
    ]);
  });

  it('HU-006: recupera la confirmación como booleano', async () => {
    database.getAllAsync.mockResolvedValue([{ ...pendingRow, meter_review_confirmed: 1 }]);

    const [reading] = await readings.listMeterReadings('EPM-1001', 'MED-123456');

    expect(reading.meterReviewConfirmed).toBe(true);
  });

  it('guarda un medidor inaccesible sin lectura', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 4, changes: 1 });

    await readings.saveReading({
      ...pendingReading,
      condition: 'inaccessible',
      value: null,
      inaccessibleReason: 'Portón cerrado',
      status: 'not-applicable',
    });

    const [, , , condition, value, reason, , , , , status] = database.runAsync.mock.calls[0];
    expect([condition, value, reason, status]).toEqual([
      'inaccessible',
      null,
      'Portón cerrado',
      'not-applicable',
    ]);
  });

  it('consulta los registros del técnico y del medidor normalizado', async () => {
    const damagedRow = {
      ...pendingRow,
      id: 4,
      condition: 'damaged',
      value: null,
      damage_description: 'Vidrio roto',
      status: 'not-applicable',
    };
    database.getAllAsync.mockResolvedValue([damagedRow, pendingRow]);

    await expect(readings.listMeterReadings('EPM-1001', ' med-123456 ')).resolves.toEqual([
      {
        ...pendingReading,
        id: 4,
        condition: 'damaged',
        value: null,
        damageDescription: 'Vidrio roto',
        status: 'not-applicable',
      },
      { ...pendingReading, id: 3 },
    ]);
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE employee_code = ? AND meter_code = ?'),
      'EPM-1001',
      'MED-123456',
    );
  });

  it('HU-004 CA-03: verifica las pendientes comparándolas con la lectura anterior guardada', async () => {
    database.getAllAsync.mockResolvedValue([pendingRow]);
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

    await expect(
      readings.verifyPendingReadings(new Date('2026-10-28T13:00:00.000Z')),
    ).resolves.toBe(1);

    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'pending-verification'"),
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND status = 'pending-verification'"),
      'verified',
      5.5,
      '2026-10-28T13:00:00.000Z',
      3,
    );
  });

  it('no cuenta como verificada una lectura que ya fue verificada por otra ejecución', async () => {
    database.getAllAsync.mockResolvedValue([pendingRow]);
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

    await expect(readings.verifyPendingReadings()).resolves.toBe(0);
  });
});

describe('HU-008: captura pendiente', () => {
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

  it('crea la tabla de capturas pendientes en la migración v4', async () => {
    database.getFirstAsync.mockResolvedValueOnce({ user_version: 3 }).mockResolvedValue(null);

    await readings.loadDraft('EPM-1001');

    expect(database.execAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE reading_drafts'),
    );
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
  });

  it('HU-009: asigna un UUID a cada registro existente y los deja pendientes de envío', async () => {
    database.getFirstAsync.mockResolvedValue({ user_version: 4 });
    database.getAllAsync.mockResolvedValue([]);

    await readings.listMeterReadings('EPM-1001', 'MED-123456');

    const migration = database.execAsync.mock.calls[0][0] as string;
    expect(migration).toContain("sync_status TEXT NOT NULL DEFAULT 'pending'");
    expect(migration).toMatch(/UPDATE meter_readings SET reading_uuid = lower\([\s\S]*randomblob/);
    expect(migration).toContain('CREATE UNIQUE INDEX meter_readings_by_uuid');
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
  });

  it('elimina la captura pendiente en la misma transacción que guarda el registro', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 3, changes: 1 });

    await readings.saveReading(pendingReading);

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).toHaveBeenLastCalledWith(
      'DELETE FROM reading_drafts WHERE employee_code = ?',
      'EPM-1001',
    );
  });

  it('recupera la captura del técnico con su ficha guardada', async () => {
    database.getFirstAsync.mockResolvedValueOnce({ user_version: 6 }).mockResolvedValue({
      employee_code: 'EPM-1001',
      meter_digits: '123456',
      condition: 'damaged',
      value: '130',
      inaccessible_reason: '',
      damage_description: 'Vidrio roto',
      meter_review_confirmed: 0,
      photo_uri: 'file:///documents/reading-photos/MED-123456-1.jpg',
      meter_json: JSON.stringify(meter),
      updated_at: '2026-10-27T15:30:00.000Z',
    });

    await expect(readings.loadDraft('EPM-1001')).resolves.toEqual({
      employeeCode: 'EPM-1001',
      meterDigits: '123456',
      form: {
        condition: 'damaged',
        value: '130',
        inaccessibleReason: '',
        damageDescription: 'Vidrio roto',
      },
      meterReviewConfirmed: false,
      photoUri: 'file:///documents/reading-photos/MED-123456-1.jpg',
      meter,
      updatedAt: '2026-10-27T15:30:00.000Z',
    });
    expect(database.getFirstAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE employee_code = ?'),
      'EPM-1001',
    );
  });

  it('al cambiar el código reinicia la captura y devuelve la foto abandonada', async () => {
    database.getFirstAsync
      .mockResolvedValueOnce({ user_version: 6 })
      .mockResolvedValue({ meter_digits: '123456', photo_uri: 'file:///old.jpg' });
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

    await expect(readings.saveDraftMeterCode('EPM-1001', '654321')).resolves.toBe(
      'file:///old.jpg',
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO reading_drafts'),
      'EPM-1001',
      '654321',
      expect.any(String),
    );
  });

  it('al descartar elimina la captura y devuelve su foto', async () => {
    database.getFirstAsync
      .mockResolvedValueOnce({ user_version: 6 })
      .mockResolvedValue({ photo_uri: 'file:///draft.jpg' });
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

    await expect(readings.deleteDraft('EPM-1001')).resolves.toBe('file:///draft.jpg');
    expect(database.runAsync).toHaveBeenCalledWith(
      'DELETE FROM reading_drafts WHERE employee_code = ?',
      'EPM-1001',
    );
  });
});

describe('HU-009: estado de envío', () => {
  it('marca como enviado solo un registro que seguía pendiente', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

    await expect(
      readings.markReadingSent(3, new Date('2026-10-28T13:00:00.000Z'), null),
    ).resolves.toBe(1);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND sync_status = 'pending' AND updated_at IS ?"),
      '2026-10-28T13:00:00.000Z',
      3,
      null,
    );
  });

  it('cuenta los registros pendientes de envío del técnico', async () => {
    database.getFirstAsync.mockResolvedValueOnce({ user_version: 6 }).mockResolvedValue({ count: 2 });

    await expect(readings.countUnsentReadings('EPM-1001')).resolves.toBe(2);
  });
});

describe('HU-010', () => {
  it('CA-03: no registra dos veces el mismo medidor en el mismo mes', async () => {
    database.getFirstAsync.mockImplementation(async (sql: string) =>
      sql.startsWith('PRAGMA') ? { user_version: 6 } : { id: 9 },
    );

    await expect(readings.saveReading(pendingReading)).rejects.toThrow(
      readings.DuplicateReadingError,
    );
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("strftime('%Y-%m', recorded_at, '-5 hours') = ?"),
      'MED-123456',
      '2026-10',
    );
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('CA-02: no guarda la corrección de un registro ya enviado', async () => {
    database.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

    await expect(
      readings.updateReading({
        ...pendingReading,
        id: 3,
        readingUuid: TEST_UUID,
        syncStatus: 'pending',
        sentAt: null,
        updatedAt: '2026-10-28T13:00:00.000Z',
      }),
    ).rejects.toThrow('Un registro enviado no se puede corregir.');
    const [sql, ...params] = database.runAsync.mock.calls[0];
    expect(sql).toContain("WHERE id = ? AND sync_status = 'pending'");
    expect(params.at(-1)).toBe(3);
  });
});
