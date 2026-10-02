import { assert } from '@pkgs/assert';
import { Parser } from 'node-sql-parser';
import { assertWithinLimit, LIMITS } from '../core/limits';
import type { AccessPath, ParsedStatement } from '../core/types';
import {
  type AstNode,
  asNode,
  type ColumnScope,
  fromRelations,
  scopedColumn,
} from './parse-sql-scope';

type Dialect = 'PostgreSQL' | 'Sqlite';

const parser = new Parser();
const MAX_WALK_DEPTH = 64;

/** Workload SQL uses `?`; node-sql-parser Postgres dialect requires `$n`. */
function rewritePlaceholdersForDialect(sql: string, dialect: Dialect): string {
  if (dialect !== 'PostgreSQL') return sql;
  let n = 0;
  return sql.replace(/\?/g, () => {
    n += 1;
    return `$${String(n)}`;
  });
}

function selectListColumns(columns: unknown, scope: ColumnScope): string[] {
  if (columns === '*') return ['*'];
  if (!Array.isArray(columns)) return [];
  const names: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = asNode(columns[i]);
    if (col === undefined) continue;
    const expr = col['expr'];
    const name = scopedColumn(expr, scope);
    if (name !== undefined) names.push(name);
  }
  return names;
}

function orderByColumns(orderby: unknown, scope: ColumnScope): string[] {
  if (!Array.isArray(orderby)) return [];
  const names: string[] = [];
  for (let i = 0; i < orderby.length; i++) {
    const item = asNode(orderby[i]);
    if (item === undefined) continue;
    const name = scopedColumn(item['expr'], scope);
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

function recordComparison(
  op: string,
  o: AstNode,
  acc: PredAccum,
  scope: ColumnScope
): void {
  const leftCol = scopedColumn(o['left'], scope);
  const rightCol = scopedColumn(o['right'], scope);
  if (leftCol !== undefined && (op === '=' || op === 'IN')) {
    acc.equality.push(leftCol);
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

function walkWhere(
  where: unknown,
  acc: PredAccum,
  scope: ColumnScope,
  depth = 0
): void {
  assert.ok(depth <= MAX_WALK_DEPTH, 'where walk depth');
  const o = asNode(where);
  if (o === undefined) return;
  if (o['type'] === 'unary_expr') {
    walkWhere(o['expr'], acc, scope, depth + 1);
    return;
  }
  if (o['type'] !== 'binary_expr') return;
  const op = String(o['operator'] ?? '').toUpperCase();
  if (op === 'AND') {
    walkWhere(o['left'], acc, scope, depth + 1);
    walkWhere(o['right'], acc, scope, depth + 1);
    return;
  }
  if (op === 'OR') {
    const left = emptyPred();
    const right = emptyPred();
    walkWhere(o['left'], left, scope, depth + 1);
    walkWhere(o['right'], right, scope, depth + 1);
    acc.orBranches.push(left, right);
    return;
  }
  recordComparison(op, o, acc, scope);
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
  const relations = fromRelations(root['from']);
  const paths: AccessPath[] = [];
  for (const relation of relations) {
    const scope = { relation, relations };
    const selectList = selectListColumns(root['columns'], scope);
    const orderBy = orderByColumns(root['orderby'], scope);
    const pred = emptyPred();
    walkWhere(root['where'], pred, scope);
    for (const joined of relations) walkWhere(joined.on, pred, scope);
    paths.push(...pathsFromPred(relation.table, pred, selectList, orderBy));
  }
  return { tables: relations.map((relation) => relation.table), paths };
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
