/**
 * Rewrite SQLite-flavored SQL that AlaSQL's parser rejects.
 * Does not handle PRAGMA / sqlite_master (those are intercepted separately).
 * ON CONFLICT upsert planning lives in {@link ./impl-alasql-on-conflict}.
 */

/** Exact column/alias names AlaSQL treats as keywords (app schema hit list). */
const RESERVED_COL_IDENTS = ['cursor', 'value', 'count', 'primary'] as const;

/**
 * Identifier prefixes AlaSQL's lexer swallows as keywords (`schema_fingerprint`
 * → SCHEMA token). Quote the whole ident with backticks.
 */
const RESERVED_COL_PREFIXES = ['schema', 'database'] as const;

/** Strip SQLite-only clauses AlaSQL cannot parse. */
export function adaptSqliteDialect(sqlText: string): string {
  let sql = sqlText.trim();
  // Keep RETURNING on ON CONFLICT upserts — the AlaSQL executor emulates it.
  // Plain INSERT…RETURNING is handled via planInsertReturning before adapt.
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
 * `PRIMARY KEY`, idents that are already backticked, and function calls (`COUNT(`).
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
      // DDL constraint — keep bare `PRIMARY KEY`.
      const after = full.slice(offset + match.length).trimStart();
      if (col === 'primary' && /^KEY\b/i.test(after)) return match;
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

/** Split on commas that are not inside nested parentheses. */
export function splitTopLevelCommas(valuesList: string): string[] {
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

export function quoteIdentForAlaSql(ident: string): string {
  const lower = ident.toLowerCase();
  if (
    RESERVED_COL_IDENTS.some((r) => r === lower) ||
    RESERVED_COL_PREFIXES.some((p) => lower.startsWith(p))
  ) {
    return `\`${ident}\``;
  }
  return ident;
}
