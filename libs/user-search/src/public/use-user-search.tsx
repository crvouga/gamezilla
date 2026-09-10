import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import { EmptyState, UsersIcon } from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { UserSearchClient } from './search-users';
import { useUserSearchClientDeps } from './use-user-search-deps';
import {
  USER_SEARCH_MIN_LENGTH,
  type UserSearchResult,
} from './user-search-types';

export function useDebouncedUserSearchEffect(
  query: Accessor<string>,
  onCompleted?: (query: string) => void
) {
  const signedIn = useIsSignedIn();
  const deps = useUserSearchClientDeps();
  const timers = useTimers();
  const [results, setResults] = createSignal<readonly UserSearchResult[]>([]);
  const [searching, setSearching] = createSignal(false);
  const client = new UserSearchClient(deps);

  createEffect(() => {
    const trimmed = query().trim();
    if (!signedIn() || trimmed.length < USER_SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const handle = timers.setTimeout(() => {
      setSearching(true);
      void client
        .search(trimmed)
        .then((next) => {
          if (cancelled) return;
          setResults(next);
          onCompleted?.(trimmed);
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

    onCleanup(() => {
      cancelled = true;
      timers.clearTimeout(handle);
      setSearching(false);
    });
  });

  return {
    get results() {
      return results();
    },
    get searching() {
      return searching();
    },
    get signedIn() {
      return signedIn();
    },
  };
}

export function UserSearchSignInPrompt(): JSX.Element {
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  return (
    <EmptyState
      variant="compact"
      icon={UsersIcon}
      title={<Trans>Sign in to search for people</Trans>}
      body={<Trans>Find friends by username and send requests.</Trans>}
      action={{ label: t`Sign in`, onClick: openSignInModal }}
    />
  );
}

export function UserSearchQueryHint(props: {
  query: string;
  signedIn: boolean;
}): JSX.Element {
  const trimmed = () => props.query.trim();

  return (
    <Show
      when={
        props.signedIn &&
        trimmed().length > 0 &&
        trimmed().length < USER_SEARCH_MIN_LENGTH
      }
    >
      <p class="text textCaption px-1">
        {
          <Trans>
            Keep typing — at least {USER_SEARCH_MIN_LENGTH} characters
          </Trans>
        }
      </p>
    </Show>
  );
}
