import { Box, ScreenBase, Text, TextInput } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useDebouncedUserSearchEffect,
  UserSearchQueryHint,
  UserSearchSignInPrompt,
} from '@libs/user-search/client/use-user-search';
import { USER_SEARCH_MIN_LENGTH } from '@libs/user-search/shared/user-search-types';
import { useCallback, useState, type ReactNode } from 'react';

import { SearchRecentQueries } from './search-recent-queries';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';

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
  const showSignInPrompt = !signedIn && trimmed.length >= USER_SEARCH_MIN_LENGTH;
  const showResults = signedIn && trimmed.length >= USER_SEARCH_MIN_LENGTH;

  return (
    <Box sx={{ gap: 2 }}>
      <TextInput
        label={<Trans>Search</Trans>}
        value={query}
        onChangeText={setQuery}
        placeholder={t`Search by username or name`}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
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
      {showResults
        ? results.map((user) => (
            <SearchUserResultRow key={user.userId} user={user} />
          ))
        : null}
    </Box>
  );
}

export type SearchScreenProps = {
  readonly accountMenu?: ReactNode;
  readonly leading?: ReactNode;
};

export function SearchScreen({
  accountMenu,
  leading,
}: SearchScreenProps): ReactNode {
  const { t } = useLingui();

  return (
    <ScreenBase
      screenId="search"
      breadcrumbs={[{ name: t`Search` }]}
      accountMenu={accountMenu}
      leading={leading}
      content={({ sx }) => (
        <Box style={sx}>
          <SearchScreenBody />
        </Box>
      )}
    />
  );
}
