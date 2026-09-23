/** Accounting window of a consumable quota. */
export type QuotaWindow = 'day' | 'week' | 'month' | 'rolling24h' | 'lifetime';

/** Where calendar windows start: UTC midnight or the user's local midnight. */
export type ResetBoundary = 'utcMidnight' | 'userLocalMidnight';

/** A consumable allowance. `limit: null` = unlimited. */
export type QuotaGrant = {
  readonly limit: number | null;
  readonly window: QuotaWindow;
  readonly resetBoundary?: ResetBoundary;
};

/** `[startMs, resetsAtMs)`; lifetime windows never reset (`resetsAtMs: null`). */
export type WindowBounds = {
  readonly startMs: number;
  readonly resetsAtMs: number | null;
};

const DAY_MS = 86_400_000;

type LocalParts = {
  readonly y: number;
  readonly m: number;
  readonly d: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(timeZone, created);
  return created;
}

function zonedFields(ms: number, timeZone: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(ms)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return out;
}

/** Offset (local − UTC, ms) of `timeZone` at instant `ms`. */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const f = zonedFields(ms, timeZone);
  const asUtc = Date.UTC(
    f['year'] ?? 1970,
    (f['month'] ?? 1) - 1,
    f['day'] ?? 1,
    f['hour'] ?? 0,
    f['minute'] ?? 0,
    f['second'] ?? 0
  );
  return asUtc - (ms - (((ms % 1000) + 1000) % 1000));
}

function localParts(ms: number, timeZone: string | null): LocalParts {
  if (timeZone === null) {
    const date = new Date(ms);
    return {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth(),
      d: date.getUTCDate(),
    };
  }
  const f = zonedFields(ms, timeZone);
  return { y: f['year'] ?? 1970, m: (f['month'] ?? 1) - 1, d: f['day'] ?? 1 };
}

/** The instant of local midnight on the given calendar date. */
function midnightMs(parts: LocalParts, timeZone: string | null): number {
  const naive = Date.UTC(parts.y, parts.m, parts.d);
  if (timeZone === null) return naive;
  // Two passes converge across a DST transition (offset differs at the guess).
  const first = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(first, timeZone);
}

function addDays(parts: LocalParts, days: number): LocalParts {
  const date = new Date(Date.UTC(parts.y, parts.m, parts.d + days));
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth(),
    d: date.getUTCDate(),
  };
}

function weekday(parts: LocalParts): number {
  // 0 = Monday … 6 = Sunday (ISO weeks).
  return (new Date(Date.UTC(parts.y, parts.m, parts.d)).getUTCDay() + 6) % 7;
}

function calendarBounds(
  window: 'day' | 'week' | 'month',
  today: LocalParts
): { readonly start: LocalParts; readonly next: LocalParts } {
  if (window === 'day') return { start: today, next: addDays(today, 1) };
  if (window === 'week') {
    const start = addDays(today, -weekday(today));
    return { start, next: addDays(start, 7) };
  }
  const start = { y: today.y, m: today.m, d: 1 };
  const nextMonth = new Date(Date.UTC(today.y, today.m + 1, 1));
  return {
    start,
    next: {
      y: nextMonth.getUTCFullYear(),
      m: nextMonth.getUTCMonth(),
      d: 1,
    },
  };
}

/**
 * Window containing `nowMs`. Calendar windows start at UTC midnight, or at
 * local midnight in `timeZone` for `userLocalMidnight` (falls back to UTC when
 * no zone is known). DST days are 23 h / 25 h long, never shifted.
 */
export function quotaWindowBounds(args: {
  readonly grant: QuotaGrant;
  readonly nowMs: number;
  readonly timeZone?: string | null;
}): WindowBounds {
  const { grant, nowMs } = args;
  if (grant.window === 'lifetime') return { startMs: 0, resetsAtMs: null };
  if (grant.window === 'rolling24h') {
    return { startMs: nowMs - DAY_MS, resetsAtMs: nowMs + DAY_MS };
  }
  const zone =
    grant.resetBoundary === 'userLocalMidnight'
      ? (args.timeZone ?? null)
      : null;
  const { start, next } = calendarBounds(grant.window, localParts(nowMs, zone));
  return {
    startMs: midnightMs(start, zone),
    resetsAtMs: midnightMs(next, zone),
  };
}
