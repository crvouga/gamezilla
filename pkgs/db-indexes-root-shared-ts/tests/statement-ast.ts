import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { AccessPath } from '@pkgs/db-indexes-root-shared-ts/types';
import fc from 'fast-check';
import type { GenSchema, GenTable } from './schema';

export type StatementAst = {
  readonly table: string;
  readonly equality: readonly string[];
  readonly range: readonly string[];
  readonly inCols: readonly string[];
  readonly orderBy: readonly string[];
  readonly selectList: readonly string[];
  readonly softDelete: boolean;
  readonly orBranches: boolean;
};

function nonIdCols(table: GenTable): string[] {
  return table.columns.filter((c) => c !== 'id');
}

function pickCols(
  cols: readonly string[],
  n: number,
  rng: fc.Random
): string[] {
  if (cols.length === 0 || n <= 0) return [];
  const copy = [...cols];
  const out: string[] = [];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const idx = rng.nextInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

/**
 * Build a statement AST over a schema table, then render SQL.
 */
export function genStatement(
  schema: GenSchema
): fc.Arbitrary<{ readonly ast: StatementAst; readonly sql: string }> {
  assert.ok(schema.tables.length > 0, 'schema tables required');
  return fc.integer({ min: 0, max: schema.tables.length - 1 }).chain((ti) => {
    const table = schema.tables[ti]!;
    const cols = nonIdCols(table);
    return fc
      .tuple(
        fc.integer({ min: 0, max: Math.min(3, cols.length) }),
        fc.integer({ min: 0, max: Math.min(2, cols.length) }),
        fc.integer({ min: 0, max: Math.min(2, cols.length) }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean()
      )
      .map(([eqN, rangeN, orderN, softDelete, orBranches, useIn]) => {
        // Deterministic pick from seeded shuffle via sorted slice for shrink
        const equality = cols.slice(0, eqN);
        const rest = cols.slice(eqN);
        const range = rest.slice(0, rangeN);
        const orderBy = rest.slice(rangeN, rangeN + orderN);
        const inCols = useIn && rest.length > 0 ? [rest[0]!] : [];
        const selectList = ['id', ...equality.slice(0, 2)];
        const ast: StatementAst = {
          table: table.name,
          equality,
          range,
          inCols,
          orderBy,
          selectList,
          softDelete,
          orBranches: orBranches && equality.length >= 2,
        };
        return { ast, sql: renderSql(ast) };
      });
  });
}

export function renderSql(ast: StatementAst): string {
  const select = ast.selectList.length > 0 ? ast.selectList.join(', ') : 'id';
  const whereParts: string[] = [];
  if (ast.orBranches && ast.equality.length >= 2) {
    whereParts.push(`(${ast.equality[0]} = ? OR ${ast.equality[1]} = ?)`);
  } else {
    for (let i = 0; i < ast.equality.length; i++) {
      whereParts.push(`${ast.equality[i]} = ?`);
    }
  }
  for (let i = 0; i < ast.range.length; i++) {
    whereParts.push(`${ast.range[i]} > ?`);
  }
  for (let i = 0; i < ast.inCols.length; i++) {
    whereParts.push(`${ast.inCols[i]} IN (?, ?)`);
  }
  if (ast.softDelete) {
    whereParts.push('deleted_at IS NULL');
  }
  const where =
    whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
  const order =
    ast.orderBy.length > 0 ? ` ORDER BY ${ast.orderBy.join(', ')}` : '';
  return `SELECT ${select} FROM ${ast.table}${where}${order}`;
}

export function astToAccessPath(ast: StatementAst): AccessPath {
  return {
    table: ast.table,
    equality: ast.equality,
    range: ast.range,
    orderBy: ast.orderBy,
    selectList: ast.selectList,
    partialPredicate: ast.softDelete ? 'deleted_at IS NULL' : null,
  };
}

/** Unused helper kept for shrink experiments — pickCols. */
export function _pickColsForTest(
  cols: readonly string[],
  n: number,
  rng: fc.Random
): string[] {
  return pickCols(cols, n, rng);
}
