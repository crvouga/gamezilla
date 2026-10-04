import type { LogEntry, RoomEvent } from '@pkgs/room-root-shared/types';

import type { LogLine, LogLineContext } from './log-line';
import type { EventLogRouter } from './log-router';

/**
 * Pure projection: map a committed event log into displayable lines.
 * Unknown / undescribed events are silently dropped (draft === null).
 * Entries without `ts` use `0`; entries without `actor` keep `actor: null`.
 */
export function projectEventLog(
  entries: readonly LogEntry<RoomEvent>[],
  router: EventLogRouter,
  ctx: LogLineContext = {}
): readonly LogLine[] {
  const lines: LogLine[] = [];
  for (const entry of entries) {
    const draft = router.dispatch(undefined, ctx, entry.event, () => null);
    if (draft === null) continue;
    lines.push({
      seq: entry.seq,
      ts: entry.ts ?? 0,
      actor: entry.actor ?? null,
      text: draft.text,
      ...(draft.icon !== undefined ? { icon: draft.icon } : {}),
      ...(draft.targetKeys !== undefined
        ? { targetKeys: draft.targetKeys }
        : {}),
    });
  }
  return lines;
}
