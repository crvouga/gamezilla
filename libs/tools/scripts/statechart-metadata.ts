import type { StateMeta } from '@crvouga/atlas';

/** Object order is irrelevant; prose, tables, list order and document text are exact. */
export function canonicalChartData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalChartData);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalChartData(entry)])
  );
}

export function sameChartData(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(canonicalChartData(left)) ===
    JSON.stringify(canonicalChartData(right))
  );
}

/** SCXML omits empty standard list elements; they carry no information. */
export function normalizedMetadata(meta: StateMeta | undefined): unknown {
  const normalized = { ...meta };
  for (const key of ['events', 'source', 'checks', 'hints']) {
    const list = normalized[key];
    if (Array.isArray(list) && list.length === 0) delete normalized[key];
  }
  return canonicalChartData(normalized);
}
