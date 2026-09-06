/**
 * Framework-free relative-time bucketing for {@link RelativeTime}.
 *
 * Returns structured parts so the component can localise them with Lingui
 * (`just now`, `{n}m ago`, `{n}h ago`, `{n}d ago`).
 */

export type RelativeTimeParts =
  | { readonly kind: 'justNow' }
  | { readonly kind: 'minutes'; readonly value: number }
  | { readonly kind: 'hours'; readonly value: number }
  | { readonly kind: 'days'; readonly value: number }
  /** `at` was not parseable; render the trimmed source string verbatim. */
  | { readonly kind: 'raw'; readonly value: string };

/** How often a live label re-evaluates. */
export const RELATIVE_TIME_TICK_MS = 30_000;

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * Bucket `at` (ISO or any `Date.parse`-able string) relative to `nowMs`.
 * Future or sub-minute differences resolve to `justNow`.
 */
export function relativeTimeParts(
  at: string,
  nowMs: number
): RelativeTimeParts {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) {
    const trimmed = at.trim();
    return trimmed.length > 0
      ? { kind: 'raw', value: trimmed }
      : { kind: 'justNow' };
  }
  const mins = Math.floor((nowMs - then) / MINUTE_MS);
  if (mins < 1) return { kind: 'justNow' };
  if (mins < MINUTES_PER_HOUR) return { kind: 'minutes', value: mins };
  const hours = Math.floor(mins / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return { kind: 'hours', value: hours };
  return { kind: 'days', value: Math.floor(hours / HOURS_PER_DAY) };
}
