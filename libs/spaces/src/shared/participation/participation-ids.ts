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
