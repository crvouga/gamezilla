/** When a Synthetic User tends to be online, in its home region's local time. */
export type DailySchedule = {
  readonly timeZone: string;
  readonly startHour: number;
  readonly endHour: number;
};

const HOUR_MS = 60 * 60_000;
const formats = new Map<string, Intl.DateTimeFormat>();

function hourFormat(timeZone: string): Intl.DateTimeFormat {
  const known = formats.get(timeZone);
  if (known !== undefined) return known;
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  formats.set(timeZone, format);
  return format;
}

/** The local time of day at `nowMs` in `timeZone`, in fractional hours [0, 24). */
export function localHourAt(timeZone: string, nowMs: number): number {
  let hour = 0;
  let minute = 0;
  for (const part of hourFormat(timeZone).formatToParts(new Date(nowMs))) {
    if (part.type === 'hour') hour = Number(part.value) % 24;
    if (part.type === 'minute') minute = Number(part.value);
  }
  return hour + minute / 60;
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
