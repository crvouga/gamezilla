/**
 * Time windows: a duration (`28d`) in milliseconds, a calendar start time in
 * epoch milliseconds, and the bounds an SLO is evaluated over at a given
 * moment. Both bounds are inclusive.
 *
 * - Rolling: `[now - duration, now]`.
 * - Calendar: periods of `duration` tile the timeline from `startTime`; the
 *   window is `[start of the period holding now, now]`. Only UTC is
 *   supported (`parse` reports any other time zone).
 */

import type { Slo, TimeWindow } from './model';

const UNIT_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const;

const DURATION = /^(\d+)([smhdw])$/;
const START_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/;

export const UTC_ZONES: readonly string[] = ['UTC', 'Etc/UTC', 'GMT'];

/** `28d` → milliseconds; `null` for anything else (and for `0d`). */
export function parseDuration(text: string): number | null {
  const match = DURATION.exec(text);
  if (match === null) return null;
  const count = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_MS;
  const ms = count * UNIT_MS[unit];
  return count > 0 && Number.isSafeInteger(ms) ? ms : null;
}

/** `2026-01-01 00:00:00` (UTC) → epoch ms; `null` when malformed. */
export function parseStartTime(text: string): number | null {
  const match = START_TIME.exec(text);
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number) as [number, number, number, number, number, number];
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const back = new Date(ms);
  const exact =
    back.getUTCFullYear() === year &&
    back.getUTCMonth() === month - 1 &&
    back.getUTCDate() === day &&
    back.getUTCHours() === hour &&
    back.getUTCMinutes() === minute &&
    back.getUTCSeconds() === second;
  return exact ? ms : null;
}

export type WindowBounds = { readonly startMs: number; readonly endMs: number };

/** The inclusive bounds `slo` is evaluated over at `nowMs`. */
export function windowBounds(
  slo: Pick<Slo, 'timeWindow'>,
  nowMs: number
): WindowBounds {
  return timeWindowBounds(slo.timeWindow, nowMs);
}

export function timeWindowBounds(
  window: TimeWindow,
  nowMs: number
): WindowBounds {
  const durationMs = parseDuration(window.duration);
  if (durationMs === null) {
    throw new Error(`openslo: bad window duration "${window.duration}"`);
  }
  if (window.isRolling || window.calendar === null) {
    return { startMs: nowMs - durationMs, endMs: nowMs };
  }
  const { startTime, timeZone } = window.calendar;
  if (!UTC_ZONES.includes(timeZone)) {
    throw new Error(`openslo: time zone ${timeZone} is not supported (UTC)`);
  }
  const originMs = parseStartTime(startTime);
  if (originMs === null) {
    throw new Error(`openslo: bad calendar startTime "${startTime}"`);
  }
  const period = Math.floor((nowMs - originMs) / durationMs);
  return { startMs: originMs + period * durationMs, endMs: nowMs };
}

export function withinBounds(atMs: number, bounds: WindowBounds): boolean {
  return atMs >= bounds.startMs && atMs <= bounds.endMs;
}
