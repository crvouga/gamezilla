import { searchResultPhase } from '@libs/search-shared-ts/search-result-phase';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  UserSearchDenied,
  useDebouncedUserSearchEffect,
} from '@libs/user-search-client-ts/use-user-search';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  SearchIcon,
  UsersIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { SearchRecentQueries } from './search-recent-queries';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

const FIELD_ICON_SIZE = 18;

function SearchResults(props: {
  query: string;
  searching: boolean;
  needsConnection: boolean;
  failed: boolean;
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
      <Match when={phase() === 'needs-connection' && props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Search needs a connection</Trans>}
          body={
            <Trans>
              We couldn't reach the server. Search again once you're back
              online.
            </Trans>
          }
          dataSet={{ testid: Handles.searchNeedsConnection }}
        />
      </Match>
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
        <Show when={props.needsConnection}>
          <Notice
            tone="info"
            icon={WifiOffIcon}
            dataSet={{ testid: Handles.searchOfflineResults }}
          >
            <Trans>
              You're offline, so some people may not show up until you're back
              online.
            </Trans>
          </Notice>
        </Show>
        <ScreenBodyVirtualList
          dataSet={{ testid: Handles.searchResults }}
          items={props.results}
          keyExtractor={(user) => user.userId}
          estimateSize={60}
          edgeInset={false}
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

export function SearchScreen(): JSX.Element {
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
    <CollectionScreen
      screenId="search"
      breadcrumbs={[{ name: t`Search` }]}
      controls={
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
      }
    >
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
          failed={state.failed}
          results={state.results}
        />
      </Show>
    </CollectionScreen>
  );
}
