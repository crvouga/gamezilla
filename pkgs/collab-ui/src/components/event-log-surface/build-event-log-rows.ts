import type { LogLine } from '@pkgs/collab';
import { asLocalized, type LocalizedString } from '@pkgs/i18n';

export type EventLogRow = {
  readonly kind: 'day' | 'line';
  readonly key: string;
  readonly label?: LocalizedString;
  readonly line?: LogLine;
};

function dayKey(ts: number): string {
  if (ts <= 0) return 'unknown';
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function buildEventLogRows(
  lines: readonly LogLine[]
): readonly EventLogRow[] {
  const newestFirst = [...lines].reverse();
  const rows: EventLogRow[] = [];
  let lastDay: string | null = null;
  for (const line of newestFirst) {
    const day = dayKey(line.ts);
    if (day !== lastDay) {
      rows.push({
        kind: 'day',
        key: `day-${day}`,
        label: asLocalized(day),
      });
      lastDay = day;
    }
    rows.push({ kind: 'line', key: `seq-${String(line.seq)}`, line });
  }
  return rows;
}
