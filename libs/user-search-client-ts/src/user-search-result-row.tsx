import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameText } from '@libs/moderation-shared-ts/display';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';

export type UserSearchResultRowProps = {
  readonly user: UserSearchResult;
};

/** Avatar + username row for pickers (no friend-action chrome). */
export function UserSearchResultRow(
  props: UserSearchResultRowProps
): JSX.Element {
  const moderation = useModeration();
  // The name as others may see it, so a masked name's initials never show.
  const shownName = (): string =>
    usernameText(moderation(), props.user.username, props.user.userId);
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <UserProfileAvatar
        profileId={props.user.userId}
        name={shownName()}
        size={44}
      />
      <StackVertical grow>
        <UserUsername
          profileId={props.user.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </StackVertical>
    </StackHorizontal>
  );
}
