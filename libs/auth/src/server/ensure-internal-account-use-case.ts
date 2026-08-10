import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { AccountProvisioningService } from './account-provisioning';

export class EnsureInternalAccountUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io,
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
        this.io,
        this.authServer
      ).ensureInternalAccountIdForExternalUser(args);
    });
  }
}
