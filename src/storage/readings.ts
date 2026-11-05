import * as SQLite from 'expo-sqlite';

import { isMeter, type Meter } from '../domain/meter';
import { normalizeMeterCode } from '../domain/meter-code';
import type { ReadingDraft } from '../domain/reading-draft';
import {
  getReadingMonth,
  MeterReadingError,
  verifyReading,
  type ConsumptionCheck,
  type MeterCondition,
  type MeterReading,
  type NewMeterReading,
  type ReadingStatus,
  type SyncStatus,
} from '../domain/reading';
import {
  describeLocationChange,
  isValidReadingLocation,
  type LocationSource,
  type ReadingLocation,
  type ReadingLocationChange,
} from '../domain/reading-location';

const DATABASE_NAME = 'epmaps.db';

// UUID v4 generado por SQLite con `randomblob`, sin dependencias adicionales.
const UUID_V4_SQL = `lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (random() & 3), 1) || substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)`;

// HU-010: mes calendario del registro en Ecuador (UTC-5, sin horario de verano), igual que
// `getReadingMonth`.
const READING_MONTH_SQL = "strftime('%Y-%m', recorded_at, '-5 hours')";

export class DuplicateReadingError extends Error {
  constructor() {
    super('El medidor ya tiene un registro en este mes.');
    this.name = 'DuplicateReadingError';
  }
}

// Cada migración se aplica una sola vez, en orden, según `PRAGMA user_version`.
const MIGRATIONS = [
  // v1 (HU-004): tabla original de lecturas.
  `
  CREATE TABLE IF NOT EXISTS meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL,
    meter_code TEXT NOT NULL,
    value REAL NOT NULL CHECK (value >= 0),
    recorded_at TEXT NOT NULL,
    previous_reading REAL NOT NULL,
    previous_reading_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending-verification', 'verified')),
    difference REAL,
    verified_at TEXT
  );
  CREATE INDEX IF NOT EXISTS meter_readings_by_meter
    ON meter_readings (employee_code, meter_code);
  `,
  // v2 (HU-005): estado del medidor, lectura opcional, motivo y descripción del daño.
  // Las lecturas existentes se conservan con sus mismos ids y quedan con estado normal.
  `
  CREATE TABLE meter_readings_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL,
    meter_code TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('normal', 'inaccessible', 'damaged')),
    value REAL CHECK (value IS NULL OR value >= 0),
    inaccessible_reason TEXT,
    damage_description TEXT,
    recorded_at TEXT NOT NULL,
    previous_reading REAL NOT NULL,
    previous_reading_date TEXT NOT NULL,
    status TEXT NOT NULL
      CHECK (status IN ('pending-verification', 'verified', 'not-applicable')),
    difference REAL,
    verified_at TEXT,
    CHECK (
      (condition = 'normal' AND value IS NOT NULL
        AND inaccessible_reason IS NULL AND damage_description IS NULL)
      OR (condition = 'inaccessible' AND value IS NULL
        AND inaccessible_reason IS NOT NULL AND damage_description IS NULL)
      OR (condition = 'damaged'
        AND inaccessible_reason IS NULL AND damage_description IS NOT NULL)
    ),
    CHECK ((value IS NULL) = (status = 'not-applicable'))
  );
  INSERT INTO meter_readings_v2 (
    id, employee_code, meter_code, condition, value, recorded_at, previous_reading,
    previous_reading_date, status, difference, verified_at
  )
  SELECT
    id, employee_code, meter_code, 'normal', value, recorded_at, previous_reading,
    previous_reading_date, status, difference, verified_at
  FROM meter_readings;
  DROP TABLE meter_readings;
  ALTER TABLE meter_readings_v2 RENAME TO meter_readings;
  CREATE INDEX IF NOT EXISTS meter_readings_by_meter
    ON meter_readings (employee_code, meter_code);
  `,
  // v3 (HU-006): consumo, evaluación del umbral, confirmación de revisión y foto.
  // Los registros existentes quedan como `not-evaluated`, sin confirmación ni foto.
  `
  ALTER TABLE meter_readings ADD COLUMN monthly_average_consumption REAL;
  ALTER TABLE meter_readings ADD COLUMN consumption REAL;
  ALTER TABLE meter_readings ADD COLUMN consumption_check TEXT NOT NULL DEFAULT 'not-evaluated'
    CHECK (consumption_check IN
      ('not-evaluated', 'not-applicable', 'normal', 'elevated', 'review-required'));
  ALTER TABLE meter_readings ADD COLUMN meter_review_confirmed INTEGER NOT NULL DEFAULT 0
    CHECK (meter_review_confirmed IN (0, 1));
  ALTER TABLE meter_readings ADD COLUMN photo_uri TEXT;
  `,
  // v4 (HU-008): una captura pendiente por técnico.
  `
  CREATE TABLE reading_drafts (
    employee_code TEXT PRIMARY KEY,
    meter_digits TEXT NOT NULL,
    condition TEXT CHECK (condition IS NULL OR condition IN ('normal', 'inaccessible', 'damaged')),
    value TEXT NOT NULL DEFAULT '',
    inaccessible_reason TEXT NOT NULL DEFAULT '',
    damage_description TEXT NOT NULL DEFAULT '',
    meter_review_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (meter_review_confirmed IN (0, 1)),
    photo_uri TEXT,
    meter_json TEXT,
    updated_at TEXT NOT NULL
  );
  `,
  // v5 (HU-009): UUID por registro y estado de envío. Los registros existentes reciben su UUID
  // y quedan pendientes de envío.
  `
  ALTER TABLE meter_readings ADD COLUMN reading_uuid TEXT;
  ALTER TABLE meter_readings ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'sent'));
  ALTER TABLE meter_readings ADD COLUMN sent_at TEXT;
  UPDATE meter_readings SET reading_uuid = ${UUID_V4_SQL} WHERE reading_uuid IS NULL;
  CREATE UNIQUE INDEX meter_readings_by_uuid ON meter_readings (reading_uuid);
  `,
  // v6 (HU-010): fecha de la última corrección.
  `
  ALTER TABLE meter_readings ADD COLUMN updated_at TEXT;
  `,
  // v7: ubicación del medidor (GPS o manual) con su precisión, ubicación de la captura pendiente
  // e historial de los cambios de ubicación hechos al corregir. Los registros existentes quedan
  // sin ubicación.
  `
  ALTER TABLE meter_readings ADD COLUMN latitude REAL;
  ALTER TABLE meter_readings ADD COLUMN longitude REAL;
  ALTER TABLE meter_readings ADD COLUMN location_accuracy REAL;
  ALTER TABLE meter_readings ADD COLUMN location_source TEXT
    CHECK (location_source IS NULL OR location_source IN ('gps', 'manual'));
  ALTER TABLE meter_readings ADD COLUMN location_captured_at TEXT;
  ALTER TABLE reading_drafts ADD COLUMN location_json TEXT;
  CREATE TABLE reading_location_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER NOT NULL REFERENCES meter_readings (id),
    previous_latitude REAL,
    previous_longitude REAL,
    previous_accuracy REAL,
    previous_source TEXT,
    previous_captured_at TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    source TEXT NOT NULL CHECK (source IN ('gps', 'manual')),
    captured_at TEXT NOT NULL,
    changed_at TEXT NOT NULL
  );
  CREATE INDEX reading_location_history_by_reading
    ON reading_location_history (reading_id, id);
  `,
];

type LocationColumns = {
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_source: LocationSource | null;
  location_captured_at: string | null;
};

type LocationHistoryRow = {
  previous_latitude: number | null;
  previous_longitude: number | null;
  previous_accuracy: number | null;
  previous_source: LocationSource | null;
  previous_captured_at: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: LocationSource;
  captured_at: string;
  changed_at: string;
};

type ReadingRow = {
  id: number;
  employee_code: string;
  meter_code: string;
  condition: MeterCondition;
  value: number | null;
  inaccessible_reason: string | null;
  damage_description: string | null;
  recorded_at: string;
  previous_reading: number;
  previous_reading_date: string;
  status: ReadingStatus;
  difference: number | null;
  verified_at: string | null;
  monthly_average_consumption: number | null;
  consumption: number | null;
  consumption_check: ConsumptionCheck;
  meter_review_confirmed: number;
  photo_uri: string | null;
  reading_uuid: string;
  sync_status: SyncStatus;
  sent_at: string | null;
  updated_at: string | null;
} & LocationColumns;

type DraftRow = {
  employee_code: string;
  meter_digits: string;
  condition: MeterCondition | null;
  value: string;
  inaccessible_reason: string;
  damage_description: string;
  meter_review_confirmed: number;
  photo_uri: string | null;
  meter_json: string | null;
  location_json: string | null;
  updated_at: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
// Las escrituras de la captura pendiente se aplican en orden para no perder el último cambio.
let draftWrites: Promise<unknown> = Promise.resolve();

function enqueueDraftWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = draftWrites.then(task, task);
  draftWrites = result.catch(() => undefined);
  return result;
}

function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME)
    .then(async (database) => {
      await migrate(database);
      return database;
    })
    .catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });

  return databasePromise;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const [index, migration] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (version <= currentVersion) {
      continue;
    }

    await database.withTransactionAsync(async () => {
      await database.execAsync(migration);
      await database.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}

// Guarda el registro y elimina la captura pendiente del técnico en una sola transacción.
export async function saveReading(reading: NewMeterReading): Promise<MeterReading> {
  const database = await getDatabase();
  let id = 0;
  let readingUuid = '';

  await enqueueDraftWrite(() =>
    database.withTransactionAsync(async () => {
      // HU-010 CA-03: un solo registro por medidor y mes, sin importar el técnico.
      const existing = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM meter_readings WHERE meter_code = ? AND ${READING_MONTH_SQL} = ? LIMIT 1`,
        reading.meterCode,
        getReadingMonth(new Date(reading.recordedAt)),
      );
      if (existing) {
        throw new DuplicateReadingError();
      }

      const generated = await database.getFirstAsync<{ uuid: string }>(
        `SELECT ${UUID_V4_SQL} AS uuid`,
      );
      if (!generated) {
        throw new Error('No se pudo generar el identificador del registro.');
      }
      readingUuid = generated.uuid;
      id = await insertReading(database, reading, readingUuid);
      await database.runAsync(
        'DELETE FROM reading_drafts WHERE employee_code = ?',
        reading.employeeCode,
      );
    }),
  );

  return { ...reading, id, readingUuid, syncStatus: 'pending', sentAt: null, updatedAt: null };
}

async function insertReading(
  database: SQLite.SQLiteDatabase,
  reading: NewMeterReading,
  readingUuid: string,
): Promise<number> {
  const result = await database.runAsync(
    `INSERT INTO meter_readings (
      employee_code, meter_code, condition, value, inaccessible_reason, damage_description,
      recorded_at, previous_reading, previous_reading_date, status, difference, verified_at,
      monthly_average_consumption, consumption, consumption_check, meter_review_confirmed,
      photo_uri, reading_uuid, sync_status, latitude, longitude, location_accuracy,
      location_source, location_captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    reading.employeeCode,
    reading.meterCode,
    reading.condition,
    reading.value,
    reading.inaccessibleReason,
    reading.damageDescription,
    reading.recordedAt,
    reading.previousReading,
    reading.previousReadingDate,
    reading.status,
    reading.difference,
    reading.verifiedAt,
    reading.monthlyAverageConsumption,
    reading.consumption,
    reading.consumptionCheck,
    reading.meterReviewConfirmed ? 1 : 0,
    reading.photoUri,
    readingUuid,
    ...locationParams(reading.location),
  );

  return result.lastInsertRowId;
}

export async function listUnsentReadings(): Promise<MeterReading[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ReadingRow>(
    "SELECT * FROM meter_readings WHERE sync_status = 'pending' ORDER BY id",
  );

  return rows.map(toMeterReading);
}

export async function countUnsentReadings(employeeCode: string): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM meter_readings WHERE sync_status = 'pending' AND employee_code = ?",
    employeeCode,
  );

  return row?.count ?? 0;
}

export type PeriodSyncSummary = { sent: number; pending: number };

export async function summarizePeriodSync(
  employeeCode: string,
  month: string,
): Promise<PeriodSyncSummary> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ sync_status: string; count: number }>(
    `SELECT sync_status, COUNT(*) AS count FROM meter_readings WHERE employee_code = ? AND ${READING_MONTH_SQL} = ? GROUP BY sync_status`,
    employeeCode,
    month,
  );

  return {
    sent: rows.find((row) => row.sync_status === 'sent')?.count ?? 0,
    pending: rows.find((row) => row.sync_status === 'pending')?.count ?? 0,
  };
}

// Solo marca como enviado un registro que seguía pendiente y sin corregir desde que se leyó;
// el registro y su foto se conservan.
export async function markReadingSent(
  id: number,
  now: Date,
  expectedUpdatedAt: string | null,
): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE meter_readings SET sync_status = 'sent', sent_at = ?
     WHERE id = ? AND sync_status = 'pending' AND updated_at IS ?`,
    now.toISOString(),
    id,
    expectedUpdatedAt,
  );

  return result.changes;
}

export async function findMeterReadingInMonth(
  meterCode: string,
  month: string,
): Promise<MeterReading | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ReadingRow>(
    `SELECT * FROM meter_readings WHERE meter_code = ? AND ${READING_MONTH_SQL} = ? LIMIT 1`,
    normalizeMeterCode(meterCode),
    month,
  );

  return row ? toMeterReading(row) : null;
}

// HU-010 CA-01/CA-02: guarda la corrección solo si el registro sigue sin enviar. Si la ubicación
// cambia, la anterior y la nueva quedan en el historial en la misma transacción.
export async function updateReading(reading: MeterReading): Promise<void> {
  const database = await getDatabase();

  await enqueueDraftWrite(() =>
    database.withTransactionAsync(async () => {
      const current = await database.getFirstAsync<LocationColumns>(
        `SELECT latitude, longitude, location_accuracy, location_source, location_captured_at
         FROM meter_readings WHERE id = ? AND sync_status = 'pending'`,
        reading.id,
      );
      if (!current) {
        throw new MeterReadingError('Un registro enviado no se puede corregir.');
      }

      const result = await database.runAsync(
        `UPDATE meter_readings SET
          condition = ?, value = ?, inaccessible_reason = ?, damage_description = ?, status = ?,
          difference = ?, verified_at = ?, consumption = ?, consumption_check = ?,
          meter_review_confirmed = ?, photo_uri = ?, updated_at = ?, latitude = ?, longitude = ?,
          location_accuracy = ?, location_source = ?, location_captured_at = ?
         WHERE id = ? AND sync_status = 'pending'`,
        reading.condition,
        reading.value,
        reading.inaccessibleReason,
        reading.damageDescription,
        reading.status,
        reading.difference,
        reading.verifiedAt,
        reading.consumption,
        reading.consumptionCheck,
        reading.meterReviewConfirmed ? 1 : 0,
        reading.photoUri,
        reading.updatedAt,
        ...locationParams(reading.location),
        reading.id,
      );
      if (result.changes === 0) {
        throw new MeterReadingError('Un registro enviado no se puede corregir.');
      }

      const change = reading.location
        ? describeLocationChange(
            toReadingLocation(current),
            reading.location,
            new Date(reading.updatedAt ?? Date.now()),
          )
        : null;
      if (change) {
        await database.runAsync(
          `INSERT INTO reading_location_history (
            reading_id, previous_latitude, previous_longitude, previous_accuracy, previous_source,
            previous_captured_at, latitude, longitude, accuracy, source, captured_at, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          reading.id,
          ...locationParams(change.previous),
          ...locationParams(change.next),
          change.changedAt,
        );
      }
    }),
  );
}

// Cambios de ubicación de un registro, del más antiguo al más reciente.
export async function listReadingLocationHistory(
  readingId: number,
): Promise<ReadingLocationChange[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocationHistoryRow>(
    'SELECT * FROM reading_location_history WHERE reading_id = ? ORDER BY id',
    readingId,
  );

  return rows.flatMap((row) => {
    const next = toReadingLocation({
      latitude: row.latitude,
      longitude: row.longitude,
      location_accuracy: row.accuracy,
      location_source: row.source,
      location_captured_at: row.captured_at,
    });
    if (!next) {
      return [];
    }

    const previous = toReadingLocation({
      latitude: row.previous_latitude,
      longitude: row.previous_longitude,
      location_accuracy: row.previous_accuracy,
      location_source: row.previous_source,
      location_captured_at: row.previous_captured_at,
    });

    return [{ previous, next, changedAt: row.changed_at }];
  });
}

function locationParams(
  location: ReadingLocation | null,
): [number | null, number | null, number | null, LocationSource | null, string | null] {
  return location
    ? [location.latitude, location.longitude, location.accuracy, location.source, location.capturedAt]
    : [null, null, null, null, null];
}

function toReadingLocation(columns: LocationColumns): ReadingLocation | null {
  const location = {
    latitude: columns.latitude,
    longitude: columns.longitude,
    accuracy: columns.location_accuracy,
    source: columns.location_source,
    capturedAt: columns.location_captured_at,
  };

  return isValidReadingLocation(location) ? location : null;
}

export async function loadDraft(employeeCode: string): Promise<ReadingDraft | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<DraftRow>(
    'SELECT * FROM reading_drafts WHERE employee_code = ?',
    employeeCode,
  );

  return row ? toReadingDraft(row) : null;
}

// HU-008: la captura pendiente comienza al ingresar el código. Si el código cambia, el resto
// de la captura se reinicia; devuelve la foto abandonada para eliminarla.
export function saveDraftMeterCode(
  employeeCode: string,
  meterDigits: string,
  now: Date = new Date(),
): Promise<string | null> {
  if (meterDigits === '') {
    return deleteDraft(employeeCode);
  }

  return enqueueDraftWrite(async () => {
    const database = await getDatabase();
    const current = await database.getFirstAsync<DraftRow>(
      'SELECT * FROM reading_drafts WHERE employee_code = ?',
      employeeCode,
    );
    if (current?.meter_digits === meterDigits) {
      return null;
    }

    await database.runAsync(
      `INSERT OR REPLACE INTO reading_drafts (employee_code, meter_digits, updated_at)
       VALUES (?, ?, ?)`,
      employeeCode,
      meterDigits,
      now.toISOString(),
    );

    return current?.photo_uri ?? null;
  });
}

export function saveDraftForm(
  draft: Omit<ReadingDraft, 'updatedAt'>,
  now: Date = new Date(),
): Promise<void> {
  return enqueueDraftWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO reading_drafts (
        employee_code, meter_digits, condition, value, inaccessible_reason, damage_description,
        meter_review_confirmed, photo_uri, meter_json, location_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (employee_code) DO UPDATE SET
        meter_digits = excluded.meter_digits,
        condition = excluded.condition,
        value = excluded.value,
        inaccessible_reason = excluded.inaccessible_reason,
        damage_description = excluded.damage_description,
        meter_review_confirmed = excluded.meter_review_confirmed,
        photo_uri = excluded.photo_uri,
        meter_json = COALESCE(excluded.meter_json, reading_drafts.meter_json),
        location_json = excluded.location_json,
        updated_at = excluded.updated_at`,
      draft.employeeCode,
      draft.meterDigits,
      draft.form.condition,
      draft.form.value,
      draft.form.inaccessibleReason,
      draft.form.damageDescription,
      draft.meterReviewConfirmed ? 1 : 0,
      draft.photoUri,
      draft.meter ? JSON.stringify(draft.meter) : null,
      draft.location ? JSON.stringify(draft.location) : null,
      now.toISOString(),
    );
  });
}

// Conserva la ficha consultada en la captura existente del mismo medidor.
export function saveDraftMeterSnapshot(
  employeeCode: string,
  meterDigits: string,
  meter: Meter,
): Promise<void> {
  return enqueueDraftWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE reading_drafts SET meter_json = ? WHERE employee_code = ? AND meter_digits = ?',
      JSON.stringify(meter),
      employeeCode,
      meterDigits,
    );
  });
}

// Devuelve la foto de la captura descartada para eliminarla.
export function deleteDraft(employeeCode: string): Promise<string | null> {
  return enqueueDraftWrite(async () => {
    const database = await getDatabase();
    const current = await database.getFirstAsync<{ photo_uri: string | null }>(
      'SELECT photo_uri FROM reading_drafts WHERE employee_code = ?',
      employeeCode,
    );
    await database.runAsync('DELETE FROM reading_drafts WHERE employee_code = ?', employeeCode);

    return current?.photo_uri ?? null;
  });
}

export async function listMeterReadings(
  employeeCode: string,
  meterCode: string,
): Promise<MeterReading[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ReadingRow>(
    `SELECT * FROM meter_readings
     WHERE employee_code = ? AND meter_code = ?
     ORDER BY recorded_at DESC, id DESC`,
    employeeCode,
    normalizeMeterCode(meterCode),
  );

  return rows.map(toMeterReading);
}

// CA-03: compara cada lectura pendiente con la lectura anterior guardada al registrarla.
// La condición sobre `status` evita modificar una lectura ya verificada por otra ejecución.
export async function verifyPendingReadings(now: Date = new Date()): Promise<number> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ReadingRow>(
    "SELECT * FROM meter_readings WHERE status = 'pending-verification' ORDER BY id",
  );
  let verifiedCount = 0;

  for (const row of rows) {
    const verified = verifyReading(toMeterReading(row), now);
    const result = await database.runAsync(
      `UPDATE meter_readings SET status = ?, difference = ?, verified_at = ?
       WHERE id = ? AND status = 'pending-verification'`,
      verified.status,
      verified.difference,
      verified.verifiedAt,
      verified.id,
    );
    verifiedCount += result.changes;
  }

  return verifiedCount;
}

function toReadingDraft(row: DraftRow): ReadingDraft {
  let meter = null;
  try {
    const parsed: unknown = row.meter_json ? JSON.parse(row.meter_json) : null;
    meter = isMeter(parsed) ? parsed : null;
  } catch {
    meter = null;
  }

  let location: ReadingLocation | null = null;
  try {
    const parsed: unknown = row.location_json ? JSON.parse(row.location_json) : null;
    location = isValidReadingLocation(parsed) ? parsed : null;
  } catch {
    location = null;
  }

  return {
    employeeCode: row.employee_code,
    meterDigits: row.meter_digits,
    form: {
      condition: row.condition,
      value: row.value,
      inaccessibleReason: row.inaccessible_reason,
      damageDescription: row.damage_description,
    },
    meterReviewConfirmed: row.meter_review_confirmed === 1,
    photoUri: row.photo_uri,
    location,
    meter,
    updatedAt: row.updated_at,
  };
}

function toMeterReading(row: ReadingRow): MeterReading {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    meterCode: row.meter_code,
    condition: row.condition,
    value: row.value,
    inaccessibleReason: row.inaccessible_reason,
    damageDescription: row.damage_description,
    recordedAt: row.recorded_at,
    previousReading: row.previous_reading,
    previousReadingDate: row.previous_reading_date,
    status: row.status,
    difference: row.difference,
    verifiedAt: row.verified_at,
    monthlyAverageConsumption: row.monthly_average_consumption,
    consumption: row.consumption,
    consumptionCheck: row.consumption_check,
    meterReviewConfirmed: row.meter_review_confirmed === 1,
    photoUri: row.photo_uri,
    readingUuid: row.reading_uuid,
    syncStatus: row.sync_status,
    sentAt: row.sent_at,
    updatedAt: row.updated_at,
    location: toReadingLocation(row),
  };
}
