function buildSqliteJsonPath(key: string): string {
  const needsQuote = /[./[\]]/.test(key);
  const literal = needsQuote ? `$."${key.replace(/"/g, '""')}"` : `$.${key}`;
  return literal.replace(/'/g, "''");
}

function toSqliteJsonSetValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value;
}

/** Builds a `json_set(attributes, …)` expression + bind params for one patch update. */
export function buildSqliteUpdateJsonSet(attributes: Record<string, unknown>): {
  expr: string;
  params: unknown[];
} {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    parts.push(`'${buildSqliteJsonPath(key)}', ?`);
    params.push(toSqliteJsonSetValue(value));
  }
  return { expr: `json_set(attributes, ${parts.join(', ')})`, params };
}
