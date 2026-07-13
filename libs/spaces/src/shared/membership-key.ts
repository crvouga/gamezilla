/**
 * Device-seat membership row id: `${deviceId}:${spaceId}`.
 * `guest_id` on the row is always the install device id.
 */
export function spaceDeviceMembershipEntityId(
  deviceId: string,
  spaceId: string
): string {
  return `${deviceId}:${spaceId}`;
}

/** @deprecated Use {@link spaceDeviceMembershipEntityId}. */
export const spaceGuestMembershipEntityId = spaceDeviceMembershipEntityId;
