import { assert } from '@pkgs/assert';
import { Parser } from 'node-sql-parser';
import { assertWithinLimit, LIMITS } from '../core/limits';
import type { AccessPath, ParsedStatement } from '../core/types';

type AstNode = Record<string, unknown>;
type Dialect = 'PostgreSQL' | 'Sqlite';

const parser = new Parser();
const MAX_WALK_DEPTH = 64;

function asNode(v: unknown): AstNode | undefined {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as AstNode;
  }
  return undefined;
}

function tableNameFromNode(node: unknown, depth = 0): string | undefined {
  assert.ok(depth <= MAX_WALK_DEPTH, 'table walk depth');
  if (node === null || node === undefined) return undefined;
  if (typeof node === 'string') return node.toLowerCase();
  if (Array.isArray(node)) return tableNameFromNode(node[0], depth + 1);
  const o = asNode(node);
  if (o === undefined) return undefined;
  const table = o['table'];
  if (typeof table === 'string') return table.toLowerCase();
  return undefined;
}

function collectFromTables(from: unknown, out: Set<string>): void {
  if (!Array.isArray(from)) return;
  for (let i = 0; i < from.length; i++) {
    const name = tableNameFromNode(from[i]);
    if (name !== undefined) out.add(name);
  }
}

function columnNameValue(column: unknown): string | undefined {
  if (typeof column === 'string') return column.toLowerCase();
  const o = asNode(column);
  if (o === undefined) return undefined;
  // Postgres dialect: { expr: { type: 'default', value: 'col' } }
  const expr = asNode(o['expr']);
  if (expr !== undefined && typeof expr['value'] === 'string') {
    return (expr['value'] as string).toLowerCase();
  }
  if (typeof o['value'] === 'string')
    return (o['value'] as string).toLowerCase();
  return undefined;
}

function columnRef(expr: unknown): string | undefined {
  const o = asNode(expr);
  if (o === undefined) return undefined;
  if (o['type'] === 'column_ref') {
    return columnNameValue(o['column']);
  }
  return columnNameValue(o['column']);
}

/** Workload SQL uses `?`; node-sql-parser Postgres dialect requires `$n`. */
function rewritePlaceholdersForDialect(sql: string, dialect: Dialect): string {
  if (dialect !== 'PostgreSQL') return sql;
  let n = 0;
  return sql.replace(/\?/g, () => {
    n += 1;
    return `$${String(n)}`;
  });
}

function selectListColumns(columns: unknown): string[] {
  if (columns === '*') return ['*'];
  if (!Array.isArray(columns)) return [];
  const names: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = asNode(columns[i]);
    if (col === undefined) continue;
    const expr = col['expr'];
    const name = columnRef(expr);
    if (name !== undefined) names.push(name);
    else if (asNode(expr)?.['column'] === '*') names.push('*');
  }
  return names;
}

function orderByColumns(orderby: unknown): string[] {
  if (!Array.isArray(orderby)) return [];
  const names: string[] = [];
  for (let i = 0; i < orderby.length; i++) {
    const item = asNode(orderby[i]);
    if (item === undefined) continue;
    const name = columnRef(item['expr']);
    if (name !== undefined) names.push(name);
  }
  return names;
}

type PredAccum = {
  equality: string[];
  range: string[];
  orBranches: PredAccum[];
  partial: string | null;
};

function emptyPred(): PredAccum {
  return { equality: [], range: [], orBranches: [], partial: null };
}

const RANGE_OPS = new Set(['>', '>=', '<', '<=', 'BETWEEN', 'LIKE', 'ILIKE']);

function recordComparison(op: string, o: AstNode, acc: PredAccum): void {
  const leftCol = columnRef(o['left']);
  const rightCol = columnRef(o['right']);
  if (leftCol !== undefined && (op === '=' || op === 'IN')) {
    acc.equality.push(leftCol);
    return;
  }
  if (leftCol !== undefined && RANGE_OPS.has(op)) {
    acc.range.push(leftCol);
    return;
  }
  if (op === 'IS' && leftCol === 'deleted_at') {
    const right = asNode(o['right']);
    if (right?.['type'] === 'null' || right?.['value'] === null) {
      acc.partial = 'deleted_at IS NULL';
    }
  }
  if (rightCol !== undefined && op === '=') {
    acc.equality.push(rightCol);
  }
}

function walkWhere(where: unknown, acc: PredAccum, depth = 0): void {
  assert.ok(depth <= MAX_WALK_DEPTH, 'where walk depth');
  const o = asNode(where);
  if (o === undefined) return;
  if (o['type'] === 'unary_expr') {
    walkWhere(o['expr'], acc, depth + 1);
    return;
  }
  if (o['type'] !== 'binary_expr') return;
  const op = String(o['operator'] ?? '').toUpperCase();
  if (op === 'AND') {
    walkWhere(o['left'], acc, depth + 1);
    walkWhere(o['right'], acc, depth + 1);
    return;
  }
  if (op === 'OR') {
    const left = emptyPred();
    const right = emptyPred();
    walkWhere(o['left'], left, depth + 1);
    walkWhere(o['right'], right, depth + 1);
    acc.orBranches.push(left, right);
    return;
  }
  recordComparison(op, o, acc);
}

function pathsFromPred(
  table: string,
  pred: PredAccum,
  selectList: readonly string[],
  orderBy: readonly string[]
): AccessPath[] {
  assert.ok(table.length > 0, 'table required');
  const paths: AccessPath[] = [];
  if (pred.orBranches.length > 0) {
    for (let i = 0; i < pred.orBranches.length; i++) {
      const branch = pred.orBranches[i]!;
      paths.push(...pathsFromPred(table, branch, selectList, orderBy));
    }
    return paths;
  }
  paths.push({
    table,
    equality: pred.equality,
    range: pred.range,
    orderBy,
    selectList,
    partialPredicate: pred.partial,
  });
  return paths;
}

function isSelectNode(node: AstNode): boolean {
  return node['type'] === 'select';
}

/**
 * Recursively find SELECT AST nodes that are subqueries (IN / EXISTS / FROM).
 */
function collectSelectSubqueries(
  node: unknown,
  out: AstNode[],
  depth = 0
): void {
  assert.ok(depth <= MAX_WALK_DEPTH, 'subquery walk depth');
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      collectSelectSubqueries(node[i], out, depth + 1);
    }
    return;
  }
  const o = asNode(node);
  if (o === undefined) return;
  if (isSelectNode(o) && depth > 0) {
    out.push(o);
  }
  for (const key of Object.keys(o)) {
    // Avoid re-entering the same select's own body as a nested "from" root
    // when we're already at that select — children still walked.
    collectSelectSubqueries(o[key], out, depth + 1);
  }
}

function pathsFromSelectRoot(root: AstNode): {
  readonly tables: string[];
  readonly paths: AccessPath[];
} {
  const tables = new Set<string>();
  collectFromTables(root['from'], tables);
  const tableList = [...tables];
  const selectList = selectListColumns(root['columns']);
  const orderBy = orderByColumns(root['orderby']);
  const pred = emptyPred();
  walkWhere(root['where'], pred);
  const primary = tableList[0] ?? '';
  if (primary.length === 0) {
    return { tables: tableList, paths: [] };
  }
  return {
    tables: tableList,
    paths: pathsFromPred(primary, pred, selectList, orderBy),
  };
}

/**
 * Parse SELECT with node-sql-parser. Walks IN/EXISTS/FROM subqueries and
 * emits an AccessPath per inner table (bounded).
 */
export function parseWithNodeSqlParser(
  sql: string,
  dialect: Dialect
): ParsedStatement {
  assert.ok(sql.length > 0, 'sql required');
  try {
    const forAst = rewritePlaceholdersForDialect(sql, dialect);
    const ast = parser.astify(forAst, { database: dialect });
    const stmts = Array.isArray(ast) ? ast : [ast];
    assert.ok(stmts.length >= 1, 'at least one statement');
    const root = asNode(stmts[0]);
    if (root === undefined || root['type'] !== 'select') {
      return {
        ok: false,
        reason: 'not a select',
        tables: [],
        paths: [],
      };
    }

    const allTables = new Set<string>();
    const allPaths: AccessPath[] = [];

    const outer = pathsFromSelectRoot(root);
    for (let i = 0; i < outer.tables.length; i++) {
      allTables.add(outer.tables[i]!);
    }
    for (let i = 0; i < outer.paths.length; i++) {
      allPaths.push(outer.paths[i]!);
    }

    const subselects: AstNode[] = [];
    collectSelectSubqueries(root, subselects, 0);
    assertWithinLimit(
      subselects.length + 1,
      LIMITS.maxTablesPerStatement * 2,
      'select nodes'
    );
    for (let s = 0; s < subselects.length; s++) {
      const inner = pathsFromSelectRoot(subselects[s]!);
      for (let t = 0; t < inner.tables.length; t++) {
        allTables.add(inner.tables[t]!);
      }
      for (let p = 0; p < inner.paths.length; p++) {
        allPaths.push(inner.paths[p]!);
      }
    }

    const tableList = [...allTables];
    assertWithinLimit(
      tableList.length,
      LIMITS.maxTablesPerStatement,
      'parsed tables'
    );
    if (tableList.length === 0 || allPaths.length === 0) {
      return {
        ok: false,
        reason: 'no from table',
        tables: tableList,
        paths: [],
      };
    }
    assertWithinLimit(
      allPaths.length,
      LIMITS.maxCandidatesPerStatement,
      'access paths'
    );
    return {
      ok: true,
      tables: tableList,
      paths: allPaths,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'parse error',
      tables: [],
      paths: [],
    };
  }
}
