import type { PersonZone } from './person-time';
import { localIso, utcIso } from './person-time';
import type { SeenAt } from './person-types';
import type { TimeRange, TraceRef, TraceStore } from './types';

/** How far either side of the window a quiet account is looked for. */
export const OUTWARD_MS = 7 * 24 * 60 * 60 * 1000;

export type Seen = { readonly last?: SeenAt; readonly next?: SeenAt };

type Outward = {
  /** Words that rebuild the question at another time. */
  readonly rerun: (atMs: number) => string;
  readonly instantMs: number;
  readonly nowMs: number;
  readonly range: TimeRange;
  readonly zone: PersonZone;
};

/**
 * Where else the accounts were seen, for a window with nothing in it: the
 * last trace before it and the first after it, a week out, never past now.
 */
export async function lookOutward(
  store: TraceStore,
  userIds: readonly string[],
  scope: Outward
): Promise<Seen> {
  const before = {
    startMs: scope.range.startMs - OUTWARD_MS,
    endMs: scope.range.startMs - 1,
  };
  const after = {
    startMs: scope.range.endMs + 1,
    endMs: Math.min(scope.range.endMs + OUTWARD_MS, scope.nowMs),
  };
  let last: Found | undefined;
  let next: Found | undefined;
  for (const userId of userIds) {
    const earlier = (
      await store.findByUser(userId, before, { limit: 1, order: 'newest' })
    )[0];
    if (
      earlier !== undefined &&
      (last === undefined || earlier.startedAtMs > last.ref.startedAtMs)
    )
      last = { ref: earlier, userId };
    if (after.endMs <= after.startMs) continue;
    const later = (
      await store.findByUser(userId, after, { limit: 1, order: 'oldest' })
    )[0];
    if (
      later !== undefined &&
      (next === undefined || later.startedAtMs < next.ref.startedAtMs)
    )
      next = { ref: later, userId };
  }
  return {
    ...(last === undefined ? {} : { last: seenAt(last, scope) }),
    ...(next === undefined ? {} : { next: seenAt(next, scope) }),
  };
}

type Found = { readonly ref: TraceRef; readonly userId: string };

function seenAt(found: Found, scope: Outward): SeenAt {
  const atMs = found.ref.startedAtMs;
  return {
    userId: found.userId,
    traceId: found.ref.traceId,
    atUtc: utcIso(atMs),
    atLocal: localIso(atMs, scope.zone),
    offsetMs: atMs - scope.instantMs,
    rerun: scope.rerun(atMs),
  };
}
