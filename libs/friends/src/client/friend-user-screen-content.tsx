import { Box, type SxInput } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { FriendProfile, FriendshipStatus } from '../shared/friends-types';
import { FriendActionPills } from './friend-action-pills/friend-action-pills';
import { FriendProfileHeader } from './friend-profile-header';
import { FriendUserDangerModals } from './friend-user-danger-modals';

export function FriendUserScreenContent({
  sx,
  profile,
  userId,
  status,
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
  sx: SxInput;
  profile: FriendProfile;
  userId: string;
  status: FriendshipStatus;
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
    <Box sx={[sx, { alignItems: 'center', gap: 4, paddingTop: 8 }]}>
      <FriendProfileHeader profile={profile} />
      <Box sx={{ alignSelf: 'stretch' }}>
        <FriendActionPills
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
