import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';

import { listSchemaObjects } from './frame-sqlite';

export type SqliteDiffKind = 'added' | 'removed' | 'changed';

export type SqliteRowDiff = {
  readonly kind: SqliteDiffKind;
  readonly values: readonly SqlValue[];
};

export type SqliteTableDiff = {
  readonly table: string;
  readonly prevCount: number;
  readonly nextCount: number;
  readonly rows: readonly SqliteRowDiff[];
};

export type SqliteSchemaDiff = {
  readonly addedTables: readonly string[];
  readonly removedTables: readonly string[];
};

export type SqliteFrameDiff = {
  readonly identical: boolean;
  readonly schema: SqliteSchemaDiff;
  readonly tables: readonly SqliteTableDiff[];
};

const MAX_ROWS_PER_TABLE = 80;

/** Fast path when content hashes match or either side is missing. */
export function diffBySha(
  prevSha: string | undefined,
  nextSha: string | undefined
): SqliteFrameDiff | null {
  if (prevSha === undefined || nextSha === undefined) {
    return {
      identical: prevSha === nextSha,
      schema: { addedTables: [], removedTables: [] },
      tables: [],
    };
  }
  if (prevSha === nextSha) {
    return {
      identical: true,
      schema: { addedTables: [], removedTables: [] },
      tables: [],
    };
  }
  return null;
}

export function diffSqliteDatabases(
  prev: Database,
  next: Database
): SqliteFrameDiff {
  const prevTables = listSchemaObjects(prev)
    .filter((o) => o.type === 'table')
    .map((o) => o.name);
  const nextTables = listSchemaObjects(next)
    .filter((o) => o.type === 'table')
    .map((o) => o.name);
  const prevSet = new Set(prevTables);
  const nextSet = new Set(nextTables);
  const addedTables = nextTables.filter((t) => !prevSet.has(t));
  const removedTables = prevTables.filter((t) => !nextSet.has(t));
  const common = nextTables.filter((t) => prevSet.has(t));
  const tables: SqliteTableDiff[] = [];
  for (const table of common) {
    const diff = diffTable(prev, next, table);
    if (diff.rows.length > 0 || diff.prevCount !== diff.nextCount) {
      tables.push(diff);
    }
  }
  return {
    identical:
      addedTables.length === 0 &&
      removedTables.length === 0 &&
      tables.length === 0,
    schema: { addedTables, removedTables },
    tables,
  };
}

function diffTable(
  prev: Database,
  next: Database,
  table: string
): SqliteTableDiff {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  const prevRows = selectAll(prev, quoted);
  const nextRows = selectAll(next, quoted);
  const prevKeys = new Map<string, SqlValue[]>();
  for (const row of prevRows) prevKeys.set(rowKey(row), row);
  const nextKeys = new Map<string, SqlValue[]>();
  for (const row of nextRows) nextKeys.set(rowKey(row), row);

  const rows: SqliteRowDiff[] = [];
  for (const [key, values] of nextKeys) {
    if (!prevKeys.has(key)) {
      rows.push({ kind: 'added', values });
    }
  }
  for (const [key, values] of prevKeys) {
    if (!nextKeys.has(key)) {
      rows.push({ kind: 'removed', values });
    }
  }
  return {
    table,
    prevCount: prevRows.length,
    nextCount: nextRows.length,
    rows: rows.slice(0, MAX_ROWS_PER_TABLE),
  };
}

function selectAll(db: Database, quotedTable: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  try {
    db.exec({
      sql: `SELECT * FROM ${quotedTable}`,
      rowMode: 'array',
      callback: (row) => {
        rows.push(row as SqlValue[]);
      },
    });
  } catch {
    return [];
  }
  return rows;
}

function rowKey(row: readonly SqlValue[]): string {
  return JSON.stringify(row, (_k, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
}
