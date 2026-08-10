import { assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { clearUserAnonFlag, readUserAnonState } from './anon-user-ensure';
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
 *
 * 1. Existing `external_accounts` link → that `users.id` (switch).
 * 2. Else if `upgradeUserId` is an anon user → upgrade in place.
 * 3. Else mint a new non-anon `users` row.
 */
export async function ensureInternalAccountIdForExternalUser(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  externalUserId: string;
  /** Device-bound anon user to upgrade when this external id is new. */
  upgradeUserId?: string | null;
  now: () => number;
  createId: CreateId;
}): Promise<string> {
  const {
    sql: db,
    authServer,
    externalUserId,
    upgradeUserId,
    now,
    createId,
  } = args;
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

    const candidateUserId = await resolveCandidateUserId(
      tx,
      upgradeUserId,
      createId
    );
    const nowIso = new Date(now()).toISOString();
    if (candidateUserId === upgradeUserId && upgradeUserId !== null) {
      await clearUserAnonFlag(tx, candidateUserId, now);
    } else {
      await insertUser({
        db: tx,
        userId: candidateUserId,
        now,
        createId,
        createdAt: nowIso,
        isAnon: false,
      });
    }

    const ownerId = await insertExternalAccountOrGet(tx, {
      userId: candidateUserId,
      provider,
      externalId: externalUserId,
      metadata: {},
      now,
      createId,
    });
    assertUuid(ownerId, 'userId must be UUID');

    // Race: another txn linked the external id to a different user.
    if (ownerId !== candidateUserId && candidateUserId === upgradeUserId) {
      // Leave the anon row upgraded but unlinked; canonical owner wins.
    }

    return ownerId;
  });
}

async function resolveCandidateUserId(
  tx: SqlClient,
  upgradeUserId: string | null | undefined,
  createId: CreateId
): Promise<string> {
  if (typeof upgradeUserId === 'string' && upgradeUserId.length > 0) {
    assertUuid(upgradeUserId, 'upgradeUserId must be UUID');
    const state = await readUserAnonState(tx, upgradeUserId);
    if (state.exists && state.isAnon) {
      return upgradeUserId;
    }
  }
  return createId();
}
