import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { raw } from '@pkgs/sql-root-shared/sql';

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
  readonly sqlClient: SqlClient;
  readonly sql: string;
  readonly now: () => number;
}): Promise<SqlCellRun> {
  const { sqlClient, sql, now } = args;
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) {
    return { statements: [], durationMs: 0, error: null };
  }
  const started = now();
  try {
    const results = await sqlClient.transaction(async (tx) => {
      const out: SqlStatementResult[] = [];
      for (const stmt of statements) {
        out.push(await runOneStatement(tx, stmt));
      }
      return out;
    });
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

async function runOneStatement(
  tx: SqlClient,
  stmt: string
): Promise<SqlStatementResult> {
  const kind = classifySqlStatement(stmt);
  if (kind === 'rows') {
    const rows = await tx.query<Record<string, unknown>>(raw(stmt));
    const truncated = rows.length > MAX_DISPLAY_ROWS;
    const clipped = truncated ? rows.slice(0, MAX_DISPLAY_ROWS) : rows;
    return {
      kind: 'rows',
      sql: stmt,
      columns: columnsFromRows(clipped),
      rows: clipped,
      truncated,
    };
  }
  const result = await tx.run(raw(stmt));
  return { kind: 'changes', sql: stmt, changes: result.changes };
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
