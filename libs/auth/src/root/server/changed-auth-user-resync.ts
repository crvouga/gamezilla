/**
 * The auth service changed a user's sign-in methods on its own (a provider
 * deleted a linked account, switched its email forwarding). Re-mirror that
 * user's methods into `auth_external_accounts` so the change syncs to every
 * device, the way `/identity/refresh` does for a change the device made.
 */

import type { AuthServerPort } from '@pkgs/auth/server';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { ExternalAccountRepository } from '../../public/external-account-repository';
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
    await new LinkedIdentityMirror(this.db, this.time).mirror(
      accountId,
      user.identities
    );
    return accountId;
  }
}
