import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

function trimmedOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Human label for a device: name → "brand model" → short id fallback. */
function formatLabel(args: {
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly deviceBrand: string | null;
  readonly deviceModelName: string | null;
}): string {
  const name = trimmedOrNull(args.deviceName);
  if (name !== null) return name;
  const model = [
    trimmedOrNull(args.deviceBrand),
    trimmedOrNull(args.deviceModelName),
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
  if (model.length > 0) return model;
  return `Device ${args.deviceId.slice(0, 8)}\u2026`;
}

/**
 * Resolve a device label server-side from the synced `devices` row. Used by
 * inbox-driven joins, which have the device id but not the client snapshot.
 */
export async function resolveDeviceLabelFromDb(
  sql: SqlClient,
  deviceId: string
): Promise<string> {
  const rows = await sql.query<{
    readonly device_name: string | null;
    readonly device_brand: string | null;
    readonly device_model_name: string | null;
  }>(
    `SELECT ${DeviceCol.deviceName} AS device_name,
            ${DeviceCol.deviceBrand} AS device_brand,
            ${DeviceCol.deviceModelName} AS device_model_name
     FROM ${DEVICES_TABLE.tableName}
     WHERE ${DeviceCol.id} = ?
     LIMIT 1`,
    [deviceId]
  );
  const row = rows[0];
  return formatLabel({
    deviceId,
    deviceName: row?.device_name ?? null,
    deviceBrand: row?.device_brand ?? null,
    deviceModelName: row?.device_model_name ?? null,
  });
}
