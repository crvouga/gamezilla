import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { useSpacePresence } from '../room/use-space-presence';

/**
 * Whether `deviceId` is this install *and* the active room connection is this
 * browser tab.
 */
export function useMemberIsThisTab(
  _spaceId: string,
  deviceId: string
): boolean {
  const myDeviceId = useMyDeviceId();
  const { peersByMemberId, selfPeerId } = useSpacePresence();
  if (myDeviceId !== deviceId) return false;
  if (selfPeerId === null) return false;
  return (peersByMemberId.get(deviceId) ?? []).includes(selfPeerId);
}
