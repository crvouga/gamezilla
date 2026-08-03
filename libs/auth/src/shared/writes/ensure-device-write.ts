import { join, raw, sql, type Value } from '@pkgs/sql';

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
  return row['id'] === deviceId && typeof row['created_at'] === 'string';
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
  const cols: string[] = ['id', 'created_at', 'first_seen_at', 'last_seen_at'];
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
  const existingFirst = normString(row['first_seen_at']);
  const created = normString(row['created_at']);
  const updates: Record<string, string> = {
    last_seen_at: now,
    ...(existingFirst === null
      ? { first_seen_at: created !== null ? created : now }
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
  await db.run(sql<void>`
    INSERT INTO devices (${raw(cols.join(', '))})
    VALUES ${join(vals as Value[], ', ', '(', ')')}
  `);
}

async function updateDeviceRow(
  db: SqlClient,
  deviceId: string,
  updates: Record<string, string>
): Promise<void> {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const sets = join(
    entries.map(([column, value]) => sql<void>`${raw(column)} = ${value}`)
  );
  await db.run(sql<void>`
    UPDATE devices
    SET ${sets}
    WHERE id = ${deviceId}
  `);
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
  const rows = await db.query(sql<DeviceRow>`
    SELECT *
    FROM devices
    WHERE id = ${deviceId}
    LIMIT 1
  `);
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
