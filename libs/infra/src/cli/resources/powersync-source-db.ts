import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLogger, type Logger } from '@pkgs/logger';
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { quotePgIdent } from '@pkgs/sql-client/postgres-schema';

import { appPostgresDbScope } from '../../namespace-bindings';

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'powersync-source-db.sql'
);

export async function runPowerSyncSourceDbSql(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const { sqlClient, logger } = args;
  const dbScope = appPostgresDbScope();
  await sqlClient.run(`SET search_path TO ${quotePgIdent(dbScope.schema)}`);
  const statement = readFileSync(sqlPath, 'utf8').trim();
  await sqlClient.run(statement);
  logger.info('powersync source-db setup applied', { schema: dbScope.schema });
}

export async function runPowerSyncSourceDbSetup(args: {
  databaseUrl: string;
  logger?: Logger;
}): Promise<void> {
  const logger = args.logger ?? createLogger({ name: 'powersync:source-db' });
  const { pool, sqlClient } = createPgPool({
    connectionString: args.databaseUrl,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    await runPowerSyncSourceDbSql({ sqlClient, logger });
    process.stdout.write('[powersync:source-db] publication + replica identity OK\n');
  } finally {
    await pool.end();
  }
}
