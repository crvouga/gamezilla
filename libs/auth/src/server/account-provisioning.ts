import { assertUuid } from '@libs/auth/shared/device-id';
import {
  AccountCol,
  AccountProviderCol,
  ACCOUNTS_TABLE,
  ACCOUNT_PROVIDERS_TABLE,
} from '@libs/auth/shared/auth-tables';
import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';

type ProviderRow = {
  readonly id: string;
  readonly account_id: string;
};

async function findAuthAccountProvider(
  sql: SqlClient,
  provider: string,
  externalUserId: string
): Promise<ProviderRow | undefined> {
  const rows = await sql.query<ProviderRow>(
    `SELECT id, account_id FROM ${ACCOUNT_PROVIDERS_TABLE.tableName}
     WHERE ${AccountProviderCol.provider} = ? AND ${AccountProviderCol.providerUserId} = ?
     LIMIT 1`,
    [provider, externalUserId]
  );
  return rows[0];
}

async function insertAccountWithProvider(args: {
  sql: SqlClient;
  externalUserId: string;
  email: string | null;
  accountId: string;
  provider: string;
}): Promise<void> {
  const { sql, externalUserId, email, accountId, provider } = args;
  const now = new Date().toISOString();
  const providerId = crypto.randomUUID();
  await sql.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO ${ACCOUNTS_TABLE.tableName}
       (${AccountCol.id}, ${AccountCol.createdAt})
       VALUES (?, ?)`,
      [accountId, now]
    );
    await tx.run(
      `INSERT INTO ${ACCOUNT_PROVIDERS_TABLE.tableName}
       (${AccountProviderCol.id}, ${AccountProviderCol.accountId}, ${AccountProviderCol.provider},
        ${AccountProviderCol.providerUserId}, ${AccountProviderCol.email}, ${AccountProviderCol.linkedAt})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        providerId,
        accountId,
        provider,
        externalUserId,
        email,
        now,
      ]
    );
  });
}

export async function ensureInternalAccountIdForExternalUser(args: {
  sql: SqlClient;
  externalUserId: string;
  email: string | null;
  provider: string;
}): Promise<string> {
  const { sql, externalUserId, email, provider } = args;
  const existing = await findAuthAccountProvider(sql, provider, externalUserId);
  if (existing !== undefined) {
    const aid = existing.account_id;
    assert.string(aid, 'accountProvider must have account_id');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const accountId = crypto.randomUUID();
  await insertAccountWithProvider({
    sql,
    externalUserId,
    email,
    accountId,
    provider,
  });
  return accountId;
}
