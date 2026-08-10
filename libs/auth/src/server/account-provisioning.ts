import { assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { AnonUserService } from './anon-user-service';
import { ExternalAccountRepository } from './external-account-repository';

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

export class AccountProvisioningService {
  constructor(
    private readonly db: SqlClient,
    private readonly authServer: AuthServerPort
  ) {}

  /**
   * Resolves the immutable internal `users.id` for a primary-auth external user.
   *
   * 1. Existing `external_accounts` link → that `users.id` (switch).
   * 2. Else if `upgradeUserId` is an anon user → upgrade in place.
   * 3. Else mint a new non-anon `users` row.
   */
  async ensureInternalAccountIdForExternalUser(args: {
    externalUserId: string;
    /** Device-bound anon user to upgrade when this external id is new. */
    upgradeUserId?: string | null;
    now: () => number;
    createId: CreateId;
  }): Promise<string> {
    const { externalUserId, upgradeUserId, now, createId } = args;
    const provider = this.authServer.providerLabel;
    const lockKey = `${provider}:${externalUserId}`;

    return this.db.transaction(async (tx) => {
      await acquireExternalUserAdvisoryLock(tx, lockKey);

      const externalAccounts = new ExternalAccountRepository(tx);
      const anonUsers = new AnonUserService(tx);

      const existingUserId =
        await externalAccounts.findUserIdByPrimaryAuthExternalId(
          provider,
          externalUserId
        );
      if (existingUserId !== null) {
        assertUuid(existingUserId, 'userId must be UUID');
        return existingUserId;
      }

      const candidateUserId = await this.resolveCandidateUserId(
        anonUsers,
        upgradeUserId,
        createId
      );
      const nowIso = new Date(now()).toISOString();
      if (candidateUserId === upgradeUserId && upgradeUserId !== null) {
        await anonUsers.clearUserAnonFlag(candidateUserId, now);
      } else {
        await externalAccounts.insertUser({
          userId: candidateUserId,
          now,
          createId,
          createdAt: nowIso,
          isAnon: false,
        });
      }

      const ownerId = await externalAccounts.insertExternalAccountOrGet({
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

  private async resolveCandidateUserId(
    anonUsers: AnonUserService,
    upgradeUserId: string | null | undefined,
    createId: CreateId
  ): Promise<string> {
    if (typeof upgradeUserId === 'string' && upgradeUserId.length > 0) {
      assertUuid(upgradeUserId, 'upgradeUserId must be UUID');
      const state = await anonUsers.readUserAnonState(upgradeUserId);
      if (state.exists && state.isAnon) {
        return upgradeUserId;
      }
    }
    return createId();
  }
}
