import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { EmptyState, Text, UsersIcon } from '@pkgs/ui-rn';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { UserSearchClient } from './search-users';
import { useUserSearchClientDeps } from './use-user-search-deps';
import {
  USER_SEARCH_MIN_LENGTH,
  type UserSearchResult,
} from './user-search-types';

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
  // Keep the client out of the effect deps — a new `auth` / `fetch` identity
  // every render would reset the debounce forever and leave `searching` stuck.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const trimmed = query.trim();
    if (!signedIn || trimmed.length < USER_SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const handle = timers.setTimeout(() => {
      setSearching(true);
      void new UserSearchClient(depsRef.current)
        .search(trimmed)
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
      setSearching(false);
    };
  }, [query, signedIn, timers]);

  return { results, searching, signedIn };
}

export function UserSearchSignInPrompt(): ReactNode {
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  return (
    <EmptyState
      variant="compact"
      icon={UsersIcon}
      title={<Trans>Sign in to search for people</Trans>}
      body={<Trans>Find friends by username and send requests.</Trans>}
      action={{ label: t`Sign in`, onPress: openSignInModal }}
    />
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
      sx={{ px: 1 }}
      label={
        <Trans>
          Keep typing — at least {USER_SEARCH_MIN_LENGTH} characters
        </Trans>
      }
    />
  );
}
