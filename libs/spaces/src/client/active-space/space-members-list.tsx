import { UserUsername } from '@libs/profile/client/user-username';
import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { useMyId } from '@libs/auth/client/use-current-user';
import { Box, CONTENT_EDGE_PADDING_STEP, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceGuestMembershipIds } from '../members/use-space-guest-membership-ids';
import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';
import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

const ROW_AVATAR_SIZE = 28;

export type SpaceMembersListProps = {
  spaceId: string;
};

/**
 * Compact member list: one row per user membership. Host first; "You" when
 * the member is this account (or anon device).
 */
export function SpaceMembersList({
  spaceId,
}: SpaceMembersListProps): ReactNode {
  const host = useSpaceHostMembershipDisplay(spaceId);
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  return (
    <Box sx={{ gap: 0 }}>
      {host !== null ? (
        <SpaceMembersSeatRow
          profileId={host.profileId}
          memberId={host.deviceId}
          deviceLabel={host.deviceLabel}
          trailing={
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={<Trans>Host</Trans>}
            />
          }
        />
      ) : null}
      {membershipIds.map((membershipId) => (
        <SpaceMembersGuestRow key={membershipId} membershipId={membershipId} />
      ))}
    </Box>
  );
}

function SpaceMembersGuestRow({
  membershipId,
}: {
  membershipId: string;
}): ReactNode {
  const memberId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.memberId
  );
  const profileId =
    useSpaceMembershipColumn(membershipId, SpaceMembershipField.profileId) ??
    memberId;
  if (memberId === null || memberId.length === 0) return null;
  if (profileId === null || profileId.length === 0) return null;
  return (
    <SpaceMembersSeatRow
      profileId={profileId}
      memberId={memberId}
      deviceLabel={null}
    />
  );
}

function SpaceMembersSeatRow({
  profileId,
  memberId,
  deviceLabel,
  trailing,
}: {
  profileId: string;
  memberId: string;
  deviceLabel: string | null;
  trailing?: ReactNode;
}): ReactNode {
  const myId = useMyId();
  const isYou = memberId === myId;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
        px: CONTENT_EDGE_PADDING_STEP,
      }}
    >
      <UserProfileAvatar profileId={profileId} size={ROW_AVATAR_SIZE} />
      <Box sx={{ flex: 1, minWidth: 0, gap: 0 }}>
        <UserUsername
          profileId={profileId}
          withAt={false}
          variant="body"
          numberOfLines={1}
        />
        {deviceLabel !== null && deviceLabel.length > 0 ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            numberOfLines={1}
            label={deviceLabel}
          />
        ) : null}
      </Box>
      {isYou ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>You</Trans>}
        />
      ) : null}
      {trailing}
    </Box>
  );
}
