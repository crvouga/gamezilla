import {
  Box,
  ScreenBase,
  Text,
  TextInput,
  useBreakpoint,
  type ScreenBaseAction,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState, type ReactNode } from 'react';

import { SearchRecentQueries } from './search-recent-queries';
import {
  SearchQueryHint,
  SearchSignInPrompt,
  useDebouncedUserSearchEffect,
} from './use-user-search';
import { SearchUserResultRow } from './search-user-result-row';
import { useSearchHistory } from './use-search-history';
import { SEARCH_MIN_LENGTH } from '../shared/search-types';

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
  const showSignInPrompt = !signedIn && trimmed.length >= SEARCH_MIN_LENGTH;
  const showResults = signedIn && trimmed.length >= SEARCH_MIN_LENGTH;

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
      <SearchQueryHint query={query} signedIn={signedIn} />
      {showSignInPrompt ? <SearchSignInPrompt /> : null}
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
  readonly accountActions: readonly ScreenBaseAction[];
  readonly centerTabs?: ReactNode;
  readonly headerEnd?: ReactNode;
  readonly leading?: ReactNode;
};

export function SearchScreen({
  accountActions,
  centerTabs,
  headerEnd,
  leading,
}: SearchScreenProps): ReactNode {
  const { t } = useLingui();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: t`Search` }]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
      leading={leading}
      content={({ sx }) => (
        <Box style={sx}>
          <SearchScreenBody />
        </Box>
      )}
    />
  );
}
