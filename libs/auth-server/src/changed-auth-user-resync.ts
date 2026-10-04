/**
 * The auth service changed a user's sign-in methods on its own (a provider
 * deleted a linked account, switched its email forwarding). Re-mirror that
 * user's methods into `auth_external_accounts` so the change syncs to every
 * device, the way `/identity/refresh` does for a change the device made.
 *
 * An account left with no sign-in method has had every session ended by the
 * auth service, so no device is signed into it any more: its devices'
 * memberships are tombstoned in the same transaction, and the push that
 * follows takes them off the account on every device still listening.
 */

import { AccountDeviceMembership } from '@libs/auth-shared/account-device-membership';
import { ExternalAccountRepository } from '@libs/auth-shared/external-account-repository';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { LinkedIdentityMirror } from './linked-identity-mirror';

export class ChangedAuthUserResync {
  constructor(
    private readonly db: SqlClient,
    private readonly authServer: AuthServerPort,
    private readonly time: {
      readonly now: () => number;
      readonly createId: CreateId;
    }
  ) {}

  /** The product account whose methods were re-mirrored, or `null` when none. */
  async resync(externalUserId: string): Promise<string | null> {
    const accountId = await new ExternalAccountRepository(
      this.db
    ).findUserIdByProviderExternalId(this.authServer.provider, externalUserId);
    if (accountId === null) return null;
    const user = await this.authServer.getUser(externalUserId);
    // Only a real read lists sign-in methods; an unknown user must not
    // tombstone the ones already mirrored.
    if (user === null) return null;
    await this.db.transaction(async (tx) => {
      await new LinkedIdentityMirror(tx, this.time).mirror(
        accountId,
        user.identities
      );
      if (user.identities.length === 0) {
        await new AccountDeviceMembership(tx, this.time).endAll(accountId);
      }
    });
    return accountId;
  }
}
