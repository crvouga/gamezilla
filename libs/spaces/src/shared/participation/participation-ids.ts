/**
 * Meet-style space identity helpers.
 *
 * - Member = signed-in account, else install device (anon device *is* the user).
 * - Membership = one durable row per member × space.
 * - Participation = one durable seat per install device × space under that member.
 */

export function resolveSpaceMemberId(args: {
  readonly accountId: string | null;
  readonly deviceId: string;
}): string {
  if (args.accountId !== null && args.accountId.length > 0) {
    return args.accountId;
  }
  return args.deviceId;
}

/** User-scoped membership row id: `${memberId}:${spaceId}`. */
export function spaceMembershipEntityId(
  memberId: string,
  spaceId: string
): string {
  return `${memberId}:${spaceId}`;
}

/** Device participation row id: `${deviceId}:${spaceId}`. */
export function spaceParticipationEntityId(
  deviceId: string,
  spaceId: string
): string {
  return `${deviceId}:${spaceId}`;
}

/** @deprecated Use {@link spaceParticipationEntityId}. */
export const spaceDeviceMembershipEntityId = spaceParticipationEntityId;

/** @deprecated Use {@link spaceParticipationEntityId}. */
export const spaceGuestMembershipEntityId = spaceParticipationEntityId;
