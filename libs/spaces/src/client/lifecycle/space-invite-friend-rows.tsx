import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Button, Text, useMutationButton } from '@pkgs/ui';
import { useCallback, type ReactNode } from 'react';

import { createSpaceInvite } from '../spaces-actions';
import { useSpacesClientDeps } from '../use-spaces-client-deps';

export type SpaceInviteFriendRowsProps = {
  readonly spaceId: string;
  readonly friends: readonly {
    readonly userId: string;
    readonly username: string;
  }[];
};

export function SpaceInviteFriendRows({
  spaceId,
  friends,
}: SpaceInviteFriendRowsProps): ReactNode {
  if (friends.length === 0) {
    return (
      <Text
        sx={{ color: 'textSecondary' }}
        label={<Trans>No friends to invite yet.</Trans>}
      />
    );
  }
  return (
    <Box sx={{ gap: 2 }}>
      {friends.map((friend) => (
        <FriendInviteRow
          key={friend.userId}
          spaceId={spaceId}
          friendId={friend.userId}
          username={friend.username}
        />
      ))}
    </Box>
  );
}

function FriendInviteRow({
  spaceId,
  friendId,
  username,
}: {
  readonly spaceId: string;
  readonly friendId: string;
  readonly username: string;
}): ReactNode {
  const { t } = useLingui();
  const deps = useSpacesClientDeps();
  const invite = useMutationButton({
    operation: useCallback(async () => {
      await createSpaceInvite(deps, {
        spaceId,
        kind: 'friend',
        inviteeAccountId: friendId,
      });
    }, [deps, spaceId, friendId]),
    labels: {
      idle: username.length > 0 ? t`Invite @${username}` : t`Invite friend`,
      loading: t`Sending…`,
      success: t`Invited`,
      error: t`Couldn't invite`,
    },
  });
  return <Button {...invite.buttonProps} variant="outline" size="sm" />;
}
