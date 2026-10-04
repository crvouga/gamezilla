import { unsafe } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import type { SqlCliCommand, SqlCliResult } from './types';

const RESULT_RETURNING = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN|VALUES)\b/i;

function isResultReturning(userInput: string): boolean {
  return RESULT_RETURNING.test(userInput);
}

export async function executeRawSql(
  client: SqlClient,
  userInput: string
): Promise<SqlCliResult> {
  if (isResultReturning(userInput)) {
    const rows = await client.query(unsafe<Record<string, unknown>>(userInput));
    if (rows.length === 0) {
      return { kind: 'empty' };
    }
    return { kind: 'rows', rows };
  }

  const result = await client.run(unsafe(userInput));
  return { kind: 'run', result };
}

export function registerRawSqlCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'Execute a raw SQL statement',
    match: /.*/,
    handler: async (input, client) => executeRawSql(client, input),
  });
}
