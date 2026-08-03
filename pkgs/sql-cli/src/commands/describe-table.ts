import { raw } from '@pkgs/sql';
import { assertSqlIdentifier } from '@pkgs/sql/assert-sql-identifier';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SqlCliCommand, SqlCliResult } from '../types';

export async function describeTable(
  client: SqlClient,
  tableName: string
): Promise<SqlCliResult> {
  assertSqlIdentifier(tableName, 'Invalid table name', { tableName });
  const rows = await client.query(
    raw<Record<string, unknown>>(`PRAGMA table_info(${tableName})`)
  );
  if (rows.length === 0) {
    return { kind: 'message', message: `Table not found: ${tableName}` };
  }
  return { kind: 'rows', rows };
}

function parseTableName(input: string): string | null {
  const match = /^\\?d\s+(\w+)/i.exec(input.trim());
  return match?.[1] ?? null;
}

export function registerDescribeTableCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'Describe a table (\\d <name>)',
    match: /^\\?d\s+\w+/i,
    handler: async (input, client) => {
      const tableName = parseTableName(input);
      if (!tableName) {
        return { kind: 'message', message: 'No table name provided' };
      }
      return describeTable(client, tableName);
    },
  });
}
