/**
 * Rewrite SQLite-flavored SQL that AlaSQL's parser rejects.
 * Does not handle PRAGMA / sqlite_master (those are intercepted separately).
 */

/** Exact column/alias names AlaSQL treats as keywords (app schema hit list). */
const RESERVED_COL_IDENTS = ['cursor', 'value', 'count'] as const;

/**
 * Identifier prefixes AlaSQL's lexer swallows as keywords (`schema_fingerprint`
 * → SCHEMA token). Quote the whole ident with backticks.
 */
const RESERVED_COL_PREFIXES = ['schema', 'database'] as const;

/** Strip SQLite-only clauses AlaSQL cannot parse. */
export function adaptSqliteDialect(sqlText: string): string {
  let sql = sqlText.trim();
  // Keep RETURNING on ON CONFLICT upserts — the AlaSQL executor emulates it.
  // Strip RETURNING elsewhere (AlaSQL cannot parse it).
  if (!/\bON\s+CONFLICT\b/i.test(sql)) {
    sql = sql.replace(/\s+RETURNING\b[\s\S]*$/i, '').trim();
  }
  // CREATE TABLE … STRICT
  sql = sql.replace(/\)\s*STRICT\s*$/i, ')');
  // CREATE [UNIQUE] INDEX IF NOT EXISTS name → CREATE [UNIQUE] INDEX name
  sql = sql.replace(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+/i,
    (_m, unique: string | undefined) =>
      `CREATE ${unique !== undefined && unique.length > 0 ? 'UNIQUE ' : ''}INDEX `
  );
  // DROP INDEX IF NOT EXISTS name → DROP INDEX name
  sql = sql.replace(/^DROP\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/i, 'DROP INDEX ');
  // AlaSQL rejects SQLite double-quoted idents; unquote safe names.
  sql = unquoteSafeIdents(sql);
  // Quote reserved column idents with backticks (AlaSQL accepts these).
  sql = quoteReservedColIdents(sql);
  sql = quoteReservedColPrefixes(sql);
  return sql.trim();
}

/** `"profiles"` → `profiles` when the name is a simple ident (no spaces). */
function unquoteSafeIdents(sql: string): string {
  return sql.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '$1');
}

/**
 * Wrap reserved column names in backticks. Skips the `VALUES` keyword,
 * idents that are already backticked, and function calls (`COUNT(`).
 */
function quoteReservedColIdents(sql: string): string {
  let out = sql;
  for (const col of RESERVED_COL_IDENTS) {
    const re = new RegExp(`\\b(${col})\\b`, 'gi');
    out = out.replace(re, (match, _g, offset: number, full: string) => {
      const prev = offset > 0 ? full[offset - 1] : '';
      const next = full[offset + match.length] ?? '';
      if (prev === '`' || next === '`') return match;
      // Aggregate / function call — keep bare `COUNT(...)`.
      if (next === '(') return match;
      const slice = full.slice(offset, offset + match.length + 8).toUpperCase();
      if (slice.startsWith('VALUES')) return match;
      return `\`${match}\``;
    });
  }
  return out;
}

/**
 * Backtick idents whose names start with a reserved keyword prefix
 * (`schema_fingerprint`, `database_url`, …).
 */
function quoteReservedColPrefixes(sql: string): string {
  let out = sql;
  for (const prefix of RESERVED_COL_PREFIXES) {
    const re = new RegExp(`\\b(${prefix}[A-Za-z0-9_]*)\\b`, 'gi');
    out = out.replace(re, (match, _g, offset: number, full: string) => {
      const prev = offset > 0 ? full[offset - 1] : '';
      const next = full[offset + match.length] ?? '';
      if (prev === '`' || next === '`') return match;
      return `\`${match}\``;
    });
  }
  return out;
}

/**
 * AlaSQL's parser only accepts numeric literals for LIMIT / OFFSET — not `?`.
 * Inline those placeholders and drop them from the bind list (left-to-right `?`
 * order, same as SQLite).
 */
export function inlineLimitOffsetParams(
  sqlText: string,
  params: readonly unknown[] | undefined
): { sql: string; params: unknown[] } {
  if (params == null || params.length === 0) {
    return { sql: sqlText, params: params == null ? [] : [...params] };
  }
  let paramIndex = 0;
  const kept: unknown[] = [];
  const sql = sqlText.replace(/\?/g, (_match, offset: number, full: string) => {
    const value = params[paramIndex];
    paramIndex += 1;
    if (/\b(?:LIMIT|OFFSET)\s*$/i.test(full.slice(0, offset))) {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? String(Math.trunc(n)) : '0';
    }
    kept.push(value);
    return '?';
  });
  return { sql, params: kept };
}

export function isPragmaSql(sqlText: string): boolean {
  return /^\s*PRAGMA\b/i.test(sqlText);
}

export function isSqliteMasterSql(sqlText: string): boolean {
  return /\bsqlite_master\b/i.test(sqlText);
}

export function parsePragmaBody(sqlText: string): string | null {
  const m = /^\s*PRAGMA\s+(.+?)\s*;?\s*$/i.exec(sqlText.trim());
  return m?.[1]?.trim() ?? null;
}

/** `CREATE [UNIQUE] INDEX name ON table (cols)` after dialect adapt. */
export function parseCreateIndex(
  sqlText: string
): { name: string; table: string; columns: string[]; unique: boolean } | null {
  const m =
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s+ON\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s*\(([^)]+)\)\s*;?\s*$/i.exec(
      sqlText.trim()
    );
  if (m == null) return null;
  return {
    unique: (m[1] ?? '').length > 0,
    name: unquoteIdent(m[2]!),
    table: unquoteIdent(m[3]!),
    columns: m[4]!.split(',').map((c) => unquoteIdent(c.trim())),
  };
}

export function parseDropIndex(sqlText: string): string | null {
  const m = /^DROP\s+INDEX\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s*;?\s*$/i.exec(
    sqlText.trim()
  );
  return m != null ? unquoteIdent(m[1]!) : null;
}

export function parseDropTable(sqlText: string): string | null {
  const m =
    /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[A-Za-z_][A-Za-z0-9_]*"?)\s*;?\s*$/i.exec(
      sqlText.trim()
    );
  return m != null ? unquoteIdent(m[1]!) : null;
}

export function unquoteIdent(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  if (t.startsWith('`') && t.endsWith('`')) {
    return t.slice(1, -1);
  }
  return t;
}

export type OnConflictUpsertPlan = {
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  readonly conflictColumns: readonly string[];
  readonly conflictValues: readonly (
    | { readonly kind: 'literal'; readonly sql: string }
    | { readonly kind: 'param'; readonly index: number }
  )[];
  readonly mode: 'nothing' | 'update';
  /** Raw SET clause body when mode is update (may reference EXCLUDED / table). */
  readonly updateSet: string | null;
  /** Columns listed after RETURNING, or null if absent. */
  readonly returning: readonly string[] | null;
};

/**
 * AlaSQL has no `ON CONFLICT`. Parse single-row
 * `INSERT INTO t (cols) VALUES (…) ON CONFLICT (…) DO … [RETURNING …]`.
 */
export function planOnConflictUpsert(
  sqlText: string
): OnConflictUpsertPlan | null {
  const m =
    /^INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+?)\)\s*ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+(NOTHING|UPDATE\s+SET\s+([\s\S]+?))(?:\s+RETURNING\s+([\s\S]+?))?\s*;?\s*$/i.exec(
      sqlText.trim()
    );
  if (m == null) return null;

  const table = unquoteIdent(m[1]!);
  const columns = m[2]!.split(',').map((c) => unquoteIdent(c.trim()));
  const valueTokens = splitTopLevelCommas(m[3]!);
  if (valueTokens.length !== columns.length) return null;

  const conflictColumns = m[4]!.split(',').map((c) => unquoteIdent(c.trim()));
  let paramIndex = 0;
  const valueParamIndexes: number[] = [];
  for (const token of valueTokens) {
    if (token === '?') {
      valueParamIndexes.push(paramIndex);
      paramIndex += 1;
    } else {
      valueParamIndexes.push(-1);
    }
  }

  const conflictValues: OnConflictUpsertPlan['conflictValues'][number][] = [];
  for (const conflictCol of conflictColumns) {
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

  const doKind = m[5]!.trim().toUpperCase();
  const mode: 'nothing' | 'update' = doKind.startsWith('NOTHING')
    ? 'nothing'
    : 'update';
  const updateSet = mode === 'update' ? (m[6]?.trim() ?? null) : null;
  const returningRaw = m[7]?.trim();
  const returning =
    returningRaw != null && returningRaw.length > 0
      ? returningRaw.split(',').map((c) => unquoteIdent(c.trim()))
      : null;

  return {
    table,
    columns,
    valueTokens,
    conflictColumns,
    conflictValues,
    mode,
    updateSet,
    returning,
  };
}

/** Split on commas that are not inside nested parentheses. */
function splitTopLevelCommas(valuesList: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < valuesList.length; i += 1) {
    const ch = valuesList[i]!;
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      out.push(valuesList.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(valuesList.slice(start).trim());
  return out;
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

/**
 * Expand an upsert plan into SELECT-exists → UPDATE|INSERT → optional RETURNING
 * SELECT. Rewrites `EXCLUDED.col` to the insert value and `table.col` / bare
 * `col` increments to AlaSQL-safe expressions.
 */
export function buildUpsertExecSteps(
  plan: OnConflictUpsertPlan,
  params: readonly unknown[] | undefined
): UpsertExecSteps {
  const where = conflictWhere(plan, params);
  const table = quoteIdentForAlaSql(plan.table);
  const colList = plan.columns.map(quoteIdentForAlaSql).join(', ');
  const valList = plan.valueTokens.join(', ');
  const insertParams = [...(params ?? [])];

  let updateSql: string | null = null;
  let updateParams: unknown[] = [];
  if (plan.mode === 'update' && plan.updateSet != null) {
    const rewritten = rewriteExcludedRefs({
      setClause: plan.updateSet,
      table: plan.table,
      columns: plan.columns,
      valueTokens: plan.valueTokens,
      params,
    });
    updateSql = `UPDATE ${table} SET ${rewritten.sql} WHERE ${where.sql}`;
    updateParams = [...rewritten.params, ...where.params];
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

type RewriteExcludedRefsArgs = {
  readonly setClause: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly valueTokens: readonly string[];
  readonly params: readonly unknown[] | undefined;
};

/**
 * `EXCLUDED.col` → literal/`?` from VALUES; `table.col` → `col` for SET exprs.
 */
function rewriteExcludedRefs(args: RewriteExcludedRefsArgs): {
  sql: string;
  params: unknown[];
} {
  const outParams: unknown[] = [];
  let sql = args.setClause;
  // table.col / table.`col` → col (increment patterns)
  const tableRe = new RegExp(
    `\\b${escapeRegExp(args.table)}\\.\`?([A-Za-z_][A-Za-z0-9_]*)\`?\\b`,
    'gi'
  );
  sql = sql.replace(tableRe, (_m, col: string) => quoteIdentForAlaSql(col));
  // EXCLUDED.col → value token (and collect ? params in SET order)
  sql = sql.replace(
    /\bEXCLUDED\.`?([A-Za-z_][A-Za-z0-9_]*)`?\b/gi,
    (_m, col: string) => {
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quoteIdentForAlaSql(ident: string): string {
  const lower = ident.toLowerCase();
  if (
    RESERVED_COL_IDENTS.some((r) => r === lower) ||
    RESERVED_COL_PREFIXES.some((p) => lower.startsWith(p))
  ) {
    return `\`${ident}\``;
  }
  return ident;
}
