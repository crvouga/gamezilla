import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';

const AVATAR_SIZE = 44;

export function SpaceShareUserRow(props: {
  readonly userId: string;
  readonly trailing: JSX.Element | null;
}): JSX.Element {
  return (
    <StackHorizontal
      align="center"
      gap="md"
      paddingX="lg"
      paddingY="sm"
      minHeight="row"
    >
      <UserProfileAvatar profileId={props.userId} size={AVATAR_SIZE} />
      <StackVertical grow>
        <UserUsername
          profileId={props.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </StackVertical>
      {props.trailing}
    </StackHorizontal>
  );
}
