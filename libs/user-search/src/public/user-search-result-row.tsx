import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { type JSX, Show } from 'solid-js';

import type { UserSearchResult } from './user-search-types';

export type UserSearchResultRowProps = {
  readonly user: UserSearchResult;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: JSX.Element;
};

/** Avatar + username row for pickers (no friend-action chrome). */
export function UserSearchResultRow(
  props: UserSearchResultRowProps
): JSX.Element {
  const body = () => (
    <div class="box flex-row items-center gap-2 py-2">
      <UserProfileAvatar profileId={props.user.userId} size={44} />
      <div class="box flex-1 min-w-[0]">
        <UserUsername
          profileId={props.user.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </div>
      {props.trailing}
    </div>
  );

  return (
    <Show when={props.onPress} fallback={body()}>
      {(onPress) => (
        <button
          class="clickable clickableTint"
          type="button"
          onClick={() => onPress()()}
        >
          {body()}
        </button>
      )}
    </Show>
  );
}
