import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { quotePgIdent } from '@pkgs/sql-client/postgres-schema';

/** Legacy auth Postgres tables superseded by the auth adapter + sync account entities. */
const LEGACY_AUTH_TABLES = [
  'verification',
  'account',
  'session',
  'user',
] as const;

/**
 * Drops legacy auth tables when present. Safe to run on every migrate —
 * `DROP TABLE IF EXISTS` is idempotent.
 */
export async function dropLegacyAuthTables(
  sqlClient: SqlClient,
  logger: Logger
): Promise<void> {
  for (const table of LEGACY_AUTH_TABLES) {
    await sqlClient.run(`DROP TABLE IF EXISTS ${quotePgIdent(table)} CASCADE`);
    logger.info('dropped legacy auth table if present', { table });
  }
}
