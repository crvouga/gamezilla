/**
 * Profile id for space title / host display. Prefer `host_member_id`; fall back
 * to `host_account_id` when member id is missing (legacy rows / partial sync).
 */
export function resolveSpaceHostProfileId(
  hostMemberId: string | null | undefined,
  hostAccountId: string | null | undefined
): string | null {
  if (
    hostMemberId !== null &&
    hostMemberId !== undefined &&
    hostMemberId.length > 0
  ) {
    return hostMemberId;
  }
  if (
    hostAccountId !== null &&
    hostAccountId !== undefined &&
    hostAccountId.length > 0
  ) {
    return hostAccountId;
  }
  return null;
}
