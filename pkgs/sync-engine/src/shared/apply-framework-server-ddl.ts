import type { Logger } from '@pkgs/logger';
import { unsafe as unsafeSql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { FRAMEWORK_SERVER_DDL } from './framework-server-ddl';

function appendStatement(statements: string[], chunk: string): void {
  const trimmed = chunk.trim();
  if (trimmed.length > 0 && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }
}

function toggleDollarQuote(
  sql: string,
  index: number,
  inDollar: boolean
): {
  nextIndex: number;
  inDollar: boolean;
} {
  if (!sql.startsWith('$$', index)) {
    return { nextIndex: index, inDollar };
  }
  return { nextIndex: index + 1, inDollar: !inDollar };
}

type CommentMode = 'none' | 'line' | 'block';

type ScanState = {
  current: string;
  inDollar: boolean;
  comment: CommentMode;
};

function tryOpenComment(
  sql: string,
  index: number,
  state: ScanState
): number | null {
  if (state.inDollar || state.comment !== 'none') {
    return null;
  }
  if (sql.startsWith('--', index)) {
    state.comment = 'line';
    return index + 1;
  }
  if (sql.startsWith('/*', index)) {
    state.comment = 'block';
    return index + 1;
  }
  return null;
}

function advanceComment(sql: string, index: number, state: ScanState): number {
  if (state.comment === 'line') {
    if (sql[index] === '\n') {
      state.comment = 'none';
    }
    return index;
  }
  if (state.comment === 'block' && sql.startsWith('*/', index)) {
    state.comment = 'none';
    return index + 1;
  }
  return index;
}

function appendSqlChar(
  sql: string,
  index: number,
  state: ScanState,
  statements: string[]
): number {
  const ch = sql[index];
  if (!state.inDollar && ch === ';') {
    appendStatement(statements, state.current);
    state.current = '';
    return index;
  }
  state.current += ch;
  return index;
}

/** Splits DDL on `;` outside comments and dollar-quoted blocks. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  const state: ScanState = { current: '', inDollar: false, comment: 'none' };

  for (let i = 0; i < sql.length; i += 1) {
    const toggled = toggleDollarQuote(sql, i, state.inDollar);
    if (toggled.nextIndex !== i) {
      state.inDollar = toggled.inDollar;
      state.current += '$$';
      i = toggled.nextIndex;
      continue;
    }

    const commentStart = tryOpenComment(sql, i, state);
    if (commentStart !== null) {
      i = commentStart;
      continue;
    }

    if (state.comment !== 'none') {
      i = advanceComment(sql, i, state);
      continue;
    }

    i = appendSqlChar(sql, i, state, statements);
  }

  appendStatement(statements, state.current);
  return statements;
}

/**
 * Postgres-only: existing installs may still have wall `DEFAULT now()`.
 * Fresh portable DDL has no defaults; SQLite rejects `DO $$`.
 */
async function dropLegacyPostgresWallDefaults(
  sqlClient: SqlClient
): Promise<void> {
  // @sql-vendor-ok — Postgres DO blocks for legacy DEFAULT cleanup only
  const statements = [
    `
DO $$ BEGIN
  ALTER TABLE IF EXISTS public.sync_engine_mutations_applied
    ALTER COLUMN applied_at DROP DEFAULT;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;
`,
    `
DO $$ BEGIN
  ALTER TABLE IF EXISTS public.sync_engine_write_rejections
    ALTER COLUMN created_at DROP DEFAULT;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;
`,
  ] as const;
  for (const statement of statements) {
    try {
      await sqlClient.run(unsafeSql(statement));
    } catch {
      // SQLite / engines without DO — portable DDL has no wall defaults.
    }
  }
}

/** Apply sync-engine framework tables (`sync_engine_mutations`, …). */
export async function applyFrameworkServerDdl(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const { sqlClient, logger } = args;
  const statements = splitSqlStatements(FRAMEWORK_SERVER_DDL);
  for (const statement of statements) {
    await sqlClient.run(unsafeSql(statement));
  }
  await dropLegacyPostgresWallDefaults(sqlClient);
  logger.info('framework server DDL applied', {
    statements: statements.length,
  });
}
