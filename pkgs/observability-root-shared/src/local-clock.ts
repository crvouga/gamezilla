import type { TimeRange } from './types';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** A clock a few minutes ahead of now is still "today", not yesterday. */
const FUTURE_SLACK_MS = 15 * MINUTE_MS;

/**
 * Fixed offsets a person actually says. Mountain time is UTC−7 all year
 * (Arizona, and the word MST). Named zones that move with daylight saving
 * are not guessed.
 */
const OFFSETS: Readonly<Record<string, number>> = {
  mst: -7 * 60,
  'mountain time': -7 * 60,
  'america/phoenix': -7 * 60,
  mdt: -6 * 60,
  pst: -8 * 60,
  'pacific time': -8 * 60,
  pdt: -7 * 60,
  'america/los_angeles': -8 * 60,
  cst: -6 * 60,
  'central time': -6 * 60,
  cdt: -5 * 60,
  est: -5 * 60,
  'eastern time': -5 * 60,
  edt: -4 * 60,
  utc: 0,
  gmt: 0,
};

const ZONES: Readonly<Record<string, string>> = {
  mst: 'America/Phoenix',
  'mountain time': 'America/Phoenix',
  'america/phoenix': 'America/Phoenix',
  mdt: 'America/Denver',
  pst: 'America/Los_Angeles',
  'pacific time': 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  'america/los_angeles': 'America/Los_Angeles',
  cst: 'America/Chicago',
  'central time': 'America/Chicago',
  cdt: 'America/Chicago',
  est: 'America/New_York',
  'eastern time': 'America/New_York',
  edt: 'America/New_York',
  utc: 'UTC',
  gmt: 'UTC',
};

const CLOCK =
  /^(?:(\d{4})-(\d{2})-(\d{2})\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|in the morning|in the afternoon|in the evening)?(?:\s+(.+))?$/i;

export type LocalClock = {
  readonly instantMs: number;
  readonly label: string;
  readonly offsetMinutes: number;
  /** IANA zone of the person's own clock. */
  readonly timeZone: string;
  /** How the person named the zone, for example `MST`. */
  readonly zoneLabel: string;
};

type LocalDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

/** The instant a person means by a clock time such as "6:33pm MST". */
export function parseLocalClock(
  text: string,
  nowMs: number
): LocalClock | undefined {
  const match = CLOCK.exec(text.trim());
  if (match === null) return undefined;
  const zone = (match[7] ?? '').trim().toLowerCase();
  const offset = OFFSETS[zone];
  const timeZone = ZONES[zone];
  const hour = clockHour(Number(match[4]), (match[6] ?? '').toLowerCase());
  const minute = Number(match[5] ?? '0');
  if (
    offset === undefined ||
    timeZone === undefined ||
    hour === undefined ||
    minute > 59 ||
    (match[1] !== undefined && namedDate(match) === undefined)
  ) {
    return undefined;
  }
  const named = namedDate(match);
  const today = named ?? localDate(nowMs, offset);
  let instantMs = instantAt(today, hour, minute, offset);
  if (named === undefined && instantMs > nowMs + FUTURE_SLACK_MS) {
    instantMs = instantAt(previousDay(today), hour, minute, offset);
  }
  return {
    instantMs,
    offsetMinutes: offset,
    timeZone,
    zoneLabel: zoneLabel(zone),
    label: `${pad(hour)}:${pad(minute)} ${zoneLabel(zone)} (UTC${formatOffset(offset)})`,
  };
}

/** A clock that reads UTC, for callers that have an instant and no person. */
export function utcClock(instantMs: number): LocalClock {
  const at = new Date(instantMs);
  return {
    instantMs,
    offsetMinutes: 0,
    timeZone: 'UTC',
    zoneLabel: 'UTC',
    label: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC (UTC+00:00)`,
  };
}

export function clockWindow(clock: LocalClock, windowMs: number): TimeRange {
  const half = Math.floor(windowMs / 2);
  return { startMs: clock.instantMs - half, endMs: clock.instantMs + half };
}

/** `2026-09-26 18:33 MST` names its day; a bare clock means today. */
function namedDate(match: RegExpExecArray): LocalDate | undefined {
  if (match[1] === undefined) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const real = new Date(Date.UTC(year, month, day));
  return real.getUTCMonth() === month && real.getUTCDate() === day
    ? { year, month, day }
    : undefined;
}

function clockHour(hour: number, meridiem: string): number | undefined {
  const afternoon =
    meridiem === 'pm' ||
    meridiem === 'in the evening' ||
    meridiem === 'in the afternoon';
  const morning = meridiem === 'am' || meridiem === 'in the morning';
  if (!afternoon && !morning) return hour <= 23 ? hour : undefined;
  if (hour < 1 || hour > 12) return undefined;
  if (morning) return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function localDate(nowMs: number, offsetMinutes: number): LocalDate {
  const shifted = new Date(nowMs + offsetMinutes * MINUTE_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function previousDay(date: LocalDate): LocalDate {
  const prior = new Date(Date.UTC(date.year, date.month, date.day) - DAY_MS);
  return {
    year: prior.getUTCFullYear(),
    month: prior.getUTCMonth(),
    day: prior.getUTCDate(),
  };
}

function instantAt(
  date: LocalDate,
  hour: number,
  minute: number,
  offsetMinutes: number
): number {
  return (
    Date.UTC(date.year, date.month, date.day, hour, minute) -
    offsetMinutes * MINUTE_MS
  );
}

function zoneLabel(zone: string): string {
  if (!zone.includes(' ')) return zone.toUpperCase();
  return zone.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
