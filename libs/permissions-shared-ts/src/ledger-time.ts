/**
 * Epoch ms of a synced `timestamp` value. Rows arrive as ISO strings
 * (`2026-09-19T10:00:00.000Z`), Postgres text (`2026-09-19 10:00:00.2+00`)
 * or `Date`s depending on the engine; all mean the same instant. Unparsable
 * values are `NaN` (never counted in a window).
 */
export function ledgerTimeMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const iso = value
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  return Date.parse(iso);
}

/** Units in `rows` consumed at or after `startMs`. */
export function unitsSince(
  rows: readonly { readonly amount: unknown; readonly consumed_at: unknown }[],
  startMs: number
): number {
  let used = 0;
  for (const row of rows) {
    if (ledgerTimeMs(row.consumed_at) >= startMs) used += Number(row.amount);
  }
  return used;
}
