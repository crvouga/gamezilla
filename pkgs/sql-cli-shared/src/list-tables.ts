import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { raw } from '@pkgs/sql-shared/sql';

import type { SqlCliCommand, SqlCliResult } from './types';

type TableListRow = { table_name: string; type: string };

const LIST_TABLES_SQL = raw<TableListRow>(`
SELECT name AS table_name, type
FROM sqlite_master
WHERE type IN ('table', 'view')
  AND name NOT LIKE 'sqlite_%'
ORDER BY name
`);

export async function listTables(client: SqlClient): Promise<SqlCliResult> {
  const rows = await client.query(LIST_TABLES_SQL);
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
