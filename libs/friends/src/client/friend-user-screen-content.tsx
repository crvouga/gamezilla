import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { FriendActionPills } from './friend-action-pills';
import { FriendProfileHeader } from './friend-profile-header';
import { FriendUserDangerModals } from './friend-user-danger-modals';
import type { FriendProfile, FriendshipStatus } from '../shared/friends-types';
import type { FriendsClientDeps } from './friends-actions';

export function FriendUserScreenContent({
  sx,
  profile,
  userId,
  status,
  deps,
  incomingRequestId,
  outgoingRequestId,
  onChanged,
  removeOpen,
  blockOpen,
  onCloseRemove,
  onCloseBlock,
  onRemove,
  onBlock,
}: {
  sx: Record<string, unknown>;
  profile: FriendProfile;
  userId: string;
  status: FriendshipStatus;
  deps: FriendsClientDeps;
  incomingRequestId: string | null;
  outgoingRequestId: string | null;
  onChanged: () => void;
  removeOpen: boolean;
  blockOpen: boolean;
  onCloseRemove: () => void;
  onCloseBlock: () => void;
  onRemove: () => Promise<void>;
  onBlock: () => Promise<void>;
}): ReactNode {
  return (
    <Box style={{ ...sx, alignItems: 'center', gap: 16, paddingTop: 8 }}>
      <FriendProfileHeader profile={profile} />
      <Box sx={{ alignSelf: 'stretch' }}>
        <FriendActionPills
          deps={deps}
          userId={userId}
          status={status}
          incomingRequestId={incomingRequestId}
          outgoingRequestId={outgoingRequestId}
          onChanged={onChanged}
        />
      </Box>
      <FriendUserDangerModals
        removeOpen={removeOpen}
        blockOpen={blockOpen}
        onCloseRemove={onCloseRemove}
        onCloseBlock={onCloseBlock}
        onRemove={onRemove}
        onBlock={onBlock}
      />
    </Box>
  );
}
