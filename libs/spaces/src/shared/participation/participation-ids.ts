/**
 * Account-scoped space identity helpers.
 *
 * - Member = signed-in account only.
 * - Membership = one durable row per account × space (`${accountId}:${spaceId}`).
 */

/** Canonical member id for writes / room / presence — account required. */
export function resolveSpaceMemberId(accountId: string): string {
  return accountId;
}

/** User-scoped membership row id: `${memberId}:${spaceId}`. */
export function spaceMembershipEntityId(
  memberId: string,
  spaceId: string
): string {
  return `${memberId}:${spaceId}`;
}
