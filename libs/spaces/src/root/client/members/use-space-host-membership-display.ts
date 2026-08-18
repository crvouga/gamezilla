import { useMyDeviceId, useMyId } from '@libs/auth/public/use-current-user';
import { useMemo } from 'react';
import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { resolveSpaceHostProfileId } from '../../../shared/space/resolve-space-host-profile-id';

export type SpaceHostMembershipDisplay = {
  readonly deviceId: string;
  readonly membershipId: string;
  readonly profileId: string;
  readonly deviceLabel: string | null;
};

/** Host member display fields from the spaces row (member id = profile id). */
export function useSpaceHostMembershipDisplay(
  spaceId: string
): SpaceHostMembershipDisplay | null {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const hostAccountId = useSpaceColumn(spaceId, SpaceField.hostAccountId);
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const myDeviceId = useMyDeviceId();
  const myId = useMyId();
  return useMemo(() => {
    let profileId = resolveSpaceHostProfileId(hostMemberId, hostAccountId);
    if (
      profileId === null &&
      hostId !== null &&
      hostId.length > 0 &&
      hostId === myDeviceId &&
      myId.length > 0
    ) {
      profileId = myId;
    }
    if (profileId === null) return null;
    return {
      deviceId: profileId,
      membershipId: profileId,
      profileId,
      deviceLabel: null,
    };
  }, [hostMemberId, hostAccountId, hostId, myDeviceId, myId]);
}
