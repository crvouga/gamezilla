import { AvatarGroup } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';
import { SpaceGuestMembershipAvatar } from './space-guest-membership-avatar';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestAvatarGroupProps = {
  spaceId: string;
  size: number;
  maxVisible: number;
  ringColor?: string;
};

/** Stacked guest avatars for a space, keyed by membership id. */
export function SpaceGuestAvatarGroup({
  spaceId,
  size,
  maxVisible,
  ringColor,
}: SpaceGuestAvatarGroupProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) return null;
  return (
    <AvatarGroup
      size={size}
      maxVisible={maxVisible}
      {...optionalProps({ ringColor })}
    >
      {membershipIds.map((mid) => (
        <SpaceGuestMembershipAvatar key={mid} membershipId={mid} size={size} />
      ))}
    </AvatarGroup>
  );
}
