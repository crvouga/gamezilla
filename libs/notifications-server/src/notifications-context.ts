import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';

export type NotificationsRequestContext = {
  readonly sql: SqlTx;
  readonly actorId: string;
  /**
   * Tells the person's devices their inbox changed. An inbox request writes
   * outside mutation replay, so nothing else would push it to them.
   */
  readonly inboxChanged: () => Promise<void>;
};
