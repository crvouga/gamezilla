import type { FriendProfile } from '@libs/friends-shared/friends-types';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameLabel } from '@libs/moderation-shared/display';
import { Handles } from '@libs/test-ids-shared/handles';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendProfileHeaderProps = {
  readonly profile: FriendProfile;
  readonly avatarSize?: number;
  readonly trailing?: JSX.Element;
};

export function FriendProfileHeader(
  props: FriendProfileHeaderProps
): JSX.Element {
  const moderation = useModeration();
  const handle = createMemo(() => {
    const label = usernameLabel(
      moderation(),
      props.profile.username,
      props.profile.userId
    );
    return label.length > 0 ? label : props.profile.userId.slice(0, 8);
  });

  return (
    <div class="box items-center gap-2 self-stretch">
      <FriendProfileAvatar
        profile={props.profile}
        size={props.avatarSize ?? 96}
      />
      <div class="box items-center gap-1 self-stretch">
        <h1
          class="text textHeading line-clamp-1 text-center"
          data-testid={Handles.friendUserUsername}
        >
          {handle()}
        </h1>
      </div>
      {props.trailing}
    </div>
  );
}
