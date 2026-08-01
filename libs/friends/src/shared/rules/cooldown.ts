/** Bug-for-bug: 24h resend cooldown after a declined request. */
export const FRIEND_REQUEST_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function isResendCooldownActive(respondedAt: string | null): boolean {
  if (respondedAt === null || respondedAt.length === 0) return false;
  const respondedMs = Date.parse(respondedAt);
  if (!Number.isFinite(respondedMs)) return false;
  return Date.now() - respondedMs < FRIEND_REQUEST_RESEND_COOLDOWN_MS;
}
