import type { AuthServerPort } from '@pkgs/auth-shared/auth-server-port';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

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
