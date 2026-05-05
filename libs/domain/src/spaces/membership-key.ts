/** Guest membership row id: `${guestId}:${spaceId}`. */
export function spaceGuestMembershipEntityId(
  guestId: string,
  spaceId: string
): string {
  return `${guestId}:${spaceId}`;
}
