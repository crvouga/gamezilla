import { assertSqlIdentifier } from '@pkgs/sql/assert-sql-identifier';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SqlCliCommand, SqlCliResult } from '../types';

type TableRow = { table_name: string };

async function querySummary(client: SqlClient): Promise<SqlCliResult> {
  const tables = await client.query<TableRow>(`
SELECT name AS table_name
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name
`);

  if (tables.length === 0) {
    return { kind: 'message', message: 'No tables found' };
  }

  const rows: Record<string, unknown>[] = [];
  for (const table of tables) {
    assertSqlIdentifier(table.table_name, 'Invalid table name', {
      tableName: table.table_name,
    });
    const countRows = await client.query<{ row_count: number | string }>(
      `SELECT COUNT(*) AS row_count FROM "${table.table_name}"`
    );
    const raw = countRows[0]?.row_count ?? 0;
    rows.push({
      table_name: table.table_name,
      row_count: Number(raw).toLocaleString(),
    });
  }

  return { kind: 'rows', rows };
}

export function registerSummaryCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'Summarize tables with row counts',
    match: /^summary$/i,
    handler: async (_input, client) => querySummary(client),
  });
}
