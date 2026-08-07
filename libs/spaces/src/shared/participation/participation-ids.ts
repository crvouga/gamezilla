/**
 * Account-scoped space identity helpers.
 *
 * - Member = signed-in account only.
 * - Space user = one ACL row per account × space (`${spaceId}:${userId}`).
 */

/** Canonical member id for writes / room / presence — account required. */
export function resolveSpaceMemberId(accountId: string): string {
  return accountId;
}

/** Canonical space_users row id: `${spaceId}:${userId}`. */
export function spaceUserEntityId(spaceId: string, userId: string): string {
  return `${spaceId}:${userId}`;
}

/** Canonical space_open_sessions row id: `${deviceId}:${spaceId}`. */
export function spaceOpenSessionEntityId(
  deviceId: string,
  spaceId: string
): string {
  return `${deviceId}:${spaceId}`;
}
