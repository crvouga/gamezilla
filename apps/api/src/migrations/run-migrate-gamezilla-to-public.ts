import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { splitSqlStatements } from './run-schema-sql';

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrate-gamezilla-to-public.sql'
);

export async function runMigrateGamezillaToPublicSql(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const { sqlClient, logger } = args;
  const raw = readFileSync(sqlPath, 'utf8');
  const statements = splitSqlStatements(raw);
  for (const statement of statements) {
    await sqlClient.run(statement);
  }
  logger.info('migrate-gamezilla-to-public.sql applied', {
    statements: statements.length,
  });
}
