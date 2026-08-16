/**
 * Emulate SQLite `UPDATE … RETURNING` for AlaSQL.
 *
 * Must not re-run the original WHERE after UPDATE: predicates like
 * `ended_at IS NULL` / `deleted_at IS NULL` match zero rows once the write
 * lands. Capture matching ids first, UPDATE, then SELECT by `id`.
 */

import { quoteIdentForAlaSql, unquoteIdent } from './impl-alasql-adapt';

export type UpdateReturningPlan = {
  readonly table: string;
  readonly setSql: string;
  readonly whereSql: string;
  /** `null` means `RETURNING *`. */
  readonly returning: readonly string[] | null;
};

/**
 * `UPDATE t SET … WHERE … RETURNING …` (not upsert).
 */
export function planUpdateReturning(
  sqlText: string
): UpdateReturningPlan | null {
  if (!/\bRETURNING\b/i.test(sqlText) || !/^\s*UPDATE\b/i.test(sqlText)) {
    return null;
  }
  if (/\bON\s+CONFLICT\b/i.test(sqlText)) return null;
  const m =
    /^UPDATE\s+([^\s]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)\s+RETURNING\s+([\s\S]+?)\s*;?\s*$/i.exec(
      sqlText.trim()
    );
  if (m == null) return null;
  const returningRaw = m[4]!.trim();
  return {
    table: unquoteIdent(m[1]!),
    setSql: m[2]!.trim(),
    whereSql: m[3]!.trim(),
    returning:
      returningRaw === '*'
        ? null
        : returningRaw.split(',').map((c) => unquoteIdent(c.trim())),
  };
}

export type UpdateReturningSteps = {
  readonly tableSql: string;
  readonly selectCols: string;
  readonly updateSql: string;
  readonly updateParams: unknown[];
  /** Rows that will be updated (same WHERE as the UPDATE). */
  readonly preSelectSql: string;
  readonly preSelectParams: unknown[];
};

function countPlaceholders(sqlFragment: string): number {
  let count = 0;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sqlFragment.length; i += 1) {
    const ch = sqlFragment[i]!;
    if (quote !== null) {
      if (ch === quote && sqlFragment[i + 1] === quote) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '?') count += 1;
  }
  return count;
}

/** Expand UPDATE…RETURNING into pre-SELECT (WHERE) + UPDATE. */
export function buildUpdateReturningSteps(
  plan: UpdateReturningPlan,
  params: readonly unknown[] | undefined
): UpdateReturningSteps {
  const tableSql = quoteIdentForAlaSql(plan.table);
  const allParams = [...(params ?? [])];
  const wherePlaceholders = countPlaceholders(plan.whereSql);
  const setPlaceholders = countPlaceholders(plan.setSql);
  const expected = setPlaceholders + wherePlaceholders;
  if (allParams.length < expected) {
    throw new Error(
      `SqlClientImplAlaSql UPDATE RETURNING: expected ${expected} params, got ${allParams.length}`
    );
  }
  const preSelectParams = allParams.slice(setPlaceholders, expected);
  const selectCols =
    plan.returning == null
      ? '*'
      : plan.returning.map(quoteIdentForAlaSql).join(', ');
  return {
    tableSql,
    selectCols,
    updateSql: `UPDATE ${tableSql} SET ${plan.setSql} WHERE ${plan.whereSql}`,
    updateParams: allParams,
    preSelectSql: `SELECT id FROM ${tableSql} WHERE ${plan.whereSql}`,
    preSelectParams,
  };
}

/** Post-image SELECT by primary key after UPDATE. */
export function buildUpdateReturningPostSelect(
  steps: UpdateReturningSteps,
  ids: readonly unknown[]
): { readonly sql: string; readonly params: unknown[] } | null {
  if (ids.length === 0) return null;
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT ${steps.selectCols} FROM ${steps.tableSql} WHERE id IN (${placeholders})`,
    params: [...ids],
  };
}
