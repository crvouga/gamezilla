import { Handles } from '@libs/test-ids-shared/handles';
import { UserSearchResultRow } from '@libs/user-search-client/user-search-result-row';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';

import { useSearchResultSlots } from './search-result-slots';

export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const slots = useSearchResultSlots();

  return (
    <div {...dataAttrs({ testid: Handles.searchResultRow })}>
      <div
        class="box self-stretch px-4"
        {...dataAttrs({
          testid: Handles.searchUserResult(props.user.username),
        })}
      >
        <Show
          when={slots.userRow}
          fallback={<UserSearchResultRow user={props.user} />}
        >
          {(userRow) => userRow()(props.user)}
        </Show>
      </div>
    </div>
  );
}
