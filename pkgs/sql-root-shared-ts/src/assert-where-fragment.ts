import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * Advances past a SQL string literal that begins at `start` (`sql[start]` must
 * be `'` or `"`). Doubled-quote escapes (`''`, `""`) are treated as
 * single-character literals as in SQLite/Postgres. Returns the index of the
 * character immediately after the closing quote (or `sql.length` if the
 * literal is unterminated, which the caller treats as an error elsewhere).
 */
function skipStringLiteral(sql: string, start: number): number {
  const quote = sql[start];
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] !== quote) {
      i++;
      continue;
    }
    if (sql[i + 1] === quote) {
      i += 2;
      continue;
    }
    return i + 1;
  }
  return i;
}

/**
 * Counts unquoted `?` placeholders in a SQL fragment. Skips any `?` inside
 * `'...'` or `"..."` string literals.  Used by {@link assertWhereFragment} to
 * verify that the placeholder count matches the bound parameter count before
 * the fragment is concatenated into a query.
 */
export function countSqlPlaceholders(sql: string): number {
  let count = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      i = skipStringLiteral(sql, i);
      continue;
    }
    if (c === '?') count++;
    i++;
  }
  return count;
}

/**
 * Replaces every SQL string literal with a single sentinel `S` character so the
 * structural checks below cannot be confused by `?`/`()`/`,` characters inside
 * literals — and so adjacent commas separated by a literal aren't seen as a
 * "doubled comma" (e.g. `f(a, 'x', b)` -> `f(a, S, b)`).
 */
function stripStringLiterals(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      out += 'S';
      i = skipStringLiteral(sql, i);
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * A SQL fragment paired with its bound parameters. `sql` is concatenated into a
 * larger statement (so it is interpolated, not parameterized) but every `?`
 * inside it is bound from `params` at execution time.
 */
export type WhereFragment = { sql: string; params: unknown[] };

/**
 * Detects `()` that is *not* preceded by a function identifier — i.e. an empty
 * `IN ()` / `VALUES ()` / bare `()`, but not the legitimate niladic call form
 * (`OVER()`, `NOW()`, `random()`, etc.) used by window/aggregate functions.
 *
 * The pattern uses a negative lookbehind to allow `<word>(\s*)`.
 */
const BAD_EMPTY_PARENS = /(?<![A-Za-z0-9_])\(\s*\)/;

function assertNoBadListShape(
  stripped: string,
  sql: string,
  context?: Record<string, unknown>
): void {
  assert.ok(
    !BAD_EMPTY_PARENS.test(stripped),
    'WhereFragment: empty parentheses (likely empty IN () list)',
    { ...context, sql }
  );
  assert.ok(
    !/\?\s*\?/.test(stripped),
    'WhereFragment: adjacent ? placeholders without separator',
    { ...context, sql }
  );
  assert.ok(
    !/,\s*\)/.test(stripped),
    'WhereFragment: trailing comma before closing paren',
    { ...context, sql }
  );
  assert.ok(
    !/\(\s*,/.test(stripped),
    'WhereFragment: leading comma after opening paren',
    { ...context, sql }
  );
  assert.ok(
    !/,\s*,/.test(stripped),
    'WhereFragment: doubled comma in expression list',
    { ...context, sql }
  );
}

function assertNoStatementBoundary(
  stripped: string,
  sql: string,
  context?: Record<string, unknown>
): void {
  assert.ok(
    !stripped.includes(';'),
    'WhereFragment: semicolons forbidden in interpolated fragment',
    { ...context, sql }
  );
  assert.ok(
    !stripped.includes('--'),
    'WhereFragment: line comments forbidden in interpolated fragment',
    { ...context, sql }
  );
  assert.ok(
    !stripped.includes('/*'),
    'WhereFragment: block comments forbidden in interpolated fragment',
    { ...context, sql }
  );
}

function assertBalancedParens(
  stripped: string,
  sql: string,
  context?: Record<string, unknown>
): void {
  let depth = 0;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    assert.ok(
      depth >= 0,
      'WhereFragment: unbalanced parentheses (extra closing paren)',
      { ...context, sql, position: i }
    );
  }
  assert.ok(
    depth === 0,
    'WhereFragment: unbalanced parentheses (unclosed open paren)',
    { ...context, sql, unclosed: depth }
  );
}

/**
 * Validates a SQL fragment built dynamically by query builders.
 *
 * Catches the most common ways to accidentally produce invalid SQL:
 *   - Placeholder count mismatch with `params.length`.
 *   - Empty `()` (most often from an empty `IN ()` list, which Postgres rejects).
 *   - Double placeholders `??` (typically from a `placeholders.join(', ')`
 *     where the separator was forgotten).
 *   - Stray statement terminators or comment markers (`;`, `--`, `/* *​/`)
 *     inside an interpolated fragment.
 *
 * `assertWhereFragment` is intentionally cheap: O(n) over `sql` with no SQL
 * parsing.  It runs on every read so it must stay fast.
 */
export function assertWhereFragment(
  fragment: WhereFragment,
  context?: Record<string, unknown>
): asserts fragment is WhereFragment {
  assert.ok(
    typeof fragment === 'object' && fragment !== null,
    'WhereFragment: not an object',
    { ...context, fragment }
  );
  assert.string(fragment.sql, 'WhereFragment: sql must be string', {
    ...context,
    fragment,
  });
  assert.array(fragment.params, 'WhereFragment: params must be array', {
    ...context,
    fragment,
  });

  const sql = fragment.sql;
  assert.ok(sql.trim().length > 0, 'WhereFragment: sql must not be empty', {
    ...context,
    fragment,
  });

  assert.equals(
    countSqlPlaceholders(sql),
    fragment.params.length,
    'WhereFragment: ? placeholder count does not match params length',
    { ...context, sql, params: fragment.params }
  );

  const stripped = stripStringLiterals(sql);
  assertNoBadListShape(stripped, sql, context);
  assertNoStatementBoundary(stripped, sql, context);
  assertBalancedParens(stripped, sql, context);
}
