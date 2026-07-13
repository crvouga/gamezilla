import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SqlCliCommand, SqlCliResult } from '../types';

const RESULT_RETURNING = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN|VALUES)\b/i;

function isResultReturning(sql: string): boolean {
  return RESULT_RETURNING.test(sql);
}

export async function executeRawSql(
  client: SqlClient,
  sql: string
): Promise<SqlCliResult> {
  if (isResultReturning(sql)) {
    const rows = await client.query<Record<string, unknown>>(sql);
    if (rows.length === 0) {
      return { kind: 'empty' };
    }
    return { kind: 'rows', rows };
  }

  const result = await client.run(sql);
  return { kind: 'run', result };
}

export function registerRawSqlCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'Execute a raw SQL statement',
    match: /.*/,
    handler: async (input, client) => executeRawSql(client, input),
  });
}
