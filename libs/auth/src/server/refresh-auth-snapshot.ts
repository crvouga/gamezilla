import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  DEVICES_TABLE,
  DeviceCol,
} from '@libs/auth/shared/auth-tables';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  readPrimaryEmailFromAuthSnapshot,
  upsertAuthUserSnapshot,
} from './entity-store-sql';
import { upsertExternalAccount } from './external-accounts-sql';

/**
 * Idempotent server-side upsert run from `POST /auth/refresh`. Given a
 * resolved `accountId` (users.id) plus the client's device snapshot, mirrors
 * the auth provider user into entity_store + external_accounts and binds
 * the device row.
 */
export async function refreshAuthSnapshot(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
  deviceId: string;
  deviceAttributes: Record<string, string | null>;
}): Promise<void> {
  const { sql, authServer, bearerToken, accountId, deviceId, deviceAttributes } =
    args;
  assertUuid(accountId, 'accountId must be UUID');
  assertDeviceId(deviceId);

  await upsertAuthUserFromBearer({ sql, authServer, bearerToken, accountId });
  await upsertDeviceRow({ sql, deviceId, userId: accountId, attributes: deviceAttributes });
}

async function upsertAuthUserFromBearer(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
}): Promise<void> {
  const { sql, authServer, bearerToken, accountId } = args;

  let session: Awaited<ReturnType<AuthServerPort['verifySessionToken']>> = null;
  try {
    session = await authServer.verifySessionToken(bearerToken);
  } catch {
    session = null;
  }
  if (session === null) return;

  let snapshot: Record<string, unknown> | null = null;
  try {
    snapshot = await authServer.getUserSnapshot(session.externalUserId);
  } catch {
    snapshot = null;
  }
  const data = snapshot ?? { id: session.externalUserId };
  const email =
    session.email ?? readPrimaryEmailFromAuthSnapshot(data) ?? undefined;

  await upsertExternalAccount(sql, {
    userId: accountId,
    provider: authServer.providerLabel,
    externalId: session.externalUserId,
    metadata: email === undefined ? {} : { email },
  });
  await upsertAuthUserSnapshot(sql, {
    externalUserId: session.externalUserId,
    ownerId: accountId,
    data,
  });
}

type DeviceRow = Record<string, unknown>;

async function upsertDeviceRow(args: {
  sql: SqlClient;
  deviceId: string;
  userId: string;
  attributes: Record<string, string | null>;
}): Promise<void> {
  const { sql, deviceId, userId, attributes } = args;
  const rows = await sql.query<DeviceRow>(
    `SELECT * FROM ${DEVICES_TABLE.tableName} WHERE ${DeviceCol.id} = ? LIMIT 1`,
    [deviceId]
  );
  const existing = rows[0];
  const now = new Date().toISOString();

  if (existing === undefined) {
    const cols: string[] = [
      DeviceCol.id,
      DeviceCol.userId,
      DeviceCol.createdAt,
      DeviceCol.firstSeenAt,
      DeviceCol.lastSeenAt,
    ];
    const vals: unknown[] = [deviceId, userId, now, now, now];
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null) continue;
      cols.push(key);
      vals.push(value);
    }
    const placeholders = cols.map(() => '?').join(', ');
    await sql.run(
      `INSERT INTO ${DEVICES_TABLE.tableName} (${cols.join(', ')})
       VALUES (${placeholders})`,
      vals
    );
    return;
  }

  const existingFirst = readNullableString(existing[DeviceCol.firstSeenAt]);
  const created = readNullableString(existing[DeviceCol.createdAt]);
  const updates: Record<string, string> = {
    [DeviceCol.userId]: userId,
    [DeviceCol.lastSeenAt]: now,
    ...(existingFirst === null
      ? { [DeviceCol.firstSeenAt]: created !== null ? created : now }
      : {}),
  };
  for (const [key, next] of Object.entries(attributes)) {
    if (next === null) continue;
    if (existing[key] !== next) {
      updates[key] = next;
    }
  }
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const sets = entries.map(([col]) => `${col} = ?`).join(', ');
  await sql.run(
    `UPDATE ${DEVICES_TABLE.tableName} SET ${sets} WHERE ${DeviceCol.id} = ?`,
    [...entries.map(([, v]) => v), deviceId]
  );
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
