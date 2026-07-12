import type { SqlClient } from '@pkgs/sql-client/interface';

import { registerDescribeTableCommand } from './commands/describe-table';
import { registerHelpCommand } from './commands/help';
import { registerListTablesCommand } from './commands/list-tables';
import { registerRawSqlCommand } from './commands/raw-sql';
import { registerSummaryCommand } from './commands/summary';
import { interpolateTaggedTemplate } from './interpolate';
import { printSqlCliResult } from './print-result';
import type { SqlCliCommand, SqlCliFn, SqlCliResult } from './types';

export type CreateSqlCliConfig = {
  client: SqlClient;
  /** When true (default), print results via console.table / console.log. */
  print?: boolean;
};

export type SqlCli = {
  sql: SqlCliFn;
  evaluate: (input: string) => Promise<SqlCliResult>;
  commands: readonly SqlCliCommand[];
};

export function createSqlCli(config: CreateSqlCliConfig): SqlCli {
  const commands: SqlCliCommand[] = [];
  const shouldPrint = config.print !== false;

  registerHelpCommand(commands);
  registerListTablesCommand(commands);
  registerDescribeTableCommand(commands);
  registerSummaryCommand(commands);
  registerRawSqlCommand(commands);

  async function evaluate(input: string): Promise<SqlCliResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { kind: 'message', message: 'No command provided' };
    }

    const command = commands.find((entry) => entry.match.test(trimmed));
    if (!command) {
      return { kind: 'message', message: 'Unknown command' };
    }

    try {
      return await command.handler(trimmed, config.client);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: 'message', message };
    }
  }

  const sql: SqlCliFn = async (strings, ...values) => {
    const input = interpolateTaggedTemplate(strings, values);
    const result = await evaluate(input);
    if (shouldPrint) {
      printSqlCliResult(result);
    }
    return result;
  };

  return { sql, evaluate, commands };
}
