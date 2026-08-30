import { Handles } from '@libs/dst-handles';
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
  ScreenBase,
  ScreenBodyLegendList,
  Text,
  TextInput,
} from '@pkgs/ui';
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

function SearchScreenBody(): ReactNode {
  const { t } = useLingui();
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
    <Box sx={{ flex: 1, minHeight: 0, gap: 2 }}>
      <TextInput
        label={<Trans>Search</Trans>}
        value={query}
        onChangeText={setQuery}
        placeholder={t`Search by username or name`}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        testID={Handles.searchInput}
      />
      {showRecent ? (
        <SearchRecentQueries
          queries={queries}
          onSelect={setQuery}
          onClear={clear}
        />
      ) : null}
      <UserSearchQueryHint query={query} signedIn={signedIn} />
      {showSignInPrompt ? <UserSearchSignInPrompt /> : null}
      {showResults && searching ? (
        <Text variant="body" label={t`Searching…`} />
      ) : null}
      {showResults && !searching && results.length > 0 ? (
        <ScreenBodyLegendList
          data={results}
          keyExtractor={(user) => user.userId}
          estimatedItemSize={72}
          drawDistance={160}
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
