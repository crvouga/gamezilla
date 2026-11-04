import { UserSearchResultRow } from '@libs/user-search-client-ts/user-search-result-row';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { type JSX, Show } from 'solid-js';

import { useSearchResultSlots } from './search-result-slots';

/** One person's result row: the slot another sub fills, or avatar + username. */
export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
  /** What was typed, for the row to emphasise what sets the name apart. */
  readonly query: string;
}): JSX.Element {
  const slots = useSearchResultSlots();
  return (
    <Show
      when={slots.userRow}
      fallback={<UserSearchResultRow user={props.user} />}
    >
      {(userRow) => userRow()(props.user, props.query)}
    </Show>
  );
}
