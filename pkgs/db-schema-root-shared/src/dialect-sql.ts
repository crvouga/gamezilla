import { assertAgnosticSql } from '@pkgs/sql-client-root-shared/agnostic-sql';

/**
 * Expression used in checks, generated columns, backfills, and views.
 * A bare string must be dialect-agnostic. Object form allows dialect overrides.
 */
export type DialectSql =
  | string
  | {
      readonly sql: string;
      readonly postgres?: string;
      readonly sqlite?: string;
    };

export type DialectName = 'postgres' | 'sqlite';

export function resolveDialectSql(
  expr: DialectSql,
  dialect: DialectName
): string {
  if (typeof expr === 'string') {
    assertAgnosticSql(expr);
    return expr;
  }
  const override = dialect === 'postgres' ? expr.postgres : expr.sqlite;
  if (override !== undefined) {
    return override;
  }
  assertAgnosticSql(expr.sql);
  return expr.sql;
}

export function assertDialectSqlShape(expr: unknown, path: string): DialectSql {
  if (typeof expr === 'string') {
    if (expr.length === 0) {
      throw new Error(`${path}: SQL expression must be non-empty`);
    }
    assertAgnosticSql(expr);
    return expr;
  }
  if (typeof expr !== 'object' || expr === null || Array.isArray(expr)) {
    throw new Error(
      `${path}: DialectSql must be a string or { sql, postgres?, sqlite? }`
    );
  }
  const obj = expr as Record<string, unknown>;
  if (typeof obj['sql'] !== 'string' || obj['sql'].length === 0) {
    throw new Error(`${path}: DialectSql.sql is required`);
  }
  for (const key of Object.keys(obj)) {
    if (key !== 'sql' && key !== 'postgres' && key !== 'sqlite') {
      throw new Error(`${path}: unknown DialectSql key '${key}'`);
    }
  }
  if (obj['postgres'] !== undefined && typeof obj['postgres'] !== 'string') {
    throw new Error(`${path}: DialectSql.postgres must be a string`);
  }
  if (obj['sqlite'] !== undefined && typeof obj['sqlite'] !== 'string') {
    throw new Error(`${path}: DialectSql.sqlite must be a string`);
  }
  if (obj['postgres'] === undefined && obj['sqlite'] === undefined) {
    assertAgnosticSql(obj['sql']);
  }
  return {
    sql: obj['sql'],
    ...(typeof obj['postgres'] === 'string'
      ? { postgres: obj['postgres'] }
      : {}),
    ...(typeof obj['sqlite'] === 'string' ? { sqlite: obj['sqlite'] } : {}),
  };
}
