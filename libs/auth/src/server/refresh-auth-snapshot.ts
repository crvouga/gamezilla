import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { join, raw, sql, type Value } from '@pkgs/sql';

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
  const rows = await db.query(sql<DeviceRow>`
    SELECT *
    FROM devices
    WHERE id = ${deviceId}
    LIMIT 1
  `);
  const existing = rows[0];
  const now = new Date().toISOString();

  if (existing === undefined) {
    const cols: string[] = [
      'id',
      'user_id',
      'created_at',
      'first_seen_at',
      'last_seen_at',
    ];
    const vals: (string | null)[] = [deviceId, userId, now, now, now];
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null) continue;
      cols.push(key);
      vals.push(value);
    }
    await db.run(sql<void>`
      INSERT INTO devices (${raw(cols.join(', '))})
      VALUES ${join(vals as Value[], ', ', '(', ')')}
    `);
    return;
  }

  const existingFirst = readNullableString(existing['first_seen_at']);
  const created = readNullableString(existing['created_at']);
  const updates: Record<string, string> = {
    user_id: userId,
    last_seen_at: now,
    ...(existingFirst === null
      ? { first_seen_at: created !== null ? created : now }
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
  const sets = join(
    entries.map(([column, value]) => sql<void>`${raw(column)} = ${value}`)
  );
  await db.run(sql<void>`
    UPDATE devices
    SET ${sets}
    WHERE id = ${deviceId}
  `);
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
