import { raw } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { SqlDialect } from './types';

/** Drop sample tables; ignore missing (idempotent cleanup). */
export async function dropTables(
  client: SqlClient,
  tables: readonly string[],
  dialect: SqlDialect = 'postgres'
): Promise<void> {
  for (const table of tables) {
    try {
      const cascade = dialect === 'postgres' ? ' CASCADE' : '';
      await client.run(
        raw(`DROP TABLE IF EXISTS ${quoteIdent(table)}${cascade}`)
      );
    } catch {
      // table may already be gone / engine closed
    }
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`dropTables: invalid table name ${name}`);
  }
  return `"${name}"`;
}
