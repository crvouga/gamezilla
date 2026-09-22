import type { AuthServerPort } from '@pkgs/auth/server';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { AccountProvisioningService } from './account-provisioning';

export class EnsureInternalAccountUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    },
    private readonly authServer: AuthServerPort
  ) {}

  async execute(args: {
    externalUserId: string;
    upgradeUserId?: string | null;
    now?: () => number;
    createId?: CreateId;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      return new AccountProvisioningService(
        tx,
        this.time,
        this.authServer
      ).ensureInternalAccountIdForExternalUser(args);
    });
  }
}
