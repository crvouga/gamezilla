import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SqlCliCommand, SqlCliResult } from '../types';

const LIST_TABLES_SQL = `
SELECT name AS table_name, type
FROM sqlite_master
WHERE type IN ('table', 'view')
  AND name NOT LIKE 'sqlite_%'
ORDER BY name
`;

export async function listTables(client: SqlClient): Promise<SqlCliResult> {
  const rows = await client.query<Record<string, unknown>>(LIST_TABLES_SQL);
  if (rows.length === 0) {
    return { kind: 'message', message: 'No tables found' };
  }
  return { kind: 'rows', rows };
}

export function registerListTablesCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'List all tables and views',
    match: /^\\?dt$/i,
    handler: async (_input, client) => listTables(client),
  });
}
