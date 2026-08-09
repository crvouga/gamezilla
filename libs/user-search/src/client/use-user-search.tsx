import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { Box, Button, Text } from '@pkgs/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  USER_SEARCH_MIN_LENGTH,
  type UserSearchResult,
} from '../shared/user-search-types';
import { searchUsers } from './search-users';
import { useUserSearchClientDeps } from './use-user-search-deps';

export function useDebouncedUserSearchEffect(
  query: string,
  onCompleted?: (query: string) => void
) {
  const signedIn = useIsSignedIn();
  const deps = useUserSearchClientDeps();
  const timers = useTimers();
  const [results, setResults] = useState<readonly UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    const trimmed = query.trim();
    if (!signedIn || trimmed.length < USER_SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const handle = timers.setTimeout(() => {
      void searchUsers(deps, trimmed)
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
      timers.clearTimeout(handle);
    };
  }, [deps, query, signedIn, timers]);

  return { results, searching, signedIn };
}

export function UserSearchSignInPrompt(): ReactNode {
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  return (
    <Box sx={{ gap: 2, py: 2, alignItems: 'center' }}>
      <Text variant="body" label={t`Sign in to search for people`} />
      <Button title={t`Sign in`} onPress={openSignInModal} />
    </Box>
  );
}

export function UserSearchQueryHint({
  query,
  signedIn,
}: {
  query: string;
  signedIn: boolean;
}): ReactNode {
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length >= USER_SEARCH_MIN_LENGTH) {
    return null;
  }
  if (!signedIn) return null;

  return (
    <Text
      variant="caption"
      label={<Trans>Enter at least {USER_SEARCH_MIN_LENGTH} characters</Trans>}
    />
  );
}
