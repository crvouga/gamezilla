import { Handles } from '@libs/test-ids-shared/handles';
import { UserSearchResultRow } from '@libs/user-search-client/user-search-result-row';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { type JSX, Show } from 'solid-js';

import { useSearchResultSlots } from './search-result-slots';

export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const slots = useSearchResultSlots();

  return (
    <StackVertical testId={Handles.searchResultRow}>
      <StackVertical
        self="stretch"
        paddingX="lg"
        testId={Handles.searchUserResult(props.user.username)}
      >
        <Show
          when={slots.userRow}
          fallback={<UserSearchResultRow user={props.user} />}
        >
          {(userRow) => userRow()(props.user)}
        </Show>
      </StackVertical>
    </StackVertical>
  );
}
