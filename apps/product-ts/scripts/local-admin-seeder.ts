import { AccountProvisioningService } from '@libs/auth-shared-ts/account-provisioning';
import { HARNESS_AUTH_SECRET } from '@libs/sub-shared-ts/harness-constants';
import { createAuthServerAdapter } from '@pkgs/auth-inhouse-server-ts/create-auth-server-adapter';
import { IdentityLinker } from '@pkgs/auth-inhouse-server-ts/identity-linker';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type {
  DatabaseSeeder,
  DatabaseSeederContext,
} from '@pkgs/db-migrate-shared-ts/database-seeder';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { LocalAdminIdentity } from './local-admin-accounts';

/** Local fixture accounts use ordinary identity linking and account provisioning. */
export class LocalAdminSeeder implements DatabaseSeeder {
  accountIds: readonly string[] = [];

  constructor(
    private readonly ports: {
      readonly clock: Clock;
      readonly createId: CreateId;
    },
    private readonly identities: readonly LocalAdminIdentity[]
  ) {}

  async seed(ctx: DatabaseSeederContext): Promise<void> {
    const auth = createAuthServerAdapter({
      getSql: () => ctx.sqlClient,
      ...this.ports,
      secret: HARNESS_AUTH_SECRET,
    });
    this.accountIds = await ctx.sqlClient.transaction(async (tx) => {
      const linker = new IdentityLinker(tx, {
        ...this.ports,
        secret: HARNESS_AUTH_SECRET,
      });
      const accounts = new AccountProvisioningService(tx, this.ports, auth);
      const accountIds: string[] = [];
      for (const identity of this.identities) {
        const outcome = await linker.signIn(
          {
            ...identity,
            emailVerified: true,
            isPrivateEmail: false,
            picture: null,
            accessToken: null,
            refreshToken: null,
          },
          null
        );
        if (outcome.kind !== 'signed_in')
          throw new Error(`Local admin ${identity.email}: ${outcome.kind}`);
        const id = await accounts.ensureInternalAccountIdForExternalUser({
          externalUserId: outcome.userId,
        });
        if (!accountIds.includes(id)) accountIds.push(id);
      }
      return accountIds;
    });
    ctx.logger.info('local admin accounts seeded', {
      accounts: [...new Set(this.identities.map((identity) => identity.email))],
    });
  }
}
