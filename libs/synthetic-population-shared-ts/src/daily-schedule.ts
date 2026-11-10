import { HOME_REGIONS } from './persona-regions';

/** When a Synthetic User tends to be online, in its home region's local time. */
export type DailySchedule = {
  readonly timeZone: string;
  readonly startHour: number;
  readonly endHour: number;
};

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** The local time of day at `nowMs` in `timeZone`, in fractional hours [0, 24). */
export function localHourAt(timeZone: string, nowMs: number): number {
  const offset =
    HOME_REGIONS.find((home) => home.timeZone === timeZone)?.utcOffsetMinutes ??
    0;
  const local = (((nowMs + offset * 60_000) % DAY_MS) + DAY_MS) % DAY_MS;
  return local / HOUR_MS;
}

/**
 * Whether the daily schedule says its Synthetic User tends to be online at
 * `nowMs`: from its start hour up to (not including) its end hour, local
 * time, wrapping past midnight when the end comes before the start.
 */
export function onSchedule(schedule: DailySchedule, nowMs: number): boolean {
  const hour = localHourAt(schedule.timeZone, nowMs);
  const { startHour, endHour } = schedule;
  if (startHour === endHour) return true;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** The first moment after `nowMs`, to the minute, at which `onSchedule` changes. */
export function nextScheduleChange(
  schedule: DailySchedule,
  nowMs: number
): number {
  const now = onSchedule(schedule, nowMs);
  const start = Math.floor(nowMs / 60_000) * 60_000;
  for (let at = start + 60_000; at <= nowMs + 25 * HOUR_MS; at += 60_000)
    if (onSchedule(schedule, at) !== now) return at;
  return nowMs + 25 * HOUR_MS;
}
