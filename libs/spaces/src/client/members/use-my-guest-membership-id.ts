import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';

/**
 * Composite membership id `${deviceId}:${spaceId}` for this install in the
 * given space, or `null` when there is no device id.
 *
 * Note: this is purely a derived id — it does not check whether the
 * membership row actually exists.
 */
export function useMyGuestMembershipId(spaceId: string): string | null {
  const deviceId = useMyDeviceId();
  if (deviceId.length === 0 || spaceId.length === 0) return null;
  return spaceDeviceMembershipEntityId(deviceId, spaceId);
}
