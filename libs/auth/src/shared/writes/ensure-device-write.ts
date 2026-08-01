import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type DeviceSnapshot = Readonly<Record<string, string | null>>;

export type EnsureDeviceInput = {
  readonly deviceId: string;
  readonly snapshot: DeviceSnapshot;
};

type DeviceRow = Record<string, unknown>;

function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  return null;
}

function isDeviceRowComplete(
  row: DeviceRow | undefined,
  deviceId: string
): boolean {
  if (row === undefined) return false;
  return (
    row[DeviceCol.id] === deviceId &&
    typeof row[DeviceCol.createdAt] === 'string'
  );
}

function snapshotDiffers(
  stored: DeviceRow,
  snapshot: DeviceSnapshot,
  key: string
): boolean {
  const prev = normString(stored[key]);
  const next = snapshot[key] ?? null;
  if (prev === null && next === null) return false;
  if (prev === null || next === null) return prev !== next;
  return prev !== next;
}

function buildInsertArgs(
  deviceId: string,
  now: string,
  snapshot: DeviceSnapshot
): { cols: string[]; vals: (string | null)[] } {
  const cols: string[] = [
    DeviceCol.id,
    DeviceCol.createdAt,
    DeviceCol.firstSeenAt,
    DeviceCol.lastSeenAt,
  ];
  const vals: (string | null)[] = [deviceId, now, now, now];
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null) continue;
    cols.push(key);
    vals.push(value);
  }
  return { cols, vals };
}

function buildDeviceUpdates(
  row: DeviceRow,
  snapshot: DeviceSnapshot,
  now: string
): Record<string, string> {
  const existingFirst = normString(row[DeviceCol.firstSeenAt]);
  const created = normString(row[DeviceCol.createdAt]);
  const updates: Record<string, string> = {
    [DeviceCol.lastSeenAt]: now,
    ...(existingFirst === null
      ? { [DeviceCol.firstSeenAt]: created !== null ? created : now }
      : {}),
  };
  for (const key of Object.keys(snapshot)) {
    const next = snapshot[key];
    if (next === null || next === undefined) continue;
    if (snapshotDiffers(row, snapshot, key)) {
      updates[key] = next;
    }
  }
  return updates;
}

async function insertDeviceRow(
  db: SqlClient,
  deviceId: string,
  now: string,
  snapshot: DeviceSnapshot
): Promise<void> {
  const { cols, vals } = buildInsertArgs(deviceId, now, snapshot);
  const values: Record<string, string | null> = {};
  cols.forEach((column, index) => {
    values[column] = vals[index] ?? null;
  });
  await db.run(sqlMap({ insertInto: DEVICES_TABLE.tableName, values }));
}

async function updateDeviceRow(
  db: SqlClient,
  deviceId: string,
  updates: Record<string, string>
): Promise<void> {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  await db.run(
    sqlMap({
      update: DEVICES_TABLE.tableName,
      set: updates,
      where: ['=', DeviceCol.id, deviceId],
    })
  );
}

/**
 * Ensures a `devices` row exists and refreshes last-seen + changed metadata.
 * Snapshot values are collected on the client (expo/platform); shared stays pure.
 */
export async function ensureDeviceRow(
  db: SqlClient,
  deviceId: string,
  snapshot: DeviceSnapshot
): Promise<void> {
  const rows = await db.query<DeviceRow>(
    sqlMap({
      from: DEVICES_TABLE.tableName,
      where: ['=', DeviceCol.id, deviceId],
      limit: 1,
    })
  );
  const row = rows[0];
  const now = new Date().toISOString();
  if (!isDeviceRowComplete(row, deviceId)) {
    await insertDeviceRow(db, deviceId, now, snapshot);
    return;
  }
  await updateDeviceRow(
    db,
    deviceId,
    buildDeviceUpdates(row as DeviceRow, snapshot, now)
  );
}
