import type {
  SqlDataDump,
  SqlDumpValue,
  SqlTableDump,
} from '@pkgs/sql-client-root-shared-ts/types';
import type { HarnessCheckpointRoomDump } from './checkpoint';
import type {
  HarnessSystemSnapshot,
  HarnessSystemSnapshotClientSlice,
} from './system-snapshot';
import { HARNESS_SYSTEM_SNAPSHOT_VERSION } from './system-snapshot';

export type ParsedHarnessSystemSnapshot = HarnessSystemSnapshot;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function expect(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(`parseHarnessSystemSnapshotJson: ${message}`);
}

function parseSqlDumpValue(value: unknown, path: string): SqlDumpValue {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((v, i) => parseSqlDumpValue(v, `${path}[${String(i)}]`));
  }
  expect(isPlainObject(value), `${path}: expected SqlDumpValue`);
  const out: Record<string, SqlDumpValue> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = parseSqlDumpValue(v, `${path}.${k}`);
  }
  return out;
}

function parseStringArray(value: unknown, path: string): string[] {
  expect(Array.isArray(value), `${path}: expected string[]`);
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    expect(typeof item === 'string', `${path}[${String(i)}]: expected string`);
    out.push(item);
  }
  return out;
}

function parseStringNumberRecord(
  value: unknown,
  path: string
): Record<string, number> {
  expect(isPlainObject(value), `${path}: expected Record<string, number>`);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    expect(typeof v === 'number', `${path}.${k}: expected number`);
    out[k] = v;
  }
  return out;
}

function parseStringStringRecord(
  value: unknown,
  path: string
): Record<string, string> {
  expect(isPlainObject(value), `${path}: expected Record<string, string>`);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    expect(typeof v === 'string', `${path}.${k}: expected string`);
    out[k] = v;
  }
  return out;
}

function parseSqlTableDump(value: unknown, path: string): SqlTableDump {
  expect(isPlainObject(value), `${path}: expected SqlTableDump`);
  const columns = parseStringArray(value['columns'], `${path}.columns`);
  expect(Array.isArray(value['rows']), `${path}.rows: expected array`);
  const rows: SqlDumpValue[][] = [];
  for (let i = 0; i < value['rows'].length; i++) {
    const row = value['rows'][i];
    expect(Array.isArray(row), `${path}.rows[${String(i)}]: expected array`);
    rows.push(
      row.map((cell, j) =>
        parseSqlDumpValue(cell, `${path}.rows[${String(i)}][${String(j)}]`)
      )
    );
  }
  return { columns, rows };
}

function parseSqlDataDump(value: unknown, path: string): SqlDataDump {
  expect(isPlainObject(value), `${path}: expected SqlDataDump`);
  expect(value['version'] === 1, `${path}.version: expected 1`);
  expect(isPlainObject(value['tables']), `${path}.tables: expected object`);
  const tables: Record<string, SqlTableDump> = {};
  for (const [k, v] of Object.entries(value['tables'])) {
    tables[k] = parseSqlTableDump(v, `${path}.tables.${k}`);
  }
  return { version: 1, tables };
}

function parseRoomDump(
  value: unknown,
  path: string
): HarnessCheckpointRoomDump {
  expect(isPlainObject(value), `${path}: expected room dump`);
  expect(Array.isArray(value['entries']), `${path}.entries: expected array`);
  expect(isPlainObject(value['dedup']), `${path}.dedup: expected object`);
  return {
    entries: value['entries'] as unknown[],
    dedup: value['dedup'] as Record<string, unknown>,
  };
}

function parseClientSlice(
  value: unknown,
  path: string
): HarnessSystemSnapshotClientSlice {
  expect(isPlainObject(value), `${path}: expected client slice`);
  return {
    tables: parseSqlDataDump(value['tables'], `${path}.tables`),
    kv: parseStringStringRecord(value['kv'], `${path}.kv`),
  };
}

function parseSnapshot(value: unknown): HarnessSystemSnapshot {
  expect(isPlainObject(value), 'expected object');
  expect(
    value['version'] === HARNESS_SYSTEM_SNAPSHOT_VERSION,
    `version: expected ${String(HARNESS_SYSTEM_SNAPSHOT_VERSION)}`
  );
  const localSchemaVersion = value['localSchemaVersion'];
  expect(
    typeof localSchemaVersion === 'number' &&
      Number.isInteger(localSchemaVersion) &&
      localSchemaVersion >= 0,
    'localSchemaVersion: expected non-negative integer'
  );
  expect(typeof value['clockMs'] === 'number', 'clockMs: expected number');
  expect(
    typeof value['clockPaused'] === 'boolean',
    'clockPaused: expected boolean'
  );

  expect(isPlainObject(value['clients']), 'clients: expected object');
  const clients: Record<string, HarnessSystemSnapshotClientSlice> = {};
  for (const [k, v] of Object.entries(value['clients'])) {
    clients[k] = parseClientSlice(v, `clients.${k}`);
  }

  expect(isPlainObject(value['rooms']), 'rooms: expected object');
  const rooms: Record<string, HarnessCheckpointRoomDump> = {};
  for (const [k, v] of Object.entries(value['rooms'])) {
    rooms[k] = parseRoomDump(v, `rooms.${k}`);
  }

  return {
    version: HARNESS_SYSTEM_SNAPSHOT_VERSION,
    localSchemaVersion,
    clockMs: value['clockMs'] as number,
    clockPaused: value['clockPaused'] as boolean,
    clientIds: parseStringArray(value['clientIds'], 'clientIds'),
    roomTopics: parseStringArray(value['roomTopics'], 'roomTopics'),
    partitions: parseStringArray(value['partitions'], 'partitions'),
    skewByAddress: parseStringNumberRecord(
      value['skewByAddress'],
      'skewByAddress'
    ),
    downAddresses: parseStringArray(value['downAddresses'], 'downAddresses'),
    evictedAddresses: parseStringArray(
      value['evictedAddresses'],
      'evictedAddresses'
    ),
    server: parseSqlDataDump(value['server'], 'server'),
    clients,
    rooms,
  };
}

export function parseHarnessSystemSnapshotJson(
  text: string
): HarnessSystemSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('parseHarnessSystemSnapshotJson: invalid JSON');
  }
  return parseSnapshot(parsed);
}
