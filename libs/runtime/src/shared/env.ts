import type { Clock, Timers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Opens a SQL client. Client env is identity-scoped (`userId` / `databaseName`);
 * server env closes over connection details and ignores args.
 */
export type OpenSqlClient = (args?: {
  readonly userId?: string;
  readonly databaseName?: string;
}) => Promise<SqlClient>;

/** Shared time / entropy fields on both {@link ClientEnv} and {@link ServerEnv}. */
export type EnvTime = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly random: () => number;
  readonly seed: bigint;
};
