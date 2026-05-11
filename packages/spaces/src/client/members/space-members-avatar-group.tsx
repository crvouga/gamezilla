import { SpaceGuestMembershipAvatar } from './space-guest-membership-avatar';
import { SpaceHostAvatar } from './space-host-avatar';
import { SpaceMembersListModal } from './space-members-list-modal';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { AvatarGroup, Pressable } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

export type SpaceMembersAvatarGroupProps = {
  spaceId: string;
};

const AVATAR_SIZE = 36;
const MAX_VISIBLE = 4;
const AVATAR_GROUP_RING = 'surface' as const;

/**
 * Stacked avatar pill (host + guests) for the active space header. Clicking
 * opens the full members list modal.
 */
export function SpaceMembersAvatarGroup({
  spaceId,
}: SpaceMembersAvatarGroupProps): ReactNode {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const membershipIds = useSpaceGuestMembershipIds(spaceId);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t`People in this space`}
      >
        <AvatarGroup
          size={AVATAR_SIZE}
          maxVisible={MAX_VISIBLE}
          ringColor={AVATAR_GROUP_RING}
        >
          <SpaceHostAvatar spaceId={spaceId} size={AVATAR_SIZE} />
          {membershipIds.map((mid) => (
            <SpaceGuestMembershipAvatar
              key={mid}
              membershipId={mid}
              size={AVATAR_SIZE}
            />
          ))}
        </AvatarGroup>
      </Pressable>
      <SpaceMembersListModal
        spaceId={spaceId}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
