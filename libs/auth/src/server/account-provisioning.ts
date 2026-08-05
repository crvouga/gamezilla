import { assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { upsertAuthUserSnapshot } from './entity-store-sql';
import {
  findUserIdByPrimaryAuthExternalId,
  insertExternalAccountOrGet,
  insertUser,
} from './external-accounts-sql';

/**
 * Best-effort Postgres advisory lock. No-ops on SQLite (unit tests) where
 * `pg_advisory_xact_lock` / `hashtext` are unavailable.
 */
async function acquireExternalUserAdvisoryLock(
  tx: SqlClient,
  lockKey: string
): Promise<void> {
  try {
    await tx.run(sql<void>`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes('no such function') ||
      message.includes('pg_advisory_xact_lock') ||
      message.includes('hashtext')
    ) {
      return;
    }
    throw e;
  }
}

/**
 * Resolves the immutable internal `users.id` for a primary-auth external user.
 * Concurrent callers serialize on an advisory lock and adopt the winning link
 * — never mint a second account that steals the external identity.
 */
export async function ensureInternalAccountIdForExternalUser(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  externalUserId: string;
}): Promise<string> {
  const { sql: db, authServer, externalUserId } = args;
  const provider = authServer.providerLabel;
  const lockKey = `${provider}:${externalUserId}`;

  return db.transaction(async (tx) => {
    await acquireExternalUserAdvisoryLock(tx, lockKey);

    const existingUserId = await findUserIdByPrimaryAuthExternalId(
      tx,
      provider,
      externalUserId
    );
    if (existingUserId !== null) {
      assertUuid(existingUserId, 'userId must be UUID');
      return existingUserId;
    }

    const snapshot = await authServer.getUserSnapshot(externalUserId);
    const candidateUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await insertUser(tx, candidateUserId, now);
    const ownerId = await insertExternalAccountOrGet(tx, {
      userId: candidateUserId,
      provider,
      externalId: externalUserId,
      metadata: {},
    });
    assertUuid(ownerId, 'userId must be UUID');

    await upsertAuthUserSnapshot(tx, {
      externalUserId,
      ownerId,
      data: snapshot ?? { id: externalUserId },
    });
    return ownerId;
  });
}
