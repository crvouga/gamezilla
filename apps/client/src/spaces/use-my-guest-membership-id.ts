import { useMyProfileId } from '@gamezilla/client/profile/use-my-profile-id';
import { spaceGuestMembershipEntityId } from '@gamezilla/domain/spaces/membership-key';

/**
 * Composite membership id `${myProfileId}:${spaceId}` for the current user
 * in the given space, or `null` when there is no current profile id.
 *
 * Note: this is purely a derived id — it does not check whether the
 * membership row actually exists. Callers usually pair it with an atom that
 * reads the membership's `leftAt` (e.g. `<MyMembershipPresence>`).
 */
export function useMyGuestMembershipId(spaceId: string): string | null {
  const myId = useMyProfileId();
  if (myId === null || spaceId.length === 0) return null;
  return spaceGuestMembershipEntityId(myId, spaceId);
}
