import { Handles } from '@libs/test-ids-shared/handles';
import {
  UserSearchDenied,
  useDebouncedUserSearchEffect,
} from '@libs/user-search-client/use-user-search';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { ScreenBodyVirtualList } from '@pkgs/ui-client/screen-body-virtual-list';
import { SearchIcon, UsersIcon } from '@pkgs/ui-client/icons';
import { TextInput } from '@pkgs/ui-client/text-input';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';

import { searchResultPhase } from '@libs/search-shared/search-result-phase';
import { SearchRecentQueries } from './search-recent-queries';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

const FIELD_ICON_SIZE = 18;

function SearchResults(props: {
  query: string;
  searching: boolean;
  needsConnection: boolean;
  results: readonly UserSearchResult[];
}): JSX.Element {
  const { t } = useLingui();
  const phase = () =>
    searchResultPhase({
      searching: props.searching,
      needsConnection: props.needsConnection,
      resultCount: props.results.length,
    });
  return (
    <Switch>
      <Match when={phase() === 'needs-connection'}>
        <EmptyState
          variant="compact"
          icon={SearchIcon}
          title={<Trans>Search needs a connection</Trans>}
          body={
            <Trans>You're offline. Search again once you're back online.</Trans>
          }
          dataSet={{ testid: Handles.searchNeedsConnection }}
        />
      </Match>
      <Match when={phase() === 'searching'}>
        <LoadingState
          variant="compact"
          caption={t`Searching…`}
          dataSet={{ testid: Handles.searchLoading }}
        />
      </Match>
      <Match when={phase() === 'empty'}>
        <EmptyState
          variant="compact"
          icon={SearchIcon}
          title={<Trans>No people found for “{props.query}”</Trans>}
          body={<Trans>Check the spelling or try a different username.</Trans>}
          dataSet={{ testid: Handles.searchEmpty }}
        />
      </Match>
      <Match when={phase() === 'results'}>
        <ScreenBodyVirtualList
          dataSet={{ testid: Handles.searchResults }}
          items={props.results}
          keyExtractor={(user) => user.userId}
          estimateSize={60}
          contentStyle={{
            'padding-left': '0',
            'padding-right': '0',
          }}
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
  const showDenied = () => !state.canSearch && trimmed().length > 0;
  const showResults = () => state.canSearch && trimmed().length > 0;

  return (
    <div class="box flex-1 min-h-0 gap-4">
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
      <Show when={showDenied()}>
        <UserSearchDenied />
      </Show>
      <Show when={showResults()}>
        <SearchResults
          query={trimmed()}
          searching={state.searching}
          needsConnection={state.needsConnection}
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
