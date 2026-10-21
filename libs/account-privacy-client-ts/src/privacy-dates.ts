/** An export is promised within 24 hours of asking. */
export const EXPORT_READY_WITHIN_MS = 24 * 3_600_000;
/** A ready export can be downloaded for 7 days. */
export const EXPORT_DOWNLOADABLE_MS = 7 * 86_400_000;

/** Epoch ms of a synced timestamp, or `null` when absent or unreadable. */
export function timestampMs(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** When an export asked for at `requestedAt` is promised to be ready. */
export function exportReadyByMs(
  requestedAt: string | null | undefined
): number | null {
  const ms = timestampMs(requestedAt);
  return ms === null ? null : ms + EXPORT_READY_WITHIN_MS;
}

/** True while a ready export can still be downloaded at `nowMs`. */
export function exportDownloadable(
  readyAt: string | null | undefined,
  nowMs: number
): boolean {
  const ms = timestampMs(readyAt);
  return ms !== null && nowMs - ms < EXPORT_DOWNLOADABLE_MS;
}

/** A day as the person reads it ("Nov 19, 2026"). */
export function formatPrivacyDay(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}

/** A day and time as the person reads it ("Nov 19, 2026, 6:30 PM"). */
export function formatPrivacyMoment(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}
