/**
 * Converts SQL with `?` positional placeholders to `$1`, `$2`, ... format.
 * Used by Postgres implementations; SQLite uses `?` natively.
 */
export function questionMarkParamsToDollarParams(
  sql: string,
  params?: readonly unknown[]
): [string, unknown[]] {
  if (!params?.length) return [sql, []];
  let i = 0;
  const converted = sql.replace(/\?/g, () => `$${++i}`);
  return [converted, [...params]];
}
