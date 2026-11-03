import { UserSearchResultRow } from '@libs/user-search-client-ts/user-search-result-row';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { type JSX, Show } from 'solid-js';

import { useSearchResultSlots } from './search-result-slots';

/** One person's result row: the slot another sub fills, or avatar + username. */
export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const slots = useSearchResultSlots();
  return (
    <Show
      when={slots.userRow}
      fallback={<UserSearchResultRow user={props.user} />}
    >
      {(userRow) => userRow()(props.user)}
    </Show>
  );
}
