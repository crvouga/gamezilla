import { useMyDeviceId, useMyId } from '@libs/auth-client/use-current-user';
import { useSyncedProfiles } from '@libs/profile-client/use-synced-profiles';
import { resolveSpaceHostProfileId } from '@libs/spaces-shared/resolve-space-host-profile-id';
import { type Accessor, createMemo } from 'solid-js';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceHostMembershipDisplay = {
  readonly deviceId: string;
  readonly membershipId: string;
  readonly profileId: string;
  readonly deviceLabel: string | null;
};

/** Host member display fields from the spaces row (member id = profile id). */
export function useSpaceHostMembershipDisplay(
  spaceId: string | Accessor<string>
): Accessor<SpaceHostMembershipDisplay | null> {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const hostAccountId = useSpaceColumn(spaceId, SpaceField.hostAccountId);
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const myDeviceId = useMyDeviceId();
  const myId = useMyId();
  const host = createMemo(() => {
    const deviceColumn = hostId();
    let profileId = resolveSpaceHostProfileId(hostMemberId(), hostAccountId());
    if (
      profileId === null &&
      deviceColumn !== null &&
      deviceColumn.length > 0 &&
      deviceColumn === myDeviceId() &&
      myId().length > 0
    ) {
      profileId = myId();
    }
    if (profileId === null) return null;
    return {
      deviceId: profileId,
      membershipId: profileId,
      profileId,
      deviceLabel: null,
    };
  });
  useSyncedProfiles(() => {
    const id = host()?.profileId;
    return id === undefined ? [] : [id];
  });
  return host;
}
