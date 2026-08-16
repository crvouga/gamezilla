/**
 * Emulate SQLite `INSERT … ON CONFLICT` for AlaSQL (parse → exists → UPDATE|INSERT).
 */

import {
  quoteIdentForAlaSql,
  splitTopLevelCommas,
  unquoteIdent,
} from './impl-alasql-adapt';

export type OnConflictUpsertPlan = {
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  /** Start index into the statement's params for this row's `?` bindings. */
  readonly paramStart: number;
  readonly conflictColumns: readonly string[];
  readonly conflictValues: readonly (
    | { readonly kind: 'literal'; readonly sql: string }
    | { readonly kind: 'param'; readonly index: number }
  )[];
  readonly mode: 'nothing' | 'update';
  readonly updateSet: string | null;
  readonly updateWhere: string | null;
  readonly returning: readonly string[] | null;
};

function findTopLevelOnConflict(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && /^ON\s+CONFLICT\b/i.test(s.slice(i))) return i;
  }
  return -1;
}

/** Skip commas/whitespace; return next index or -1 at end. */
function skipSeparators(s: string, i: number): number {
  let j = i;
  while (j < s.length && (s[j] === ',' || /\s/.test(s[j]!))) j += 1;
  return j < s.length ? j : -1;
}

/** Find matching `)` for `(` at `openIdx`; return index of `)` or -1. */
function matchingCloseParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `(a, 1),(?, 2)` → `['a, 1', '?, 2']` (tuple interiors). */
export function splitValueTuples(valuesBody: string): string[] {
  const out: string[] = [];
  const s = valuesBody.trim();
  let i = 0;
  while (i < s.length) {
    i = skipSeparators(s, i);
    if (i < 0) break;
    if (s[i] !== '(') return [];
    const close = matchingCloseParen(s, i);
    if (close < 0) return [];
    out.push(s.slice(i + 1, close).trim());
    i = close + 1;
  }
  return out;
}

function planUpsertRow(args: {
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  readonly paramStart: number;
  readonly conflictColumns: readonly string[];
  readonly mode: 'nothing' | 'update';
  readonly updateSet: string | null;
  readonly updateWhere: string | null;
  readonly returning: readonly string[] | null;
}): OnConflictUpsertPlan | null {
  const { columns, valueTokens } = args;
  if (valueTokens.length !== columns.length) return null;
  let localParam = 0;
  const valueParamIndexes: number[] = [];
  for (const token of valueTokens) {
    if (token.trim() === '?') {
      valueParamIndexes.push(localParam);
      localParam += 1;
    } else {
      valueParamIndexes.push(-1);
    }
  }
  const conflictValues: OnConflictUpsertPlan['conflictValues'][number][] = [];
  for (const conflictCol of args.conflictColumns) {
    const colIdx = columns.findIndex(
      (c) => c.toLowerCase() === conflictCol.toLowerCase()
    );
    if (colIdx < 0) return null;
    const token = valueTokens[colIdx]!.trim();
    if (token === '?') {
      conflictValues.push({
        kind: 'param',
        index: valueParamIndexes[colIdx]!,
      });
    } else {
      conflictValues.push({ kind: 'literal', sql: token });
    }
  }
  return {
    table: args.table,
    columns,
    valueTokens,
    paramStart: args.paramStart,
    conflictColumns: args.conflictColumns,
    conflictValues,
    mode: args.mode,
    updateSet: args.updateSet,
    updateWhere: args.updateWhere,
    returning: args.returning,
  };
}

function splitTrailingWhere(setClause: string): {
  body: string;
  where: string | null;
} {
  let depth = 0;
  for (let i = 0; i < setClause.length; i += 1) {
    const ch = setClause[i]!;
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (
      depth === 0 &&
      /\bWHERE\b/i.test(setClause.slice(i, i + 5)) &&
      (i === 0 || /\s/.test(setClause[i - 1]!))
    ) {
      const rest = setClause.slice(i);
      const m = /^WHERE\b/i.exec(rest);
      if (m != null) {
        return {
          body: setClause.slice(0, i).trim(),
          where: setClause.slice(i + m[0].length).trim() || null,
        };
      }
    }
  }
  return { body: setClause, where: null };
}

/**
 * Parse one-or-more-row
 * `INSERT INTO t (cols) VALUES (…),(…) ON CONFLICT (…) DO … [RETURNING …]`.
 */
export function planOnConflictUpsert(
  sqlText: string
): readonly OnConflictUpsertPlan[] | null {
  const trimmed = sqlText.trim();
  const head = /^INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s+/i.exec(
    trimmed
  );
  if (head == null) return null;
  const afterValues = trimmed.slice(head[0].length);
  const onAt = findTopLevelOnConflict(afterValues);
  if (onAt < 0) return null;
  const onM =
    /^ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+(NOTHING|UPDATE\s+SET\s+([\s\S]+?))(?:\s+RETURNING\s+([\s\S]+?))?\s*;?\s*$/i.exec(
      afterValues.slice(onAt).trim()
    );
  if (onM == null) return null;

  const table = unquoteIdent(head[1]!);
  const columns = head[2]!.split(',').map((c) => unquoteIdent(c.trim()));
  const tuples = splitValueTuples(afterValues.slice(0, onAt));
  if (tuples.length === 0) return null;

  const conflictColumns = onM[1]!.split(',').map((c) => unquoteIdent(c.trim()));
  const doKind = onM[2]!.trim().toUpperCase();
  const mode: 'nothing' | 'update' = doKind.startsWith('NOTHING')
    ? 'nothing'
    : 'update';
  let updateSet = mode === 'update' ? (onM[3]?.trim() ?? null) : null;
  let updateWhere: string | null = null;
  if (updateSet != null) {
    const split = splitTrailingWhere(updateSet);
    updateSet = split.body;
    updateWhere = split.where;
  }
  const returningRaw = onM[4]?.trim();
  const returning =
    returningRaw != null && returningRaw.length > 0
      ? returningRaw.split(',').map((c) => unquoteIdent(c.trim()))
      : null;

  const plans: OnConflictUpsertPlan[] = [];
  let paramStart = 0;
  for (const tuple of tuples) {
    const valueTokens = splitTopLevelCommas(tuple);
    const plan = planUpsertRow({
      table,
      columns,
      valueTokens,
      paramStart,
      conflictColumns,
      mode,
      updateSet,
      updateWhere,
      returning,
    });
    if (plan == null) return null;
    plans.push(plan);
    paramStart += valueTokens.filter((t) => t.trim() === '?').length;
  }
  return plans;
}

function conflictWhere(
  plan: OnConflictUpsertPlan,
  params: readonly unknown[] | undefined
): { sql: string; params: unknown[] } {
  const whereParts: string[] = [];
  const whereParams: unknown[] = [];
  for (let i = 0; i < plan.conflictColumns.length; i += 1) {
    const col = plan.conflictColumns[i]!;
    const spec = plan.conflictValues[i]!;
    if (spec.kind === 'literal') {
      whereParts.push(`${quoteIdentForAlaSql(col)} = ${spec.sql}`);
    } else {
      whereParts.push(`${quoteIdentForAlaSql(col)} = ?`);
      whereParams.push(params?.[spec.index]);
    }
  }
  return { sql: whereParts.join(' AND '), params: whereParams };
}

/** Build `DELETE FROM table WHERE …` (legacy simple replace path). */
export function buildConflictDelete(
  plan: OnConflictUpsertPlan,
  params: readonly unknown[] | undefined
): { sql: string; params: unknown[] } {
  const where = conflictWhere(plan, params);
  return {
    sql: `DELETE FROM ${quoteIdentForAlaSql(plan.table)} WHERE ${where.sql}`,
    params: where.params,
  };
}

export type UpsertExecSteps = {
  readonly existsSelectSql: string;
  readonly existsParams: unknown[];
  readonly insertSql: string;
  readonly insertParams: unknown[];
  readonly updateSql: string | null;
  readonly updateParams: unknown[];
  readonly returningSelectSql: string | null;
  readonly returningParams: unknown[];
};

type RewriteExcludedRefsArgs = {
  readonly setClause: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  readonly params: readonly unknown[] | undefined;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteExcludedRefs(args: RewriteExcludedRefsArgs): {
  sql: string;
  params: unknown[];
} {
  const outParams: unknown[] = [];
  let sql = args.setClause;
  const tableRe = new RegExp(
    `\\b${escapeRegExp(args.table)}\\.(?:\`([A-Za-z_][A-Za-z0-9_]*)\`|([A-Za-z_][A-Za-z0-9_]*)\\b)`,
    'gi'
  );
  sql = sql.replace(tableRe, (_m, quoted: string, bare: string) =>
    quoteIdentForAlaSql(quoted ?? bare)
  );
  sql = sql.replace(
    /\bEXCLUDED\.(?:`([A-Za-z_][A-Za-z0-9_]*)`|([A-Za-z_][A-Za-z0-9_]*)\b)/gi,
    (_m, quoted: string, bare: string) => {
      const col = quoted ?? bare;
      const idx = args.columns.findIndex(
        (c) => c.toLowerCase() === col.toLowerCase()
      );
      if (idx < 0) return 'NULL';
      const token = args.valueTokens[idx]!.trim();
      if (token === '?') {
        let p = 0;
        for (let i = 0; i < idx; i += 1) {
          if (args.valueTokens[i]!.trim() === '?') p += 1;
        }
        outParams.push(args.params?.[p]);
        return '?';
      }
      return token;
    }
  );
  return { sql, params: outParams };
}

/** Expand upsert plan into SELECT-exists → UPDATE|INSERT → optional RETURNING. */
export function buildUpsertExecSteps(
  plan: OnConflictUpsertPlan,
  params: readonly unknown[] | undefined
): UpsertExecSteps {
  const paramCount = plan.valueTokens.filter((t) => t.trim() === '?').length;
  const rowParams = (params ?? []).slice(
    plan.paramStart,
    plan.paramStart + paramCount
  );
  const where = conflictWhere(plan, rowParams);
  const table = quoteIdentForAlaSql(plan.table);
  const colList = plan.columns.map(quoteIdentForAlaSql).join(', ');
  const valList = plan.valueTokens.join(', ');
  const insertParams = [...rowParams];

  let updateSql: string | null = null;
  let updateParams: unknown[] = [];
  if (plan.mode === 'update' && plan.updateSet != null) {
    const rewritten = rewriteExcludedRefs({
      setClause: plan.updateSet,
      table: plan.table,
      columns: plan.columns,
      valueTokens: plan.valueTokens,
      params: rowParams,
    });
    let whereSql = where.sql;
    updateParams = [...rewritten.params, ...where.params];
    if (plan.updateWhere != null && plan.updateWhere.length > 0) {
      const pred = rewriteExcludedRefs({
        setClause: plan.updateWhere,
        table: plan.table,
        columns: plan.columns,
        valueTokens: plan.valueTokens,
        params: rowParams,
      });
      whereSql = `${where.sql} AND (${pred.sql})`;
      updateParams = [...rewritten.params, ...where.params, ...pred.params];
    }
    updateSql = `UPDATE ${table} SET ${rewritten.sql} WHERE ${whereSql}`;
  }

  let returningSelectSql: string | null = null;
  if (plan.returning != null && plan.returning.length > 0) {
    const cols = plan.returning.map(quoteIdentForAlaSql).join(', ');
    returningSelectSql = `SELECT ${cols} FROM ${table} WHERE ${where.sql}`;
  }

  return {
    existsSelectSql: `SELECT 1 AS present FROM ${table} WHERE ${where.sql}`,
    existsParams: where.params,
    insertSql: `INSERT INTO ${table} (${colList}) VALUES (${valList})`,
    insertParams,
    updateSql,
    updateParams,
    returningSelectSql,
    returningParams: where.params,
  };
}
