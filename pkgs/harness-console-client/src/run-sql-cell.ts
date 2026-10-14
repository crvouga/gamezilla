import type {
  ExecuteSqlStatements,
  SqlStatementOutput,
} from '@pkgs/sql-client-root-shared/statements';

import { classifySqlStatement, splitSqlStatements } from './sql-tokenize';

export type SqlRowsResult = {
  readonly kind: 'rows';
  readonly sql: string;
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly truncated: boolean;
};

export type SqlChangesResult = {
  readonly kind: 'changes';
  readonly sql: string;
  readonly changes: number;
};

export type SqlStatementResult = SqlRowsResult | SqlChangesResult;

export type SqlCellRun = {
  readonly statements: readonly SqlStatementResult[];
  readonly durationMs: number;
  readonly error: string | null;
};

const MAX_DISPLAY_ROWS = 5000;

export async function runSqlCell(args: {
  readonly execute: ExecuteSqlStatements;
  readonly sql: string;
  readonly now: () => number;
}): Promise<SqlCellRun> {
  const { execute, sql, now } = args;
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) {
    return { statements: [], durationMs: 0, error: null };
  }
  const started = now();
  try {
    const output = await execute(
      statements.map((text) => ({
        text,
        kind: classifySqlStatement(text) === 'rows' ? 'query' : 'run',
      }))
    );
    const results = output.map(statementResult);
    return {
      statements: results,
      durationMs: Math.max(0, now() - started),
      error: null,
    };
  } catch (err) {
    return {
      statements: [],
      durationMs: Math.max(0, now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function statementResult(result: SqlStatementOutput): SqlStatementResult {
  if (result.kind === 'changes')
    return { kind: 'changes', sql: result.text, changes: result.changes };
  const truncated = result.rows.length > MAX_DISPLAY_ROWS;
  const rows = truncated ? result.rows.slice(0, MAX_DISPLAY_ROWS) : result.rows;
  return {
    kind: 'rows',
    sql: result.text,
    rows,
    columns: columnsFromRows(rows),
    truncated,
  };
}

export function columnsFromRows(
  rows: readonly Record<string, unknown>[]
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}
