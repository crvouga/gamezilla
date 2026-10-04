import type { SqlTx } from '@pkgs/sql-client-shared/interface';

export type NotificationsRequestContext = {
  readonly sql: SqlTx;
  readonly actorId: string;
};
