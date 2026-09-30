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
  /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|in the morning|in the afternoon|in the evening)?(?:\s+(.+))?$/i;

export type LocalClock = {
  readonly instantMs: number;
  readonly label: string;
  readonly offsetMinutes: number;
  /** IANA zone of the person's own clock. */
  readonly timeZone: string;
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
  const zone = (match[4] ?? '').trim().toLowerCase();
  const offset = OFFSETS[zone];
  const timeZone = ZONES[zone];
  const hour = clockHour(Number(match[1]), (match[3] ?? '').toLowerCase());
  const minute = Number(match[2] ?? '0');
  if (
    offset === undefined ||
    timeZone === undefined ||
    hour === undefined ||
    minute > 59
  ) {
    return undefined;
  }
  const today = localDate(nowMs, offset);
  let instantMs = instantAt(today, hour, minute, offset);
  if (instantMs > nowMs + FUTURE_SLACK_MS) {
    instantMs = instantAt(previousDay(today), hour, minute, offset);
  }
  return {
    instantMs,
    offsetMinutes: offset,
    timeZone,
    label: `${pad(hour)}:${pad(minute)} ${zoneLabel(zone)} (UTC${formatOffset(offset)})`,
  };
}

export function clockWindow(clock: LocalClock, windowMs: number): TimeRange {
  const half = Math.floor(windowMs / 2);
  return { startMs: clock.instantMs - half, endMs: clock.instantMs + half };
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
