import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { searchResultPhase } from '@libs/search-shared-ts/search-result-phase';
import { Handles } from '@libs/test-ids-shared-ts/handles';
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
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { SearchRecentQueries } from './search-recent-queries';

const FIELD_ICON_SIZE = 18;

/** Where the people search for the typed query stands. */
export type PeopleSearchState = {
  /** The query is debouncing, or its answer is still on its way. */
  readonly searching: boolean;
  /** The search went out offline; shown results are only people on this device. */
  readonly needsConnection: boolean;
  /** The server reported why it could not answer. */
  readonly failed: boolean;
  readonly results: readonly UserSearchResult[];
};

export type SearchScreenViewProps = {
  /** The text in the search field, as typed. */
  readonly query: string;
  /** Completed searches, newest first; shown while the field is empty. */
  readonly recentQueries: readonly string[];
  readonly search: PeopleSearchState;
  /** Set when the person may not search people; shown once they type. */
  readonly denial?: DenialView | undefined;
  /**
   * One result's row content, such as a person with friend pills. `query`
   * is the typed search, so the row can emphasise what follows it.
   */
  readonly renderUserRow: (
    user: UserSearchResult,
    query: string
  ) => JSX.Element;
  readonly onQueryChange: (query: string) => void;
  readonly onSelectRecent: (query: string) => void;
  readonly onClearRecent: () => void;
};

function SearchResultRow(props: {
  readonly user: UserSearchResult;
  readonly query: string;
  readonly render: (user: UserSearchResult, query: string) => JSX.Element;
}): JSX.Element {
  return (
    <StackVertical testId={Handles.searchResultRow}>
      <StackVertical
        self="stretch"
        paddingX="lg"
        testId={Handles.searchUserResult(props.user.username)}
      >
        {props.render(props.user, props.query)}
      </StackVertical>
    </StackVertical>
  );
}

function SearchResults(props: {
  readonly query: string;
  readonly search: PeopleSearchState;
  readonly renderUserRow: (
    user: UserSearchResult,
    query: string
  ) => JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  const phase = () =>
    searchResultPhase({
      searching: props.search.searching,
      needsConnection: props.search.needsConnection,
      resultCount: props.search.results.length,
    });
  return (
    <Switch>
      <Match when={phase() === 'needs-connection' && props.search.failed}>
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
        <Show when={props.search.needsConnection}>
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
          items={props.search.results}
          keyExtractor={(user) => user.userId}
          estimateSize={60}
          edgeInset={false}
          panel
          renderItem={(user) => (
            <SearchResultRow
              user={user}
              query={props.query.trim()}
              render={props.renderUserRow}
            />
          )}
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

/**
 * `/search`, presentational: the people search field, recent searches or
 * the idle invitation while it is empty, and for a typed query its
 * searching, results, nobody-found, offline, failed and denied states.
 * `SearchScreen` wires the debounced search, history and permission.
 */
export function SearchScreenView(props: SearchScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const trimmed = () => props.query.trim();
  const showRecent = () => trimmed().length === 0;
  return (
    <CollectionScreen
      screenId="search"
      breadcrumbs={[{ name: t`Search` }]}
      controls={
        <TextInput
          value={props.query}
          onChangeText={(query) => props.onQueryChange(query)}
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
      <Show when={showRecent() && props.recentQueries.length === 0}>
        <SearchIdleState />
      </Show>
      <Show when={showRecent() && props.recentQueries.length > 0}>
        <SearchRecentQueries
          queries={props.recentQueries}
          onSelect={(query) => props.onSelectRecent(query)}
          onClear={() => props.onClearRecent()}
        />
      </Show>
      <Show when={!showRecent() ? props.denial : undefined}>
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
      <Show when={!showRecent() && props.denial === undefined}>
        <SearchResults
          query={trimmed()}
          search={props.search}
          renderUserRow={props.renderUserRow}
        />
      </Show>
    </CollectionScreen>
  );
}
