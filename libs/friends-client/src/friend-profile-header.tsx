import type { FriendProfile } from '@libs/friends-shared/friends-types';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameLabel } from '@libs/moderation-shared/display';
import { Handles } from '@libs/test-ids-shared/handles';
import { H2 } from '@pkgs/ui-root-client/heading';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

/** Another person's identity, drawn like the owner's own profile. */
export function FriendProfileHeader(props: {
  readonly profile: FriendProfile;
}): JSX.Element {
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
    <>
      <FriendProfileAvatar profile={props.profile} size={96} />
      <H2
        size="heading"
        lines={1}
        align="center"
        testId={Handles.friendUserUsername}
      >
        {handle()}
      </H2>
    </>
  );
}
