import { raw } from '@pkgs/sql-root-shared/sql';
import type { SqlClient } from './interface';

export type SqlStatement = {
  readonly kind: 'query' | 'run';
  readonly text: string;
};

export type SqlStatementOutput =
  | {
      readonly kind: 'rows';
      readonly text: string;
      readonly rows: readonly Record<string, unknown>[];
    }
  | {
      readonly kind: 'changes';
      readonly text: string;
      readonly changes: number;
    };

export type ExecuteSqlStatements = (
  statements: readonly SqlStatement[]
) => Promise<readonly SqlStatementOutput[]>;

/** A complete statement batch commits together, or rolls back together. */
export function executeSqlStatements(
  client: SqlClient,
  statements: readonly SqlStatement[]
): Promise<readonly SqlStatementOutput[]> {
  return client.transaction(async (tx) => {
    const results: SqlStatementOutput[] = [];
    for (const statement of statements) {
      if (statement.kind === 'query')
        results.push({
          kind: 'rows',
          text: statement.text,
          rows: await tx.query<Record<string, unknown>>(raw(statement.text)),
        });
      else {
        const result = await tx.run(raw(statement.text));
        results.push({
          kind: 'changes',
          text: statement.text,
          changes: result.changes,
        });
      }
    }
    return results;
  });
}
