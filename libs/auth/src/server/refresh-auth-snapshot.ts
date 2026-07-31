import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import { DEVICES_TABLE, DeviceCol } from '@libs/db/shared/auth-tables';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sqlMap } from '@pkgs/sql';
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
  const {
    sql: db,
    authServer,
    bearerToken,
    accountId,
    deviceId,
    deviceAttributes,
  } = args;
  assertUuid(accountId, 'accountId must be UUID');
  assertDeviceId(deviceId);

  await upsertAuthUserFromBearer({ db, authServer, bearerToken, accountId });
  await upsertDeviceRow({
    db,
    deviceId,
    userId: accountId,
    attributes: deviceAttributes,
  });
}

async function upsertAuthUserFromBearer(args: {
  db: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
}): Promise<void> {
  const { db, authServer, bearerToken, accountId } = args;

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

  await upsertExternalAccount(db, {
    userId: accountId,
    provider: authServer.providerLabel,
    externalId: session.externalUserId,
    metadata: email === undefined ? {} : { email },
  });
  await upsertAuthUserSnapshot(db, {
    externalUserId: session.externalUserId,
    ownerId: accountId,
    data,
  });
}

type DeviceRow = Record<string, unknown>;

async function upsertDeviceRow(args: {
  db: SqlClient;
  deviceId: string;
  userId: string;
  attributes: Record<string, string | null>;
}): Promise<void> {
  const { db, deviceId, userId, attributes } = args;
  const rows = await db.query<DeviceRow>(
    sqlMap({
      from: DEVICES_TABLE.tableName,
      where: ['=', DeviceCol.id, deviceId],
      limit: 1,
    })
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
    const vals: (string | null)[] = [deviceId, userId, now, now, now];
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null) continue;
      cols.push(key);
      vals.push(value);
    }
    const values: Record<string, string | null> = {};
    cols.forEach((column, index) => {
      values[column] = vals[index] ?? null;
    });
    await db.run(sqlMap({ insertInto: DEVICES_TABLE.tableName, values }));
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
  await db.run(
    sqlMap({
      update: DEVICES_TABLE.tableName,
      set: updates,
      where: ['=', DeviceCol.id, deviceId],
    })
  );
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
