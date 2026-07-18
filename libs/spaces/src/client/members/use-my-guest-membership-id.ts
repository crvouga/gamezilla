import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { spaceParticipationEntityId } from '@libs/spaces/shared/membership-key';

/**
 * Participation id `${deviceId}:${spaceId}` for this install in the given
 * space, or `null` when there is no device id.
 *
 * Derived id only — does not check whether the participation row exists.
 */
export function useMyGuestMembershipId(spaceId: string): string | null {
  const deviceId = useMyDeviceId();
  if (deviceId.length === 0 || spaceId.length === 0) return null;
  return spaceParticipationEntityId(deviceId, spaceId);
}

/** @deprecated Alias of {@link useMyGuestMembershipId} (device participation). */
export const useMyParticipationId = useMyGuestMembershipId;
