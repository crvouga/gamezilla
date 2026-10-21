import type { SqlCliCommand, SqlCliResult } from './types';

export function registerHelpCommand(commands: SqlCliCommand[]): void {
  commands.push({
    description: 'Show available commands',
    match: /^(help|h)$/i,
    handler: async (): Promise<SqlCliResult> => {
      const rows = commands.map((command) => ({
        command: command.match.source,
        description: command.description,
      }));
      return { kind: 'rows', rows };
    },
  });
}
