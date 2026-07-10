import { assertDeviceId } from '../shared';
import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  return null;
}

function androidVersionCodeString(raw: unknown): string | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

function resolveAppBuildNumber(): string | null {
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  if (typeof iosBuild === 'string' && iosBuild.trim().length > 0) {
    return iosBuild.trim();
  }
  return androidVersionCodeString(Constants.expoConfig?.android?.versionCode);
}

function readWebUserAgent(): string | null {
  if (Platform.OS !== 'web') return null;
  if (typeof globalThis === 'undefined') return null;
  if (!('navigator' in globalThis) || globalThis.navigator === undefined) {
    return null;
  }
  if (typeof globalThis.navigator.userAgent !== 'string') return null;
  return normString(globalThis.navigator.userAgent);
}

function collectDeviceSnapshot(): Record<string, string | null> {
  return {
    [DeviceCol.platform]: Platform.OS,
    [DeviceCol.osName]: normString(Device.osName),
    [DeviceCol.osVersion]: normString(Device.osVersion),
    [DeviceCol.deviceModelName]: normString(Device.modelName),
    [DeviceCol.deviceBrand]: normString(Device.brand),
    [DeviceCol.deviceName]: normString(Constants.deviceName),
    [DeviceCol.appVersion]: normString(Constants.expoConfig?.version),
    [DeviceCol.appBuildNumber]: resolveAppBuildNumber(),
    [DeviceCol.userAgent]: readWebUserAgent(),
  };
}

type DeviceRow = Record<string, unknown>;

function isDeviceRowComplete(row: DeviceRow | undefined, deviceId: string): boolean {
  if (row === undefined) return false;
  return row[DeviceCol.id] === deviceId && typeof row[DeviceCol.createdAt] === 'string';
}

function snapshotDiffers(
  stored: DeviceRow,
  snapshot: ReturnType<typeof collectDeviceSnapshot>,
  key: string
): boolean {
  const prev = normString(stored[key]);
  const next = snapshot[key];
  if (prev === null && next === null) return false;
  if (prev === null || next === null) return prev !== next;
  return prev !== next;
}

function buildInsertDeviceArgs(
  deviceId: string,
  now: string,
  snapshot: ReturnType<typeof collectDeviceSnapshot>
): { cols: string[]; vals: unknown[] } {
  const cols: string[] = [DeviceCol.id, DeviceCol.createdAt, DeviceCol.firstSeenAt, DeviceCol.lastSeenAt];
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
  snapshot: ReturnType<typeof collectDeviceSnapshot>,
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
  snapshot: ReturnType<typeof collectDeviceSnapshot>
): Promise<void> {
  const { cols, vals } = buildInsertDeviceArgs(deviceId, now, snapshot);
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
 * Ensures a `devices` row exists locally with id + created_at (first launch),
 * then on every launch refreshes `last_seen_at` and any changed device metadata.
 */
export async function ensureDeviceEntity(
  sql: SqlClient,
  deviceId: string
): Promise<void> {
  assertDeviceId(deviceId);

  const rows = await sql.query<DeviceRow>(
    `SELECT * FROM ${DEVICES_TABLE.tableName} WHERE ${DeviceCol.id} = ? LIMIT 1`,
    [deviceId]
  );
  const row = rows[0];
  const now = new Date().toISOString();
  const snapshot = collectDeviceSnapshot();

  if (!isDeviceRowComplete(row, deviceId)) {
    await insertDeviceRow(sql, deviceId, now, snapshot);
    return;
  }

  assert.ok(row !== undefined, 'device row must exist after completeness check');
  await updateDeviceRow(sql, deviceId, buildDeviceUpdates(row, snapshot, now));
}
