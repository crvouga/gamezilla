import type { QueryRow } from './v2';

/** Clip snapshot tables to the query hard row budget (server + local hash). */
export function applyHardLimit(
  tables: Readonly<Record<string, readonly QueryRow[]>>,
  limit: number
): Record<string, QueryRow[]> {
  const out: Record<string, QueryRow[]> = {};
  let remaining = limit;
  for (const [name, rows] of Object.entries(tables)) {
    if (remaining <= 0) {
      out[name] = [];
      continue;
    }
    out[name] = rows.slice(0, remaining).map((r) => ({ ...r }));
    remaining -= out[name].length;
  }
  return out;
}
