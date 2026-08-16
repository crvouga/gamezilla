/**
 * Emulate SQLite `UPDATE … RETURNING` for AlaSQL (UPDATE → SELECT by WHERE).
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
  readonly updateSql: string;
  readonly updateParams: unknown[];
  readonly selectSql: string;
  readonly selectParams: unknown[];
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

/** Expand UPDATE…RETURNING into UPDATE + SELECT with the same WHERE. */
export function buildUpdateReturningSteps(
  plan: UpdateReturningPlan,
  params: readonly unknown[] | undefined
): UpdateReturningSteps {
  const table = quoteIdentForAlaSql(plan.table);
  const allParams = [...(params ?? [])];
  const wherePlaceholders = countPlaceholders(plan.whereSql);
  const setPlaceholders = countPlaceholders(plan.setSql);
  const expected = setPlaceholders + wherePlaceholders;
  if (allParams.length < expected) {
    throw new Error(
      `SqlClientImplAlaSql UPDATE RETURNING: expected ${expected} params, got ${allParams.length}`
    );
  }
  const selectParams = allParams.slice(setPlaceholders, expected);
  const selectCols =
    plan.returning == null
      ? '*'
      : plan.returning.map(quoteIdentForAlaSql).join(', ');
  return {
    updateSql: `UPDATE ${table} SET ${plan.setSql} WHERE ${plan.whereSql}`,
    updateParams: allParams,
    selectSql: `SELECT ${selectCols} FROM ${table} WHERE ${plan.whereSql}`,
    selectParams,
  };
}
