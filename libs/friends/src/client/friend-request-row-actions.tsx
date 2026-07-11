import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
} from './friends-actions';
import { useFriendsClientDeps } from './use-friends-client-deps';
import type { EnrichedFriendRequest } from '../shared/friends-types';
import { Box, Button, useMutationButton } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

import { FriendUserRow } from './friend-user-row';

function IncomingRequestActions({
  request,
  onChanged,
}: {
  request: EnrichedFriendRequest;
  onChanged: () => void;
}): ReactNode {
  const { t } = useLingui();
  const deps = useFriendsClientDeps();

  const confirm = useMutationButton({
    operation: useCallback(async () => {
      await acceptFriendRequest(deps, request.id);
      onChanged();
    }, [deps, onChanged, request.id]),
    labels: {
      idle: <Trans>Confirm</Trans>,
      loading: t`Confirming…`,
      success: t`Confirmed`,
      error: t`Couldn't confirm`,
    },
    successHoldMs: 0,
    sounds: {
      success: Sounds.social.friendRequestAccepted,
      error: Sounds.feedback.error,
    },
  });

  const del = useMutationButton({
    operation: useCallback(async () => {
      await declineFriendRequest(deps, request.id);
      onChanged();
    }, [deps, onChanged, request.id]),
    labels: {
      idle: <Trans>Delete</Trans>,
      loading: t`Deleting…`,
      success: t`Deleted`,
      error: t`Couldn't delete`,
    },
    successHoldMs: 0,
    sounds: {
      success: Sounds.feedback.cancel,
      error: Sounds.feedback.error,
    },
  });

  return (
    <Box sx={{ flexDirection: 'row', gap: 1 }}>
      <Button variant="solid" {...confirm.buttonProps} />
      <Button variant="outline" {...del.buttonProps} />
    </Box>
  );
}

function OutgoingRequestActions({
  request,
  onChanged,
}: {
  request: EnrichedFriendRequest;
  onChanged: () => void;
}): ReactNode {
  const { t } = useLingui();
  const deps = useFriendsClientDeps();

  const cancel = useMutationButton({
    operation: useCallback(async () => {
      await cancelFriendRequest(deps, request.id);
      onChanged();
    }, [deps, onChanged, request.id]),
    labels: {
      idle: <Trans>Requested</Trans>,
      loading: t`Cancelling…`,
      success: t`Cancelled`,
      error: t`Couldn't cancel`,
    },
    successHoldMs: 0,
  });

  return <Button variant="outline" {...cancel.buttonProps} />;
}

export function FriendRequestIncomingRow({
  request,
  onPress,
  onChanged,
}: {
  request: EnrichedFriendRequest;
  onPress: () => void;
  onChanged: () => void;
}): ReactNode {
  return (
    <FriendUserRow
      profile={request.otherUser}
      onPress={onPress}
      trailing={
        <IncomingRequestActions request={request} onChanged={onChanged} />
      }
    />
  );
}

export function FriendRequestOutgoingRow({
  request,
  onPress,
  onChanged,
}: {
  request: EnrichedFriendRequest;
  onPress: () => void;
  onChanged: () => void;
}): ReactNode {
  return (
    <FriendUserRow
      profile={request.otherUser}
      onPress={onPress}
      trailing={
        <OutgoingRequestActions request={request} onChanged={onChanged} />
      }
    />
  );
}
