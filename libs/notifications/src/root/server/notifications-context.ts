import type { SqlTx } from '@pkgs/sql-client/interface';

export type NotificationsRequestContext = {
  readonly sql: SqlTx;
  readonly actorId: string;
};
