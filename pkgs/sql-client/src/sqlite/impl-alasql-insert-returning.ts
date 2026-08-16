/**
 * Emulate SQLite `INSERT … RETURNING` for AlaSQL (parse → INSERT → SELECT).
 */

import {
  quoteIdentForAlaSql,
  splitTopLevelCommas,
  unquoteIdent,
} from './impl-alasql-adapt';

export type InsertReturningPlan = {
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  /** `null` means `RETURNING *`. */
  readonly returning: readonly string[] | null;
};

/**
 * Plain `INSERT INTO t (cols) VALUES (…) RETURNING …` (not ON CONFLICT).
 */
export function planInsertReturning(
  sqlText: string
): InsertReturningPlan | null {
  if (!/\bRETURNING\b/i.test(sqlText) || /\bON\s+CONFLICT\b/i.test(sqlText)) {
    return null;
  }
  const m =
    /^INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+?)\)\s+RETURNING\s+([\s\S]+?)\s*;?\s*$/i.exec(
      sqlText.trim()
    );
  if (m == null) return null;
  const returningRaw = m[4]!.trim();
  return {
    table: unquoteIdent(m[1]!),
    columns: m[2]!.split(',').map((c) => unquoteIdent(c.trim())),
    valueTokens: splitTopLevelCommas(m[3]!),
    returning:
      returningRaw === '*'
        ? null
        : returningRaw.split(',').map((c) => unquoteIdent(c.trim())),
  };
}

export type InsertReturningSteps = {
  readonly insertSql: string;
  readonly insertParams: unknown[];
  readonly selectSql: string;
  readonly selectParams: unknown[];
};

function insertReturningWhere(
  plan: InsertReturningPlan,
  params: readonly unknown[] | undefined
): { whereSql: string; selectParams: unknown[] } {
  const idIdx = plan.columns.findIndex((c) => c.toLowerCase() === 'id');
  if (idIdx >= 0) {
    const token = plan.valueTokens[idIdx]!.trim();
    if (token === '?') {
      let p = 0;
      for (let i = 0; i < idIdx; i += 1) {
        if (plan.valueTokens[i]!.trim() === '?') p += 1;
      }
      return {
        whereSql: `${quoteIdentForAlaSql('id')} = ?`,
        selectParams: [params?.[p]],
      };
    }
    return {
      whereSql: `${quoteIdentForAlaSql('id')} = ${token}`,
      selectParams: [],
    };
  }
  const parts: string[] = [];
  const selectParams: unknown[] = [];
  let p = 0;
  for (let i = 0; i < plan.columns.length; i += 1) {
    const col = quoteIdentForAlaSql(plan.columns[i]!);
    const token = plan.valueTokens[i]!.trim();
    if (token === '?') {
      parts.push(`${col} = ?`);
      selectParams.push(params?.[p]);
      p += 1;
    } else if (/^null$/i.test(token)) {
      parts.push(`${col} IS NULL`);
    } else {
      parts.push(`${col} = ${token}`);
    }
  }
  return { whereSql: parts.join(' AND '), selectParams };
}

/** Expand INSERT…RETURNING into INSERT + SELECT-by-id (or all columns). */
export function buildInsertReturningSteps(
  plan: InsertReturningPlan,
  params: readonly unknown[] | undefined
): InsertReturningSteps {
  const table = quoteIdentForAlaSql(plan.table);
  const colList = plan.columns.map(quoteIdentForAlaSql).join(', ');
  const insertSql = `INSERT INTO ${table} (${colList}) VALUES (${plan.valueTokens.join(', ')})`;
  const { whereSql, selectParams } = insertReturningWhere(plan, params);
  const selectCols =
    plan.returning == null
      ? '*'
      : plan.returning.map(quoteIdentForAlaSql).join(', ');
  return {
    insertSql,
    insertParams: [...(params ?? [])],
    selectSql: `SELECT ${selectCols} FROM ${table} WHERE ${whereSql}`,
    selectParams,
  };
}
