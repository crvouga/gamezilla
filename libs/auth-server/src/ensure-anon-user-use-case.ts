import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import { AnonUserService } from '@libs/auth-shared/anon-user-service';
import type { EnsureAnonUserResult } from '@libs/auth-shared/anon-user-service';

export class EnsureAnonUserUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  async execute(args: {
    readonly deviceId: string;
    readonly forceNew?: boolean;
    readonly userId?: string;
    readonly now?: () => number;
    readonly createId?: CreateId;
  }): Promise<EnsureAnonUserResult> {
    return this.db.transaction(async (tx) => {
      return new AnonUserService(tx, this.time).ensureForDevice(args);
    });
  }
}
