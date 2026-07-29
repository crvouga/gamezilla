import { useMemo } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';

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
  return useMemo(() => {
    if (hostMemberId === null || hostMemberId.length === 0) return null;
    return {
      deviceId: hostMemberId,
      membershipId: hostMemberId,
      profileId: hostMemberId,
      deviceLabel: null,
    };
  }, [hostMemberId]);
}
