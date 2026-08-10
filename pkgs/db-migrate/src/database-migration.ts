import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type DatabaseMigrationContext = {
  readonly sqlClient: SqlClient;
  readonly logger: Logger;
};

/**
 * Idempotent SQL schema / data migration unit. Packages own concrete classes;
 * apps compose them via {@link ComposedDatabaseMigration}.
 */
export interface DatabaseMigration {
  migrate(ctx: DatabaseMigrationContext): Promise<void>;
}
