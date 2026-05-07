import type { CleanedWhere } from '@better-auth/core/db/adapter';
import { BetterAuthError } from '@better-auth/core/error';

export function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Convert Better Auth's camelCase field names (e.g. `expiresAt`) to the snake_case
 * column names our DDL uses (e.g. `expires_at`). Better Auth's adapter factory passes
 * logical field names; the schema in `libs/lib/src/better-auth-db/impl-postgres.ts`
 * defines columns as snake_case.
 */
export function camelToSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Quote a column identifier, snake-casing the logical field name first. */
export function qCol(name: string): string {
  return qIdent(camelToSnake(name));
}

/** Inverse of {@link camelToSnake}: `expires_at` → `expiresAt`. */
export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
}

/**
 * Remap snake_case column names from a SQL row back to the camelCase field names
 * Better Auth's `transformOutput` expects.
 */
export function rowToCamel<T extends Record<string, unknown> | null | undefined>(
  row: T
): T {
  if (row === null || row === undefined) return row;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    out[snakeToCamel(k)] = (row as Record<string, unknown>)[k];
  }
  return out as T;
}

function isInsensitiveStringMode(w: CleanedWhere): boolean {
  return (
    (w.mode ?? 'sensitive') === 'insensitive' &&
    (typeof w.value === 'string' ||
      (Array.isArray(w.value) &&
        w.value.length > 0 &&
        w.value.every((v) => typeof v === 'string')))
  );
}

function predicateIn(
  w: CleanedWhere,
  col: string,
  params: unknown[],
  insensitive: boolean
): string {
  if (!Array.isArray(w.value)) {
    throw new BetterAuthError(
      `[SqlClient adapter] "in" expects an array for field "${w.field}"`
    );
  }
  if (w.value.length === 0) return '(1=0)';
  if (insensitive) {
    const ph = w.value.map((v) => {
      params.push(v);
      return 'LOWER(?)';
    });
    return `LOWER(${col}::text) IN (${ph.join(', ')})`;
  }
  const ph = w.value.map((v) => {
    params.push(v);
    return '?';
  });
  return `${col} IN (${ph.join(', ')})`;
}

function predicateNotIn(
  w: CleanedWhere,
  col: string,
  params: unknown[],
  insensitive: boolean
): string {
  if (!Array.isArray(w.value)) {
    throw new BetterAuthError(
      `[SqlClient adapter] "not_in" expects an array for field "${w.field}"`
    );
  }
  if (w.value.length === 0) return '(1=1)';
  if (insensitive) {
    const ph = w.value.map((v) => {
      params.push(v);
      return 'LOWER(?)';
    });
    return `LOWER(${col}::text) NOT IN (${ph.join(', ')})`;
  }
  const ph = w.value.map((v) => {
    params.push(v);
    return '?';
  });
  return `${col} NOT IN (${ph.join(', ')})`;
}

type LikeArgs = {
  w: CleanedWhere;
  col: string;
  params: unknown[];
  pattern: (v: string) => string;
  opLabel: string;
  insensitive: boolean;
};

function predicateLike(args: LikeArgs): string {
  const { w, col, params, pattern, opLabel, insensitive } = args;
  const v = w.value;
  if (typeof v !== 'string') {
    throw new BetterAuthError(
      `[SqlClient adapter] "${opLabel}" expects a string for field "${w.field}"`
    );
  }
  params.push(pattern(v));
  return insensitive ? `${col} ILIKE ?` : `${col} LIKE ?`;
}

function predicateCompare(
  w: CleanedWhere,
  col: string,
  params: unknown[],
  sqlOp: string
): string {
  params.push(w.value);
  return `${col} ${sqlOp} ?`;
}

function predicateNe(
  w: CleanedWhere,
  col: string,
  params: unknown[],
  insensitive: boolean
): string {
  if (w.value === null) return `${col} IS NOT NULL`;
  if (insensitive && typeof w.value === 'string') {
    params.push(w.value);
    return `LOWER(${col}::text) <> LOWER(?)`;
  }
  params.push(w.value);
  return `${col} <> ?`;
}

function predicateEq(
  w: CleanedWhere,
  col: string,
  params: unknown[],
  insensitive: boolean
): string {
  if (w.value === null) return `${col} IS NULL`;
  if (insensitive && typeof w.value === 'string') {
    params.push(w.value);
    return `LOWER(${col}::text) = LOWER(?)`;
  }
  params.push(w.value);
  return `${col} = ?`;
}

type PredCtx = {
  w: CleanedWhere;
  col: string;
  params: unknown[];
  insensitive: boolean;
};

function formatPredicate(
  w: CleanedWhere,
  params: unknown[],
  quote: typeof qIdent
): string {
  const col = quote(w.field);
  const op = w.operator ?? 'eq';
  const insensitive = isInsensitiveStringMode(w);
  const ctx: PredCtx = { w, col, params, insensitive };

  const byOp: Record<string, (c: PredCtx) => string> = {
    in: (c) => predicateIn(c.w, c.col, c.params, c.insensitive),
    not_in: (c) => predicateNotIn(c.w, c.col, c.params, c.insensitive),
    contains: (c) =>
      predicateLike({
        w: c.w,
        col: c.col,
        params: c.params,
        pattern: (v) => `%${v}%`,
        opLabel: 'contains',
        insensitive: c.insensitive,
      }),
    starts_with: (c) =>
      predicateLike({
        w: c.w,
        col: c.col,
        params: c.params,
        pattern: (v) => `${v}%`,
        opLabel: 'starts_with',
        insensitive: c.insensitive,
      }),
    ends_with: (c) =>
      predicateLike({
        w: c.w,
        col: c.col,
        params: c.params,
        pattern: (v) => `%${v}`,
        opLabel: 'ends_with',
        insensitive: c.insensitive,
      }),
    lt: (c) => predicateCompare(c.w, c.col, c.params, '<'),
    lte: (c) => predicateCompare(c.w, c.col, c.params, '<='),
    gt: (c) => predicateCompare(c.w, c.col, c.params, '>'),
    gte: (c) => predicateCompare(c.w, c.col, c.params, '>='),
    ne: (c) => predicateNe(c.w, c.col, c.params, c.insensitive),
    eq: (c) => predicateEq(c.w, c.col, c.params, c.insensitive),
  };

  const fallback = byOp['eq'];
  const run = byOp[op] ?? fallback;
  if (run === undefined) {
    return predicateEq(ctx.w, ctx.col, ctx.params, ctx.insensitive);
  }
  return run(ctx);
}

/**
 * Builds a `WHERE` clause that already quotes column identifiers via {@link qCol}
 * (snake-cases logical Better Auth field names so they match our DDL).
 */
export function buildWhere(
  where: CleanedWhere[],
  params: unknown[]
): string {
  const parts: string[] = [];
  for (let i = 0; i < where.length; i++) {
    const w = where[i]!;
    if (i > 0) parts.push(w.connector === 'OR' ? ' OR ' : ' AND ');
    parts.push(formatPredicate(w, params, qCol));
  }
  return parts.join('');
}
