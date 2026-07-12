import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from '@libs/db/shared/external-accounts-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

export { EXTERNAL_ACCOUNTS_TABLE, USERS_TABLE };

type UserIdRow = { readonly user_id: string };

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function findUserIdByProviderExternalId(
  sql: SqlClient,
  provider: string,
  externalId: string
): Promise<string | null> {
  const rows = await sql.query<UserIdRow>(
    `SELECT ${ExternalAccountCol.userId} AS user_id
     FROM ${EXTERNAL_ACCOUNTS_TABLE}
     WHERE ${ExternalAccountCol.provider} = ? AND ${ExternalAccountCol.externalId} = ?
     LIMIT 1`,
    [provider, externalId]
  );
  const userId = rows[0]?.user_id;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

export async function readExternalAccountId(
  sql: SqlClient,
  userId: string,
  provider: string
): Promise<string | null> {
  const rows = await sql.query<{ external_id: string | null }>(
    `SELECT ${ExternalAccountCol.externalId} AS external_id
     FROM ${EXTERNAL_ACCOUNTS_TABLE}
     WHERE ${ExternalAccountCol.userId} = ? AND ${ExternalAccountCol.provider} = ?
     LIMIT 1`,
    [userId, provider]
  );
  const externalId = rows[0]?.external_id;
  return typeof externalId === 'string' && externalId.length > 0
    ? externalId
    : null;
}

export async function insertUser(
  sql: SqlClient,
  userId: string,
  createdAt?: string
): Promise<void> {
  const now = createdAt ?? new Date().toISOString();
  await sql.run(
    `INSERT INTO ${USERS_TABLE} (${UserTableCol.id}, ${UserTableCol.createdAt})
     VALUES (?, ?)
     ON CONFLICT (${UserTableCol.id}) DO NOTHING`,
    [userId, now]
  );
}

export async function upsertExternalAccount(
  sql: SqlClient,
  args: {
    readonly userId: string;
    readonly provider: string;
    readonly externalId: string;
    readonly metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const metadataJson = JSON.stringify(args.metadata ?? {});
  await sql.run(
    `INSERT INTO ${EXTERNAL_ACCOUNTS_TABLE}
     (${ExternalAccountCol.userId}, ${ExternalAccountCol.provider},
      ${ExternalAccountCol.externalId}, ${ExternalAccountCol.metadata},
      ${ExternalAccountCol.createdAt})
     VALUES (?, ?, ?, ?::jsonb, ?)
     ON CONFLICT (${ExternalAccountCol.provider}, ${ExternalAccountCol.externalId}) DO UPDATE SET
       ${ExternalAccountCol.userId} = excluded.${ExternalAccountCol.userId},
       ${ExternalAccountCol.metadata} = excluded.${ExternalAccountCol.metadata}`,
    [args.userId, args.provider, args.externalId, metadataJson, now]
  );
}

export async function findUserIdByPrimaryAuthExternalId(
  sql: SqlClient,
  primaryAuthProvider: string,
  externalUserId: string
): Promise<string | null> {
  return findUserIdByProviderExternalId(
    sql,
    primaryAuthProvider,
    externalUserId
  );
}

export async function readMetadataEmail(
  metadata: Record<string, unknown>
): Promise<string | null> {
  const raw = metadata['email'];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export { parseMetadata };
