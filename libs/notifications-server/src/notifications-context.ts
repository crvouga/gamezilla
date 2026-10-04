import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';

export type NotificationsRequestContext = {
  readonly sql: SqlTx;
  readonly actorId: string;
};
