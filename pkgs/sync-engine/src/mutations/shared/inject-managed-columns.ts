/**
 * Ensure domain writes supply managed columns from MutationEnv (no SQL defaults).
 */
import { type RawValue, Sql } from '@pkgs/sql';

import { parseSqlAst } from '../../sql-ast/classify';
import type { MutationEnv } from '../core/types';

const MANAGED_INSERT = ['id', 'created_at', 'updated_at'] as const;

type AstNode = Record<string, unknown>;

function asNode(v: unknown): AstNode | undefined {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as AstNode;
  }
  return undefined;
}

/**
 * INSERT column list shapes from node-sql-parser (PostgreSQL):
 * - `{ type: 'default', value: 'id' }` (common)
 * - string / `{ column: 'id' }` / SELECT-style `{ expr: { type: 'column_ref', column } }`
 */
function columnNames(columns: unknown): string[] {
  if (columns === '*') return ['*'];
  if (!Array.isArray(columns)) return [];
  const names: string[] = [];
  for (const col of columns) {
    if (col === '*') {
      names.push('*');
      continue;
    }
    if (typeof col === 'string') {
      names.push(col);
      continue;
    }
    const c = asNode(col);
    if (c === undefined) continue;
    if (typeof c['value'] === 'string') {
      names.push(c['value']);
      continue;
    }
    const expr = asNode(c['expr']);
    if (expr !== undefined) {
      if (expr['type'] === 'column_ref' && typeof expr['column'] === 'string') {
        names.push(expr['column']);
        continue;
      }
    }
    if (typeof c['column'] === 'string') names.push(c['column']);
  }
  return names;
}

function setColumnNames(set: unknown): string[] {
  if (!Array.isArray(set)) return [];
  const names: string[] = [];
  for (const item of set) {
    const node = asNode(item);
    if (node === undefined) continue;
    const col = node['column'];
    if (typeof col === 'string') {
      names.push(col);
      continue;
    }
    const colNode = asNode(col);
    if (colNode !== undefined && typeof colNode['column'] === 'string') {
      names.push(colNode['column']);
    }
  }
  return names;
}

/** Build `Sql` from a `?`-placeholder string + bound values. */
function sqlWithValues<T = void>(
  text: string,
  values: readonly unknown[]
): Sql<T> {
  const parts = text.split('?');
  if (parts.length !== values.length + 1) {
    throw new Error(
      `injectManagedColumns: placeholder count ${String(parts.length - 1)} !== values ${String(values.length)}`
    );
  }
  return new Sql<T>(parts, [...values] as RawValue[]);
}

function injectInsert(
  query: Sql<unknown>,
  env: MutationEnv,
  cols: readonly string[]
): Sql<unknown> {
  const missing = MANAGED_INSERT.filter((c) => !cols.includes(c));
  if (missing.length === 0) return query;

  const nowIso = env.now().toISOString();
  const extraValues: unknown[] = [];
  const extraCols: string[] = [];
  for (const col of missing) {
    extraCols.push(col);
    if (col === 'id') extraValues.push(env.createId());
    else extraValues.push(nowIso);
  }

  const text = query.sql;
  const valuesOpen = text.search(/\)\s*VALUES\s*\(/i);
  if (valuesOpen < 0) return query;

  const afterValuesKw = text.slice(valuesOpen).match(/\)\s*VALUES\s*\(/i);
  if (afterValuesKw === null || afterValuesKw.index === undefined) return query;
  const valuesParenOpen =
    valuesOpen + afterValuesKw.index + afterValuesKw[0].length - 1;

  let depth = 0;
  let valuesClose = -1;
  for (let i = valuesParenOpen; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        valuesClose = i;
        break;
      }
    }
  }
  if (valuesClose < 0) return query;

  const colListClose = valuesOpen;
  const head = text.slice(0, colListClose);
  const mid = text.slice(colListClose, valuesClose);
  const tail = text.slice(valuesClose);
  const colSuffix = `, ${extraCols.join(', ')}`;
  const valSuffix = `, ${extraCols.map(() => '?').join(', ')}`;
  const nextText = `${head}${colSuffix}${mid}${valSuffix}${tail}`;
  return sqlWithValues(nextText, [...query.values, ...extraValues]);
}

function injectUpdate(
  query: Sql<unknown>,
  env: MutationEnv,
  setCols: readonly string[]
): Sql<unknown> {
  const text = query.sql;
  // Prefer AST column list; also scan SQL text so we never double-assign
  // `updated_at` (real Postgres / PGlite reject that; postgres-mem did not).
  if (setCols.includes('updated_at') || /\bupdated_at\s*=/i.test(text)) {
    return query;
  }
  const nowIso = env.now().toISOString();
  const setMatch = text.match(/\bSET\b/i);
  if (setMatch === null || setMatch.index === undefined) return query;
  const insertAt = setMatch.index + setMatch[0].length;
  const nextText = `${text.slice(0, insertAt)} updated_at = ?,${text.slice(insertAt)}`;
  return sqlWithValues(nextText, [nowIso, ...query.values]);
}

/**
 * Rewrite domain INSERT/UPDATE so managed columns are bound from {@link MutationEnv}.
 * Shares the AST cache with {@link classify} via {@link parseSqlAst}.
 */
export function injectManagedColumns(
  query: Sql<unknown>,
  env: MutationEnv,
  op: 'insert' | 'upsert' | 'update'
): Sql<unknown> {
  const ast = parseSqlAst(query);
  if (ast === undefined) return query;
  if (op === 'update') {
    return injectUpdate(query, env, setColumnNames(ast['set']));
  }
  return injectInsert(query, env, columnNames(ast['columns']));
}
