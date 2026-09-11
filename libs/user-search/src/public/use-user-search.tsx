import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';
import { createQuery, useSyncEngineInstance } from '@pkgs/sync-engine/solid';
import { EmptyState, UsersIcon } from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';
import {
  USER_SEARCH_MAX_RESULTS,
  type UserSearchResult,
} from './user-search-types';

type SearchHitRow = {
  readonly id: string;
  readonly username: string;
  readonly avatar_config: string | null;
};

function emptySearchSql(): Sql<SearchHitRow> {
  return sql<SearchHitRow>`
    SELECT
      CAST(NULL AS TEXT) AS id,
      CAST(NULL AS TEXT) AS username,
      CAST(NULL AS TEXT) AS avatar_config
    WHERE false
  `;
}

function searchHitsSql(myId: string, query: string): Sql<SearchHitRow> {
  if (myId.length === 0 || query.length === 0) {
    return emptySearchSql();
  }
  const likeQuery = `${query.toLowerCase()}%`;
  return sql<SearchHitRow>`
    SELECT
      p.id,
      p.username,
      p.avatar_config
    FROM profile AS p
    WHERE p.id <> ${myId}
      AND p.deleted_at IS NULL
      AND p.username_norm <> ''
      AND p.username_norm LIKE ${likeQuery}
      AND NOT EXISTS (
        SELECT 1
        FROM friends_blocks AS b
        WHERE b.deleted_at IS NULL
          AND (
            (b.blocker_id = ${myId} AND b.blocked_id = p.id)
            OR (b.blocker_id = p.id AND b.blocked_id = ${myId})
          )
      )
    ORDER BY p.username_norm ASC
    LIMIT ${USER_SEARCH_MAX_RESULTS}
  `;
}

function mapSearchHit(row: SearchHitRow): UserSearchResult {
  return {
    userId: row.id,
    username: row.username,
    avatarConfig: row.avatar_config,
  };
}

export function useDebouncedUserSearchEffect(
  query: Accessor<string>,
  onCompleted?: (query: string) => void
) {
  const signedIn = useIsSignedIn();
  const myId = useMyId();
  const timers = useTimers();
  const sync = useSyncEngineInstance();
  const [debouncedQuery, setDebouncedQuery] = createSignal('');
  const [awaitingSync, setAwaitingSync] = createSignal(false);

  createEffect(() => {
    const trimmed = query().trim();
    if (!signedIn() || trimmed.length === 0) {
      setDebouncedQuery('');
      setAwaitingSync(false);
      return;
    }

    const handle = timers.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 300);

    onCleanup(() => {
      timers.clearTimeout(handle);
    });
  });

  createEffect(() => {
    const q = debouncedQuery();
    if (!signedIn() || q.length === 0) {
      setAwaitingSync(false);
      return;
    }

    let cancelled = false;
    setAwaitingSync(true);
    const sub = sync.subscribeQuery('searchProfiles', { query: q });
    void sub.waitForFirstSync().then(() => {
      if (cancelled) return;
      setAwaitingSync(false);
      onCompleted?.(q);
    });

    onCleanup(() => {
      cancelled = true;
      sub.unsubscribe();
    });
  });

  const { rows } = createQuery(() => searchHitsSql(myId(), debouncedQuery()));
  const results = createMemo(() =>
    rows()
      .filter((row) => row.id.length > 0)
      .map(mapSearchHit)
  );

  return {
    get results() {
      return results();
    },
    get searching() {
      const trimmed = query().trim();
      if (!signedIn() || trimmed.length === 0) return false;
      return trimmed !== debouncedQuery() || awaitingSync();
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
