import { UserDisplayName } from '@libs/profile/client/user-display-name';
import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceGuestMembershipIds } from '../members/use-space-guest-membership-ids';
import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

const ROW_AVATAR_SIZE = 28;

export type SpaceMembersListProps = {
  spaceId: string;
};

/**
 * Compact, Google Docs-style list of members for a space. One row per
 * member (small avatar + display name), with the host always first and a
 * subtle `Host` caption on the host row. No section headers or extra
 * metadata; shared by the desktop rail body and the mobile members modal.
 */
export function SpaceMembersList({
  spaceId,
}: SpaceMembersListProps): ReactNode {
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  return (
    <Box sx={{ gap: 0 }}>
      {hostId !== null ? <SpaceMembersHostRow profileId={hostId} /> : null}
      {membershipIds.map((membershipId) => (
        <SpaceMembersGuestRow key={membershipId} membershipId={membershipId} />
      ))}
    </Box>
  );
}

function SpaceMembersHostRow({ profileId }: { profileId: string }): ReactNode {
  return (
    <SpaceMembersRowShell
      avatar={
        <UserProfileAvatar profileId={profileId} size={ROW_AVATAR_SIZE} />
      }
      name={
        <UserDisplayName
          profileId={profileId}
          variant="body"
          numberOfLines={1}
        />
      }
      trailing={
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Host</Trans>}
        />
      }
    />
  );
}

function SpaceMembersGuestRow({
  membershipId,
}: {
  membershipId: string;
}): ReactNode {
  const guestId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.guestId
  );
  if (guestId === null || guestId.length === 0) return null;
  return (
    <SpaceMembersRowShell
      avatar={<UserProfileAvatar profileId={guestId} size={ROW_AVATAR_SIZE} />}
      name={
        <UserDisplayName profileId={guestId} variant="body" numberOfLines={1} />
      }
    />
  );
}

function SpaceMembersRowShell({
  avatar,
  name,
  trailing,
}: {
  avatar: ReactNode;
  name: ReactNode;
  trailing?: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
        px: 3,
      }}
    >
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0 }}>{name}</Box>
      {trailing}
    </Box>
  );
}
