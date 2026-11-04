import {
  useDebouncedUserSearchEffect,
  useUserSearchDenial,
} from '@libs/user-search-client-ts/use-user-search';
import { createSignal, type JSX } from 'solid-js';
import { SearchScreenView } from './search-screen-view';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

/** `/search`: wires `SearchScreenView` to the debounced people search and history. */
export function SearchScreen(): JSX.Element {
  const { queries, touch, clear } = useSearchHistory();
  const [query, setQuery] = createSignal('');
  const state = useDebouncedUserSearchEffect(query, touch);
  const denial = useUserSearchDenial();
  return (
    <SearchScreenView
      query={query()}
      recentQueries={queries}
      search={state}
      denial={state.canSearch ? undefined : denial()}
      renderUserRow={(user, query) => (
        <SearchUserResultRow user={user} query={query} />
      )}
      onQueryChange={setQuery}
      onSelectRecent={setQuery}
      onClearRecent={clear}
    />
  );
}
