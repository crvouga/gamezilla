import type { Value } from '@pkgs/sql';
import type { RunResult } from '../../src/interface';

type Row = Record<string, Value>;

/** Tiny SQL subset for the Playwright memory owner. */
export function execMemorySql(
  tables: Map<string, Row[]>,
  sqlText: string,
  values: Value[]
): RunResult | Row[] {
  const trimmed = sqlText.trim();
  if (/^CREATE TABLE/i.test(trimmed)) {
    const match = /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i.exec(trimmed);
    if (match?.[1] !== undefined && !tables.has(match[1])) {
      tables.set(match[1], []);
    }
    return { changes: 0, lastInsertRowid: 0 };
  }
  // defineTable uniqueIndexes / indexes emit CREATE INDEX; the map store has no indexes.
  if (
    /^CREATE(?: UNIQUE)? INDEX/i.test(trimmed) ||
    /^DROP INDEX/i.test(trimmed)
  ) {
    return { changes: 0, lastInsertRowid: 0 };
  }
  if (/^INSERT INTO/i.test(trimmed)) {
    return insertRow(tables, trimmed, values);
  }
  if (/^SELECT/i.test(trimmed)) {
    const match = /FROM\s+(\w+)/i.exec(trimmed);
    return [...(tables.get(match?.[1] ?? 't') ?? [])];
  }
  if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(trimmed)) {
    return { changes: 0, lastInsertRowid: 0 };
  }
  throw new Error(`Unsupported SQL in memory owner: ${trimmed}`);
}

function insertRow(
  tables: Map<string, Row[]>,
  trimmed: string,
  values: Value[]
): RunResult {
  const match =
    /INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i.exec(trimmed);
  if (match === null) throw new Error(`Unsupported INSERT: ${trimmed}`);
  const table = match[1] ?? 't';
  const cols = (match[2] ?? '').split(',').map((c) => c.trim());
  let rows = tables.get(table);
  if (rows === undefined) {
    rows = [];
    tables.set(table, rows);
  }
  const row: Row = {};
  cols.forEach((col, i) => {
    row[col] = values[i] ?? null;
  });
  rows.push(row);
  return { changes: 1, lastInsertRowid: rows.length };
}
