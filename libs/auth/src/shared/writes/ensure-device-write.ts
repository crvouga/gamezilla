import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';

export type DeviceSnapshot = Readonly<Record<string, string | null>>;

export type EnsureDeviceInput = {
  readonly deviceId: string;
  readonly snapshot: DeviceSnapshot;
};

type DeviceRow = Record<string, unknown>;

function parseEnsureDeviceInput(
  raw: unknown
): ReturnType<typeof ok<EnsureDeviceInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'ensure device input must be an object');
  }
  const record = raw as Record<string, unknown>;
  const deviceId = record['deviceId'];
  if (typeof deviceId !== 'string' || deviceId.length === 0) {
    return fail('INVALID_INPUT', 'deviceId is required');
  }
  const snapshot = record['snapshot'];
  if (snapshot === null || typeof snapshot !== 'object') {
    return fail('INVALID_INPUT', 'snapshot is required');
  }
  return ok({
    deviceId,
    snapshot: snapshot as DeviceSnapshot,
  });
}

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
): { cols: string[]; vals: unknown[] } {
  const cols: string[] = [
    DeviceCol.id,
    DeviceCol.createdAt,
    DeviceCol.firstSeenAt,
    DeviceCol.lastSeenAt,
  ];
  const vals: unknown[] = [deviceId, now, now, now];
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
  sql: SqlClient,
  deviceId: string,
  now: string,
  snapshot: DeviceSnapshot
): Promise<void> {
  const { cols, vals } = buildInsertArgs(deviceId, now, snapshot);
  const placeholders = cols.map(() => '?').join(', ');
  await sql.run(
    `INSERT INTO ${DEVICES_TABLE.tableName} (${cols.join(', ')})
     VALUES (${placeholders})`,
    vals
  );
}

async function updateDeviceRow(
  sql: SqlClient,
  deviceId: string,
  updates: Record<string, string>
): Promise<void> {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const sets = entries.map(([col]) => `${col} = ?`).join(', ');
  await sql.run(
    `UPDATE ${DEVICES_TABLE.tableName} SET ${sets} WHERE ${DeviceCol.id} = ?`,
    [...entries.map(([, v]) => v), deviceId]
  );
}

/**
 * Ensures a `devices` row exists and refreshes last-seen + changed metadata.
 * Snapshot values are collected on the client (expo/platform); shared stays pure.
 */
export const ensureDeviceWrite = defineWrite<EnsureDeviceInput, void>({
  name: 'auth.device.ensure',
  parseInput: parseEnsureDeviceInput,
  authorize: async (ctx, input) => {
    const idError = idMatches(
      input.deviceId,
      ctx.deviceId,
      'AUTH_DEVICE_ID_MISMATCH'
    );
    if (idError !== null) return idError;
    return ok(undefined);
  },
  execute: async (_ctx, input, sql) => {
    const rows = await sql.query<DeviceRow>(
      `SELECT * FROM ${DEVICES_TABLE.tableName} WHERE ${DeviceCol.id} = ? LIMIT 1`,
      [input.deviceId]
    );
    const row = rows[0];
    const now = new Date().toISOString();
    if (!isDeviceRowComplete(row, input.deviceId)) {
      await insertDeviceRow(sql, input.deviceId, now, input.snapshot);
      return ok(undefined);
    }
    await updateDeviceRow(
      sql,
      input.deviceId,
      buildDeviceUpdates(row as DeviceRow, input.snapshot, now)
    );
    return ok(undefined);
  },
});
