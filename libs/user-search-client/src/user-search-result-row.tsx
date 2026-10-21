import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';

export type UserSearchResultRowProps = {
  readonly user: UserSearchResult;
};

/** Avatar + username row for pickers (no friend-action chrome). */
export function UserSearchResultRow(
  props: UserSearchResultRowProps
): JSX.Element {
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <UserProfileAvatar profileId={props.user.userId} size={44} />
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
