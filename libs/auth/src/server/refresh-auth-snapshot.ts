import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  AccountProviderCol,
  AccountSessionCol,
  ACCOUNT_PROVIDERS_TABLE,
  ACCOUNT_SESSIONS_TABLE,
  DEVICES_TABLE,
  DeviceCol,
} from '@libs/auth/shared/auth-tables';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Idempotent server-side upsert run from `POST /auth/refresh`. Given a
 * resolved `accountId` (bearer + device pair) plus the client's device snapshot
 * + posted session expiry, makes the auth tables match the latest server state.
 */
export async function refreshAuthSnapshot(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
  deviceId: string;
  deviceAttributes: Record<string, string | null>;
  accountSessionExpiresAt: string;
}): Promise<void> {
  const {
    sql,
    authServer,
    bearerToken,
    accountId,
    deviceId,
    deviceAttributes,
    accountSessionExpiresAt,
  } = args;
  assertUuid(accountId, 'accountId must be UUID');
  assertDeviceId(deviceId);

  await upsertLinkedProviders({ sql, authServer, bearerToken, accountId });
  await upsertAccountSession({
    sql,
    accountId,
    deviceId,
    token: bearerToken,
    expiresAt: accountSessionExpiresAt,
  });
  await upsertDeviceRow({ sql, deviceId, attributes: deviceAttributes });
}

type ProviderRow = {
  readonly id: string;
  readonly provider: string | null;
  readonly provider_user_id: string | null;
  readonly email: string | null;
  readonly linked_at: string | null;
};

async function upsertLinkedProviders(args: {
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

  let email = session.email;
  if (email === null) {
    try {
      const profile = await authServer.getUserProfile(session.externalUserId);
      email = profile?.email ?? null;
    } catch {
      email = null;
    }
  }

  const existing = await readProviderRowsForAccount(sql, accountId);
  const linkedAt = new Date().toISOString();
  await ensureProviderRow({
    sql,
    accountId,
    provider: authServer.providerLabel,
    providerUserId: session.externalUserId,
    email,
    linkedAt,
    existing,
  });
}

async function readProviderRowsForAccount(
  sql: SqlClient,
  accountId: string
): Promise<readonly ProviderRow[]> {
  return sql.query<ProviderRow>(
    `SELECT id, provider, provider_user_id, email, linked_at
     FROM ${ACCOUNT_PROVIDERS_TABLE.tableName}
     WHERE ${AccountProviderCol.accountId} = ?
     LIMIT 100`,
    [accountId]
  );
}

function findExistingProvider(
  existing: readonly ProviderRow[],
  provider: string,
  providerUserId: string
): ProviderRow | undefined {
  return existing.find(
    (row) =>
      row.provider === provider && row.provider_user_id === providerUserId
  );
}

async function ensureProviderRow(args: {
  sql: SqlClient;
  accountId: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  linkedAt: string;
  existing: readonly ProviderRow[];
}): Promise<void> {
  const { sql, accountId, provider, providerUserId, email, linkedAt, existing } =
    args;
  const found = findExistingProvider(existing, provider, providerUserId);

  if (found === undefined) {
    await sql.run(
      `INSERT INTO ${ACCOUNT_PROVIDERS_TABLE.tableName}
       (${AccountProviderCol.id}, ${AccountProviderCol.accountId}, ${AccountProviderCol.provider},
        ${AccountProviderCol.providerUserId}, ${AccountProviderCol.email}, ${AccountProviderCol.linkedAt})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [globalThis.crypto.randomUUID(), accountId, provider, providerUserId, email, linkedAt]
    );
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (email !== null && found.email !== email) {
    updates.push(`${AccountProviderCol.email} = ?`);
    params.push(email);
  }
  const currentLinkedAt = readNullableString(found.linked_at);
  if (currentLinkedAt === null) {
    updates.push(`${AccountProviderCol.linkedAt} = ?`);
    params.push(linkedAt);
  }
  if (updates.length === 0) return;
  params.push(found.id);
  await sql.run(
    `UPDATE ${ACCOUNT_PROVIDERS_TABLE.tableName}
     SET ${updates.join(', ')}
     WHERE ${AccountProviderCol.id} = ?`,
    params
  );
}

type SessionRow = {
  readonly id: string;
  readonly token: string;
  readonly expires_at: string | null;
};

async function upsertAccountSession(args: {
  sql: SqlClient;
  accountId: string;
  deviceId: string;
  token: string;
  expiresAt: string;
}): Promise<void> {
  const { sql, accountId, deviceId, token, expiresAt } = args;
  const existing = await findAccountSessionRow(sql, accountId, deviceId);
  const now = new Date().toISOString();
  if (existing === undefined) {
    await sql.run(
      `INSERT INTO ${ACCOUNT_SESSIONS_TABLE.tableName}
       (${AccountSessionCol.id}, ${AccountSessionCol.deviceId}, ${AccountSessionCol.accountId},
        ${AccountSessionCol.token}, ${AccountSessionCol.expiresAt}, ${AccountSessionCol.createdAt})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [globalThis.crypto.randomUUID(), deviceId, accountId, token, expiresAt, now]
    );
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (existing.token !== token) {
    updates.push(`${AccountSessionCol.token} = ?`);
    params.push(token);
  }
  if (existing.expires_at !== expiresAt) {
    updates.push(`${AccountSessionCol.expiresAt} = ?`);
    params.push(expiresAt);
  }
  if (updates.length === 0) return;
  params.push(existing.id);
  await sql.run(
    `UPDATE ${ACCOUNT_SESSIONS_TABLE.tableName}
     SET ${updates.join(', ')}
     WHERE ${AccountSessionCol.id} = ?`,
    params
  );
}

async function findAccountSessionRow(
  sql: SqlClient,
  accountId: string,
  deviceId: string
): Promise<SessionRow | undefined> {
  const rows = await sql.query<SessionRow>(
    `SELECT id, token, expires_at FROM ${ACCOUNT_SESSIONS_TABLE.tableName}
     WHERE ${AccountSessionCol.accountId} = ? AND ${AccountSessionCol.deviceId} = ?
     LIMIT 1`,
    [accountId, deviceId]
  );
  return rows[0];
}

type DeviceRow = Record<string, unknown>;

async function upsertDeviceRow(args: {
  sql: SqlClient;
  deviceId: string;
  attributes: Record<string, string | null>;
}): Promise<void> {
  const { sql, deviceId, attributes } = args;
  const rows = await sql.query<DeviceRow>(
    `SELECT * FROM ${DEVICES_TABLE.tableName} WHERE ${DeviceCol.id} = ? LIMIT 1`,
    [deviceId]
  );
  const existing = rows[0];
  const now = new Date().toISOString();

  if (existing === undefined) {
    const cols: string[] = [DeviceCol.id, DeviceCol.createdAt, DeviceCol.firstSeenAt, DeviceCol.lastSeenAt];
    const vals: unknown[] = [deviceId, now, now, now];
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
