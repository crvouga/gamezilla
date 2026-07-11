import type { SqlClient } from '@pkgs/sql-client/interface';

export type InboxRequestContext = {
  readonly sql: SqlClient;
  readonly actorId: string;
};
