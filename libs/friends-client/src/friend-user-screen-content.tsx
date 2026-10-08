import type {
  FriendProfile,
  FriendshipStatus,
} from '@libs/friends-shared/friends-types';
import type { JSX } from 'solid-js';
import { FriendActionPills } from './friend-action-pills';
import { FriendProfileHeader } from './friend-profile-header';
import { FriendUserDangerModals } from './friend-user-danger-modals';

export function FriendUserScreenContent(props: {
  class?: string | undefined;
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
}): JSX.Element {
  return (
    <div class={`box items-center gap-4 pt-2 ${props.class ?? ''}`.trim()}>
      <FriendProfileHeader profile={props.profile} />
      <div class="box self-stretch">
        <FriendActionPills
          userId={props.userId}
          username={props.profile.username}
          status={props.status}
          incomingRequestId={props.incomingRequestId}
          outgoingRequestId={props.outgoingRequestId}
          onChanged={props.onChanged}
        />
      </div>
      <FriendUserDangerModals
        username={props.profile.username}
        removeOpen={props.removeOpen}
        blockOpen={props.blockOpen}
        onCloseRemove={props.onCloseRemove}
        onCloseBlock={props.onCloseBlock}
        onRemove={props.onRemove}
        onBlock={props.onBlock}
      />
    </div>
  );
}
