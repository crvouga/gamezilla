import { Handles } from '@libs/test-ids';
import {
  UserSearchQueryHint,
  UserSearchSignInPrompt,
  useDebouncedUserSearchEffect,
} from '@libs/user-search/public/use-user-search';
import {
  USER_SEARCH_MIN_LENGTH,
  type UserSearchResult,
} from '@libs/user-search/public/user-search-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  EmptyState,
  LoadingState,
  ScreenBase,
  ScreenBodyVirtualList,
  SearchIcon,
  TextInput,
  UsersIcon,
} from '@pkgs/ui';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';

import { SearchRecentQueries } from './search-recent-queries';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

const FIELD_ICON_SIZE = 18;

function SearchResults(props: {
  query: string;
  searching: boolean;
  results: readonly UserSearchResult[];
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.searching && props.results.length === 0}>
        <LoadingState
          variant="compact"
          caption={t`Searching…`}
          dataSet={{ testid: Handles.searchLoading }}
        />
      </Match>
      <Match when={props.results.length === 0}>
        <EmptyState
          variant="compact"
          icon={SearchIcon}
          title={<Trans>No people found for “{props.query}”</Trans>}
          body={<Trans>Check the spelling or try a different username.</Trans>}
        />
      </Match>
      <Match when={true}>
        <ScreenBodyVirtualList
          items={props.results}
          keyExtractor={(user) => user.userId}
          estimateSize={72}
          renderItem={(user) => <SearchUserResultRow user={user} />}
        />
      </Match>
    </Switch>
  );
}

function SearchIdleState(): JSX.Element {
  return (
    <EmptyState
      icon={UsersIcon}
      title={<Trans>Find people</Trans>}
      body={
        <Trans>
          Search by username or name to add friends and invite them to spaces.
        </Trans>
      }
    />
  );
}

function SearchScreenBody(): JSX.Element {
  const { t } = useLingui();
  const { queries, touch, clear } = useSearchHistory();
  const [query, setQuery] = createSignal('');
  const recordSearch = (completedQuery: string) => {
    touch(completedQuery);
  };
  const state = useDebouncedUserSearchEffect(query, recordSearch);
  const trimmed = () => query().trim();
  const showRecent = () => trimmed().length === 0;
  const showSignInPrompt = () =>
    !state.signedIn && trimmed().length >= USER_SEARCH_MIN_LENGTH;
  const showResults = () =>
    state.signedIn && trimmed().length >= USER_SEARCH_MIN_LENGTH;

  return (
    <div class="box flex-1 min-h-[0] gap-4">
      <TextInput
        value={query()}
        onChangeText={setQuery}
        placeholder={t`Search by username or name`}
        aria-label={t`Search people`}
        startAdornment={
          <SearchIcon size={FIELD_ICON_SIZE} color="textSecondary" />
        }
        autocapitalize="none"
        autocorrect="off"
        autofocus
        dataSet={{ testid: Handles.searchInput }}
      />
      <Show when={showRecent() && queries.length === 0}>
        <SearchIdleState />
      </Show>
      <Show when={showRecent() && queries.length > 0}>
        <SearchRecentQueries
          queries={queries}
          onSelect={setQuery}
          onClear={clear}
        />
      </Show>
      <UserSearchQueryHint query={query()} signedIn={state.signedIn} />
      <Show when={showSignInPrompt()}>
        <UserSearchSignInPrompt />
      </Show>
      <Show when={showResults()}>
        <SearchResults
          query={trimmed()}
          searching={state.searching}
          results={state.results}
        />
      </Show>
    </div>
  );
}

export function SearchScreen(): JSX.Element {
  const { t } = useLingui();

  return (
    <ScreenBase
      screenId="search"
      breadcrumbs={[{ name: t`Search` }]}
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass}`}>
          <SearchScreenBody />
        </div>
      )}
    />
  );
}
