import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { Value } from '@pkgs/sql-shared/sql';
import sql, { join, raw } from '@pkgs/sql-shared/sql';
import { managedInsertColumns } from '@pkgs/sync-engine-shared/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

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
  snapshot: DeviceSnapshot,
  createId: CreateId
): { cols: string[]; vals: (string | null)[] } {
  const managed = managedInsertColumns(
    createId,
    () => new Date(now).getTime(),
    deviceId
  );
  const cols: string[] = [
    'id',
    'created_at',
    'updated_at',
    'first_seen_at',
    'last_seen_at',
  ];
  const vals: (string | null)[] = [
    managed.id,
    managed.created_at,
    managed.updated_at,
    now,
    now,
  ];
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
    updated_at: now,
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

/**
 * Ensures a `devices` row exists and refreshes last-seen + changed metadata.
 * Snapshot values are collected on the client (device platform); shared stays pure.
 */
export class DeviceWriteRepository {
  constructor(private readonly db: SqlTx) {}

  async ensureRow(args: {
    readonly deviceId: string;
    readonly snapshot: DeviceSnapshot;
    readonly now: () => number;
    readonly createId: CreateId;
  }): Promise<void> {
    const { deviceId, snapshot, now, createId } = args;
    const rows = await this.db.query(sql<DeviceRow>`
      SELECT *
      FROM auth_devices
      WHERE id = ${deviceId}
      LIMIT 1
    `);
    const row = rows[0];
    const nowIso = new Date(now()).toISOString();
    if (!isDeviceRowComplete(row, deviceId)) {
      await this.insertDeviceRow({ deviceId, now: nowIso, snapshot, createId });
      return;
    }
    await this.updateDeviceRow(
      deviceId,
      buildDeviceUpdates(row as DeviceRow, snapshot, nowIso)
    );
  }

  private async insertDeviceRow(args: {
    readonly deviceId: string;
    readonly now: string;
    readonly snapshot: DeviceSnapshot;
    readonly createId: CreateId;
  }): Promise<void> {
    const { deviceId, now, snapshot, createId } = args;
    const { cols, vals } = buildInsertArgs(deviceId, now, snapshot, createId);
    await this.db.run(sql<void>`
      INSERT INTO auth_devices (${raw(cols.join(', '))})
      VALUES ${join(vals as Value[], ', ', '(', ')')}
    `);
  }

  private async updateDeviceRow(
    deviceId: string,
    updates: Record<string, string>
  ): Promise<void> {
    const entries = Object.entries(updates);
    if (entries.length === 0) return;
    const sets = join(
      entries.map(([column, value]) => sql<void>`${raw(column)} = ${value}`)
    );
    await this.db.run(sql<void>`
      UPDATE auth_devices
      SET ${sets}
      WHERE id = ${deviceId}
    `);
  }
}
