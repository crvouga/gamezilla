import { type Accessor, createMemo } from 'solid-js';

import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export function useSpaceMemberCount(spaceId: string): Accessor<number> {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const guests = useSpaceGuestMembershipIds(spaceId);
  return createMemo(() => {
    const host = hostMemberId();
    return (host !== null && host.length > 0 ? 1 : 0) + guests().length;
  });
}
