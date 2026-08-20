import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import {
  AnonUserService,
  type EnsureAnonUserResult,
} from '../../public/anon-user-service';

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
