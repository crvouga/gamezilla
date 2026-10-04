import type { Logger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

export type DatabaseSeederContext = {
  readonly sqlClient: SqlClient;
  readonly logger: Logger;
};

/**
 * Idempotent SQL data seed unit. Packages own concrete classes; apps compose
 * them via {@link ComposedDatabaseSeeder}.
 */
export interface DatabaseSeeder {
  seed(ctx: DatabaseSeederContext): Promise<void>;
}
