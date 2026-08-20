import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { Clock } from '@pkgs/clock';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { assertUuid } from '../shared/auth/device-id';

import { AnonUserService } from './anon-user-service';
import { ExternalAccountRepository } from './external-account-repository';

/** Transaction-scoped account provisioning. Open a transaction in a use case. */
export class AccountProvisioningService {
  constructor(
    private readonly tx: SqlTx,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    },
    private readonly authServer: AuthServerPort
  ) {}

  /**
   * Resolves the immutable internal `users.id` for a primary-auth external user
   * (caller must be inside a transaction).
   *
   * 1. Existing `auth_external_accounts` link → that `users.id` (switch).
   * 2. Else if `upgradeUserId` is an anon user → upgrade in place.
   * 3. Else mint a new non-anon `users` row.
   *
   * Concurrent callers race on unique `(provider, external_id)`;
   * {@link ExternalAccountRepository.insertExternalAccountOrGet} resolves the
   * winner via `ON CONFLICT`.
   */
  async ensureInternalAccountIdForExternalUser(args: {
    externalUserId: string;
    /** Device-bound anon user to upgrade when this external id is new. */
    upgradeUserId?: string | null;
    now?: () => number;
    createId?: CreateId;
  }): Promise<string> {
    const { externalUserId, upgradeUserId } = args;
    const now = args.now ?? this.time.clock.now;
    const createId = args.createId ?? this.time.createId;
    const provider = this.authServer.providerLabel;

    const externalAccounts = new ExternalAccountRepository(this.tx);
    const anonUsers = new AnonUserService(this.tx, this.time);

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
