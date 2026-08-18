import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import {
  AnonUserService,
  type EnsureAnonUserResult,
} from './anon-user-service';

export class EnsureAnonUserUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io
  ) {}

  async execute(args: {
    readonly deviceId: string;
    readonly forceNew?: boolean;
    readonly now?: () => number;
    readonly createId?: CreateId;
  }): Promise<EnsureAnonUserResult> {
    return this.db.transaction(async (tx) => {
      return new AnonUserService(tx, this.io).ensureForDevice(args);
    });
  }
}
