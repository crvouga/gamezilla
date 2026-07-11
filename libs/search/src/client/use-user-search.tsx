import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { useFriendsClientDeps } from '@libs/friends/client/use-friends-client-deps';
import type { UserSearchResult } from '@libs/friends/shared/friends-types';
import { Box, Button, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { searchForUsers } from './search-users';
import { SEARCH_MIN_LENGTH } from '../shared/search-types';

export function useDebouncedUserSearchEffect(
  query: string,
  onCompleted?: (query: string) => void
) {
  const signedIn = useIsSignedIn();
  const deps = useFriendsClientDeps();
  const [results, setResults] = useState<readonly UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    const trimmed = query.trim();
    if (!signedIn || trimmed.length < SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(() => {
      void searchForUsers(deps, trimmed)
        .then((next) => {
          if (cancelled) return;
          setResults(next);
          onCompletedRef.current?.(trimmed);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [deps, query, signedIn]);

  return { results, searching, signedIn };
}

export function SearchSignInPrompt(): ReactNode {
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  return (
    <Box sx={{ gap: 2, py: 2, alignItems: 'center' }}>
      <Text variant="body" label={t`Sign in to search for people`} />
      <Button title={t`Sign in`} onPress={openSignInModal} />
    </Box>
  );
}

export function SearchQueryHint({
  query,
  signedIn,
}: {
  query: string;
  signedIn: boolean;
}): ReactNode {
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length >= SEARCH_MIN_LENGTH) {
    return null;
  }
  if (!signedIn) return null;

  return (
    <Text
      variant="caption"
      label={<Trans>Enter at least {SEARCH_MIN_LENGTH} characters</Trans>}
    />
  );
}
