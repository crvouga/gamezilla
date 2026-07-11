import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

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

/** Splits idempotent schema.sql on `;` outside comments and dollar-quoted blocks. */
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

async function dropLegacySyncTables(
  sqlClient: SqlClient,
  logger: Logger
): Promise<void> {
  const rows = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = current_schema()
       AND (tablename = 'patches' OR tablename LIKE 'snapshots%')`
  );
  for (const row of rows) {
    logger.info('drop legacy sync table', { table: row.tablename });
    await sqlClient.run(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
  }
  await sqlClient.run('DROP VIEW IF EXISTS snapshots CASCADE');
}

export async function runSchemaSql(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const { sqlClient, logger } = args;
  await dropLegacySyncTables(sqlClient, logger);

  const raw = readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(raw);
  for (const statement of statements) {
    await sqlClient.run(statement);
  }
  logger.info('schema.sql applied', { statements: statements.length });
}
