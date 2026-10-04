import { assert } from '@pkgs/assert-shared/singleton';
import type { Sql } from '@pkgs/sql-shared/sql';
import { Parser } from 'node-sql-parser';

/** Dialects the capture layer must classify identically for the mutation corpus. */
export type SqlAstDialect = 'postgresql' | 'sqlite';

export type ClassifiedWrite = {
  readonly kind: 'write';
  readonly table: string;
  readonly op: 'insert' | 'upsert' | 'update';
  readonly softDelete: boolean;
};

export type ClassifiedRead = {
  readonly kind: 'read';
  readonly tables: readonly string[];
  readonly selectsStar: boolean;
  readonly hasDeletedAtColumn: boolean;
  readonly hasDeletedAtPredicate: boolean;
  readonly hasLimit: boolean;
};

export type ClassifiedStatement =
  | ClassifiedWrite
  | ClassifiedRead
  | { readonly kind: 'delete'; readonly table: string }
  | { readonly kind: 'other'; readonly reason: string };

const parser = new Parser();

type AstNode = Record<string, unknown>;

/**
 * Bare identifiers that node-sql-parser's PostgreSQL grammar treats as
 * keywords (e.g. `at` → AT TIME ZONE). Quote them for classify-only text;
 * the executed SQL is unchanged.
 */
const RESERVED_IDENT_RE = /\b(at)\b/gi;

function quoteReservedIdents(sqlText: string): string {
  return sqlText.replace(RESERVED_IDENT_RE, (match, _word, offset: number) => {
    const prev = offset > 0 ? sqlText[offset - 1] : '';
    if (prev === '"' || prev === "'" || prev === '`') return match;
    return `"${match}"`;
  });
}

/** Parseable text: bound params → NULL so AST does not depend on values. */
export function sqlTextForAst(query: Sql<unknown>): string {
  return quoteReservedIdents(query.sql.replace(/\?/g, 'NULL'));
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function asNode(v: unknown): AstNode | undefined {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as AstNode;
  }
  return undefined;
}

function tableNameFromNode(node: unknown, depth = 0): string | undefined {
  assert.ok(depth <= MAX_AST_TABLE_WALK_DEPTH, 'AST table walk depth');
  if (node === null || node === undefined) return undefined;
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return tableNameFromNode(node[0], depth + 1);
  const o = asNode(node);
  if (o === undefined) return undefined;
  const table = o['table'];
  if (typeof table === 'string') return table;
  if (Array.isArray(table)) return tableNameFromNode(table, depth + 1);
  return undefined;
}

function collectFromTables(from: unknown, out: Set<string>): void {
  if (!Array.isArray(from)) return;
  for (const item of from) {
    const name = tableNameFromNode(item);
    if (name !== undefined) out.add(name);
  }
}

function columnNames(columns: unknown): string[] {
  if (columns === '*') return ['*'];
  if (!Array.isArray(columns)) return [];
  const names: string[] = [];
  for (const col of columns) {
    if (col === '*') {
      names.push('*');
      continue;
    }
    const c = asNode(col);
    if (c === undefined) continue;
    const expr = asNode(c['expr']);
    if (expr === undefined) continue;
    if (expr['type'] === 'column_ref' && typeof expr['column'] === 'string') {
      names.push(expr['column']);
    } else if (expr['column'] === '*') {
      names.push('*');
    }
  }
  return names;
}

function hasDeletedAtInWhere(where: unknown): boolean {
  if (where === null || where === undefined) return false;
  const json = JSON.stringify(where);
  return json.includes('"deleted_at"');
}

function columnRefName(col: unknown): string | undefined {
  if (typeof col === 'string') return col;
  const o = asNode(col);
  if (o === undefined) return undefined;
  if (typeof o['column'] === 'string') return o['column'];
  const nested = asNode(o['column']);
  if (nested !== undefined) {
    const expr = asNode(nested['expr']);
    if (expr !== undefined && typeof expr['value'] === 'string') {
      return expr['value'];
    }
    if (typeof nested['value'] === 'string') return nested['value'];
  }
  const expr = asNode(o['expr']);
  if (expr !== undefined && typeof expr['value'] === 'string') {
    return expr['value'];
  }
  if (typeof o['value'] === 'string') return o['value'];
  return undefined;
}

function setAssignsDeletedAt(set: unknown): boolean {
  if (!Array.isArray(set)) return false;
  for (const item of set) {
    const node = asNode(item);
    if (node === undefined) continue;
    if (columnRefName(node['column']) === 'deleted_at') return true;
  }
  return false;
}

/** node-sql-parser emits `limit: { value: [] }` when absent — treat empty as no LIMIT. */
function selectHasLimit(limit: unknown): boolean {
  if (limit === null || limit === undefined) return false;
  const node = asNode(limit);
  if (node === undefined) return true;
  const value = node['value'];
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function classifyDelete(ast: AstNode): ClassifiedStatement {
  const table =
    tableNameFromNode(ast['from']) ?? tableNameFromNode(ast['table']);
  if (table === undefined) {
    return { kind: 'other', reason: 'delete_without_table' };
  }
  return { kind: 'delete', table };
}

function classifyInsert(ast: AstNode): ClassifiedStatement {
  const table = tableNameFromNode(ast['table']);
  if (table === undefined) {
    return { kind: 'other', reason: 'insert_without_table' };
  }
  const upsert =
    ast['conflict'] !== undefined || ast['onDuplicateUpdate'] !== undefined;
  return {
    kind: 'write',
    table,
    op: upsert ? 'upsert' : 'insert',
    softDelete: false,
  };
}

function classifyUpdate(ast: AstNode): ClassifiedStatement {
  const table = tableNameFromNode(ast['table']);
  if (table === undefined) {
    return { kind: 'other', reason: 'update_without_table' };
  }
  return {
    kind: 'write',
    table,
    op: 'update',
    softDelete: setAssignsDeletedAt(ast['set']),
  };
}

function collectSelectTables(ast: AstNode): string[] {
  const tables = new Set<string>();
  collectFromTables(ast['from'], tables);
  const withClause = ast['with'];
  if (Array.isArray(withClause)) {
    for (const cte of withClause) {
      const cteNode = asNode(cte);
      const stmt = asNode(cteNode?.['stmt']);
      if (stmt !== undefined) collectFromTables(stmt['from'], tables);
    }
  }
  return [...tables].sort();
}

function classifySelect(ast: AstNode): ClassifiedStatement {
  const cols = columnNames(ast['columns']);
  const selectsStar = cols.includes('*') || cols.length === 0;
  return {
    kind: 'read',
    tables: collectSelectTables(ast),
    selectsStar,
    hasDeletedAtColumn: selectsStar || cols.includes('deleted_at'),
    hasDeletedAtPredicate: hasDeletedAtInWhere(ast['where']),
    hasLimit: selectHasLimit(ast['limit']),
  };
}

function classifyAst(ast: AstNode): ClassifiedStatement {
  const type = String(ast['type'] ?? '').toLowerCase();
  if (type === 'delete') return classifyDelete(ast);
  if (type === 'insert') return classifyInsert(ast);
  if (type === 'update') return classifyUpdate(ast);
  if (type === 'select') return classifySelect(ast);
  return { kind: 'other', reason: `unsupported_${type || 'unknown'}` };
}

const AST_CACHE_MAX = 256;
const MAX_AST_TABLE_WALK_DEPTH = 64;
/** LRU (Map insertion order): sqlTextForAst → AST root. */
const astCache = new Map<string, AstNode>();

function touchCache(text: string, node: AstNode): void {
  if (astCache.has(text)) astCache.delete(text);
  else if (astCache.size >= AST_CACHE_MAX) {
    const oldest = astCache.keys().next().value;
    if (oldest !== undefined) astCache.delete(oldest);
  }
  astCache.set(text, node);
}

/**
 * Parse mutation/query SQL to an AST node. Cached by {@link sqlTextForAst}
 * (bound params replaced with NULL) so repeated templates hit once.
 */
export function parseSqlAst(query: Sql<unknown>): AstNode | undefined {
  const text = sqlTextForAst(query);
  const hit = astCache.get(text);
  if (hit !== undefined) {
    touchCache(text, hit);
    return hit;
  }
  try {
    const ast = parser.astify(text, { database: 'PostgreSQL' });
    const first = asArray(ast)[0];
    const node = asNode(first);
    if (node === undefined) return undefined;
    touchCache(text, node);
    return node;
  } catch {
    return undefined;
  }
}

/**
 * Classify a statement for mutation capture / query enforcement.
 * Parse with PostgreSQL — SQLite dialect rejects ON CONFLICT DO UPDATE.
 */
export function classify(
  query: Sql<unknown>,
  _dialect: SqlAstDialect = 'postgresql'
): ClassifiedStatement {
  const text = sqlTextForAst(query);
  const cached = astCache.get(text);
  if (cached !== undefined) {
    touchCache(text, cached);
    return classifyAst(cached);
  }
  try {
    const ast = parser.astify(text, { database: 'PostgreSQL' });
    const first = asArray(ast)[0];
    const node = asNode(first);
    if (node === undefined) {
      return { kind: 'other', reason: 'empty_ast' };
    }
    touchCache(text, node);
    return classifyAst(node);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { kind: 'other', reason: `parse_error:${message}` };
  }
}

/** True when statement already has a RETURNING clause. */
export function hasReturningClause(query: Sql<unknown>): boolean {
  return /\bRETURNING\b/i.test(query.sql);
}
