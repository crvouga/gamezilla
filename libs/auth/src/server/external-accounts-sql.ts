import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from '@libs/db/shared/external-accounts-tables';
import { col, sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export { EXTERNAL_ACCOUNTS_TABLE, USERS_TABLE };

type UserIdRow = { readonly user_id: string };

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function findUserIdByProviderExternalId(
  db: SqlClient,
  provider: string,
  externalId: string
): Promise<string | null> {
  const rows = await db.query<UserIdRow>(
    sqlMap({
      select: [[ExternalAccountCol.userId, 'user_id']],
      from: EXTERNAL_ACCOUNTS_TABLE,
      where: [
        'and',
        ['=', ExternalAccountCol.provider, provider],
        ['=', ExternalAccountCol.externalId, externalId],
      ],
      limit: 1,
    })
  );
  const userId = rows[0]?.user_id;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

export async function readExternalAccountId(
  db: SqlClient,
  userId: string,
  provider: string
): Promise<string | null> {
  const rows = await db.query<{ external_id: string | null }>(
    sqlMap({
      select: [[ExternalAccountCol.externalId, 'external_id']],
      from: EXTERNAL_ACCOUNTS_TABLE,
      where: [
        'and',
        ['=', ExternalAccountCol.userId, userId],
        ['=', ExternalAccountCol.provider, provider],
      ],
      limit: 1,
    })
  );
  const externalId = rows[0]?.external_id;
  return typeof externalId === 'string' && externalId.length > 0
    ? externalId
    : null;
}

export async function insertUser(
  db: SqlClient,
  userId: string,
  createdAt?: string
): Promise<void> {
  const now = createdAt ?? new Date().toISOString();
  await db.run(
    sqlMap({
      insertInto: USERS_TABLE,
      values: {
        [UserTableCol.id]: userId,
        [UserTableCol.createdAt]: now,
      },
      onConflict: { target: [UserTableCol.id], doNothing: true },
    })
  );
}

export async function upsertExternalAccount(
  db: SqlClient,
  args: {
    readonly userId: string;
    readonly provider: string;
    readonly externalId: string;
    readonly metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const metadataJson = JSON.stringify(args.metadata ?? {});
  await db.run(
    sqlMap({
      insertInto: EXTERNAL_ACCOUNTS_TABLE,
      values: {
        [ExternalAccountCol.userId]: args.userId,
        [ExternalAccountCol.provider]: args.provider,
        [ExternalAccountCol.externalId]: args.externalId,
        [ExternalAccountCol.metadata]: ['cast', metadataJson, 'jsonb'],
        [ExternalAccountCol.createdAt]: now,
      },
      onConflict: {
        target: [ExternalAccountCol.provider, ExternalAccountCol.externalId],
        set: {
          [ExternalAccountCol.userId]: col(
            `excluded.${ExternalAccountCol.userId}`
          ),
          [ExternalAccountCol.metadata]: col(
            `excluded.${ExternalAccountCol.metadata}`
          ),
        },
      },
    })
  );
}

export async function findUserIdByPrimaryAuthExternalId(
  db: SqlClient,
  primaryAuthProvider: string,
  externalUserId: string
): Promise<string | null> {
  return findUserIdByProviderExternalId(
    db,
    primaryAuthProvider,
    externalUserId
  );
}

export async function readMetadataEmail(
  metadata: Record<string, unknown>
): Promise<string | null> {
  const email = metadata['email'];
  return typeof email === 'string' && email.length > 0 ? email : null;
}

export { parseMetadata };
