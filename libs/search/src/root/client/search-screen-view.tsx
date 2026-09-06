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
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  LoadingState,
  ScreenBase,
  ScreenBodyLegendList,
  SearchIcon,
  TextInput,
  UsersIcon,
  useTheme,
} from '@pkgs/ui-rn';
import { memo, type ReactNode, useCallback, useState } from 'react';

import { SearchRecentQueries } from './search-recent-queries';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

const MemoSearchUserResultRow = memo(function MemoSearchUserResultRow({
  user,
}: {
  user: UserSearchResult;
}) {
  return <SearchUserResultRow user={user} />;
});

const FIELD_ICON_SIZE = 18;

function SearchResults({
  query,
  searching,
  results,
  renderItem,
}: {
  query: string;
  searching: boolean;
  results: readonly UserSearchResult[];
  renderItem: (args: { item: UserSearchResult }) => ReactNode;
}): ReactNode {
  const { t } = useLingui();
  if (searching && results.length === 0) {
    return (
      <LoadingState
        variant="compact"
        caption={t`Searching…`}
        testID={Handles.searchLoading}
      />
    );
  }
  if (results.length === 0) {
    return (
      <EmptyState
        variant="compact"
        icon={SearchIcon}
        title={<Trans>No people found for “{query}”</Trans>}
        body={<Trans>Check the spelling or try a different username.</Trans>}
      />
    );
  }
  return (
    <ScreenBodyLegendList
      data={results}
      keyExtractor={(user) => user.userId}
      estimatedItemSize={72}
      drawDistance={160}
      renderItem={renderItem}
    />
  );
}

function SearchIdleState(): ReactNode {
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

function SearchScreenBody(): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const { queries, touch, clear } = useSearchHistory();
  const [query, setQuery] = useState('');
  const recordSearch = useCallback(
    (completedQuery: string) => {
      touch(completedQuery);
    },
    [touch]
  );
  const { results, searching, signedIn } = useDebouncedUserSearchEffect(
    query,
    recordSearch
  );
  const trimmed = query.trim();
  const showRecent = trimmed.length === 0;
  const showSignInPrompt =
    !signedIn && trimmed.length >= USER_SEARCH_MIN_LENGTH;
  const showResults = signedIn && trimmed.length >= USER_SEARCH_MIN_LENGTH;

  const renderItem = useCallback(
    ({ item }: { item: UserSearchResult }) => (
      <MemoSearchUserResultRow user={item} />
    ),
    []
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: 4 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t`Search by username or name`}
        accessibilityLabel={t`Search people`}
        startAdornment={
          <SearchIcon
            size={FIELD_ICON_SIZE}
            color={theme.colors.textSecondary}
          />
        }
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        clearButtonMode="while-editing"
        testID={Handles.searchInput}
      />
      {showRecent && queries.length === 0 ? <SearchIdleState /> : null}
      {showRecent && queries.length > 0 ? (
        <SearchRecentQueries
          queries={queries}
          onSelect={setQuery}
          onClear={clear}
        />
      ) : null}
      <UserSearchQueryHint query={query} signedIn={signedIn} />
      {showSignInPrompt ? <UserSearchSignInPrompt /> : null}
      {showResults ? (
        <SearchResults
          query={trimmed}
          searching={searching}
          results={results}
          renderItem={renderItem}
        />
      ) : null}
    </Box>
  );
}

export function SearchScreen(): ReactNode {
  const { t } = useLingui();

  return (
    <ScreenBase
      screenId="search"
      breadcrumbs={[{ name: t`Search` }]}
      content={({ sx }) => (
        <Box sx={sx}>
          <SearchScreenBody />
        </Box>
      )}
    />
  );
}
