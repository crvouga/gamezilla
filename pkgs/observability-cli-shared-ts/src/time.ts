import type { TimeRange } from '@pkgs/observability-root-shared-ts/types';

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function parseDuration(value: string): number | undefined {
  const match = /^(\d+)(m|h|d)$/.exec(value);
  if (match === null) return undefined;
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_MS;
  return amount * UNIT_MS[unit];
}

export function resolveRange(
  nowMs: number,
  windowText = '10m',
  atText?: string
): TimeRange | undefined {
  const durationMs = parseDuration(windowText);
  if (durationMs === undefined) return undefined;
  const atMs = atText === undefined ? nowMs : resolveInstant(atText, nowMs);
  if (atMs === undefined) return undefined;
  return { startMs: atMs - durationMs, endMs: atMs };
}

function resolveInstant(value: string, nowMs: number): number | undefined {
  if (/^\d+$/.test(value)) {
    const raw = Number(value);
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const ago = /^(\d+)(m|h|d) ago$/.exec(value);
  if (ago !== null) {
    const duration = parseDuration(`${ago[1] ?? ''}${ago[2] ?? ''}`);
    return duration === undefined ? undefined : nowMs - duration;
  }
  const relativeDay = /^(today|yesterday)(?:\s+(\d{1,2}):(\d{2}))?$/i.exec(
    value.trim()
  );
  if (relativeDay !== null) {
    const hour = Number(relativeDay[2] ?? '0');
    const minute = Number(relativeDay[3] ?? '0');
    if (hour > 23 || minute > 59) return undefined;
    const now = new Date(nowMs);
    const dayOffset = relativeDay[1]?.toLowerCase() === 'yesterday' ? -1 : 0;
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset,
      hour,
      minute
    );
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatRange(range: TimeRange): string {
  return `${new Date(range.startMs).toISOString()} .. ${new Date(range.endMs).toISOString()} (UTC)`;
}
