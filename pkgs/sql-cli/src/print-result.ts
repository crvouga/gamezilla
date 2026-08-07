import type { SqlCliResult } from './types';

/** Print a {@link SqlCliResult} the way a console REPL would. */
export function printSqlCliResult(result: SqlCliResult): void {
  switch (result.kind) {
    case 'rows':
      console.table(result.rows);
      return;
    case 'run':
      console.table([
        {
          changes: result.result.changes,
          lastInsertRowid: result.result.lastInsertRowid,
        },
      ]);
      return;
    case 'message':
      console.log(result.message);
      return;
    case 'empty':
      console.log('No rows returned');
      return;
  }
}
