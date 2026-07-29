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

/**
 * @deprecated Prefer {@link spaceUserEntityId} from `@libs/db/shared/space-tables`.
 * Legacy membership id was `${memberId}:${spaceId}` — do not use for space_users.
 */
export function spaceMembershipEntityId(
  memberId: string,
  spaceId: string
): string {
  return `${memberId}:${spaceId}`;
}
