import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import type { JSX } from 'solid-js';

export function SpaceShareUserRow(props: {
  readonly userId: string;
  readonly trailing: JSX.Element | null;
}): JSX.Element {
  return (
    <div class="box flex-row items-center gap-2 py-2">
      <UserProfileAvatar profileId={props.userId} size={44} />
      <div class="box flex-1 min-w-0">
        <UserUsername
          profileId={props.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </div>
      {props.trailing}
    </div>
  );
}
