import { SpaceGuestMembershipAvatar } from './space-guest-membership-avatar';
import { SpaceHostAvatar } from './space-host-avatar';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { AvatarGroup } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceMembersAvatarGroupProps = {
  spaceId: string;
  /** Avatar diameter in px. Defaults to 36. */
  size?: number;
};

const DEFAULT_SIZE = 36;
const MAX_VISIBLE = 4;
const AVATAR_GROUP_RING = 'surface' as const;

/**
 * Stacked host + guest faces for space chrome. Press handling belongs on the
 * surrounding {@link IconButton} / ActionBar avatar item.
 */
export function SpaceMembersAvatarGroup({
  spaceId,
  size = DEFAULT_SIZE,
}: SpaceMembersAvatarGroupProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);

  return (
    <AvatarGroup
      size={size}
      maxVisible={MAX_VISIBLE}
      ringColor={AVATAR_GROUP_RING}
    >
      <SpaceHostAvatar spaceId={spaceId} size={size} />
      {membershipIds.map((mid) => (
        <SpaceGuestMembershipAvatar key={mid} membershipId={mid} size={size} />
      ))}
    </AvatarGroup>
  );
}
