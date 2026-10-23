import type { LocalClock } from './local-clock';

const MINUTE_MS = 60_000;

/** The person's clock: a fixed offset and the name they gave it. */
export type PersonZone = Pick<LocalClock, 'offsetMinutes' | 'zoneLabel'>;

export function utcIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** `2026-09-29T18:33:05-07:00`: the same instant on the person's clock. */
export function localIso(ms: number, zone: PersonZone): string {
  const shifted = new Date(ms + zone.offsetMinutes * MINUTE_MS).toISOString();
  return `${shifted.slice(0, 19)}${offsetText(zone.offsetMinutes)}`;
}

function offsetText(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  return `${sign}${hours}:${String(absolute % 60).padStart(2, '0')}`;
}

/** `18:33:05 MST  01:33:05Z`, with the day when the window crosses midnight. */
export function stamp(ms: number, zone: PersonZone, withDate: boolean): string {
  const local = localIso(ms, zone);
  const utc = utcIso(ms);
  const localText = withDate
    ? `${local.slice(5, 10)} ${local.slice(11, 19)}`
    : local.slice(11, 19);
  const utcText = withDate
    ? `${utc.slice(5, 10)} ${utc.slice(11, 19)}`
    : utc.slice(11, 19);
  return `${localText} ${zone.zoneLabel}  ${utcText}Z`;
}

/** True when two instants fall on different days on either clock. */
export function crossesMidnight(
  startMs: number,
  endMs: number,
  zone: PersonZone
): boolean {
  return (
    localIso(startMs, zone).slice(0, 10) !==
      localIso(endMs, zone).slice(0, 10) ||
    utcIso(startMs).slice(0, 10) !== utcIso(endMs).slice(0, 10)
  );
}

/** `2d 3h`, `3h`, `1m 30s`, `45s`, `250ms`: the two largest units, zeros dropped. */
export function humanSpan(ms: number): string {
  const total = Math.abs(ms);
  if (total < 1_000) return `${Math.round(total)}ms`;
  const seconds = Math.floor(total / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return pair(minutes, 'm', seconds % 60, 's');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return pair(hours, 'h', minutes % 60, 'm');
  return pair(Math.floor(hours / 24), 'd', hours % 24, 'h');
}

function pair(
  major: number,
  majorUnit: string,
  minor: number,
  minorUnit: string
): string {
  return minor === 0
    ? `${major}${majorUnit}`
    : `${major}${majorUnit} ${minor}${minorUnit}`;
}

/** An `--at` value that names the day, so a re-run lands on the same instant. */
export function atText(ms: number, zone: PersonZone): string {
  const local = localIso(ms, zone);
  return `${local.slice(0, 10)} ${local.slice(11, 16)} ${zone.zoneLabel}`;
}
