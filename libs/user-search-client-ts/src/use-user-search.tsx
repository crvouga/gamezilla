import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { displayUsername } from '@libs/moderation-shared-ts/display';
import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import {
  DenialSurfaceView,
  type DenialView,
} from '@libs/permissions-client-ts/denial-surface-view';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import {
  USER_SEARCH_DEBOUNCE_MS,
  USER_SEARCH_MAX_RESULTS,
} from '@libs/user-search-shared-ts/user-search-types';
import { usernamePrefix } from '@libs/user-search-shared-ts/username-prefix';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  untrack,
} from 'solid-js';

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
  const likeQuery = usernamePrefix(query);
  return sql<SearchHitRow>`
    SELECT
      p.id,
      p.username,
      p.avatar_config
    FROM profile AS p
    WHERE p.id <> ${myId}
      AND p.deleted_at IS NULL
      AND p.username_norm <> ''
      AND p.username_norm LIKE ${likeQuery} ESCAPE '!'
      AND NOT EXISTS (
        -- Someone who blocked me cannot be found by me. Someone I blocked
        -- still can: their row is where I unblock them (there is no other).
        SELECT 1
        FROM friends_blocks AS b
        WHERE b.deleted_at IS NULL
          AND b.blocker_id = p.id
          AND b.blocked_id = ${myId}
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

function useDebouncedSearchQuery(
  query: Accessor<string>,
  canSearch: Accessor<boolean>,
  setAwaitingSync: (value: boolean) => void
): Accessor<string> {
  const timers = useTimers();
  const [debouncedQuery, setDebouncedQuery] = createSignal('');
  // What is searched for. A space after the name (a phone's keyboard adds one
  // with every suggestion it completes) is the same search, not a new one.
  const wanted = createMemo(() => query().trim());
  createEffect(() => {
    const trimmed = wanted();
    if (!canSearch() || trimmed.length === 0) {
      setDebouncedQuery('');
      setAwaitingSync(false);
      return;
    }

    const handle = timers.setTimeout(() => {
      // The in-flight flag lands with the query. A render in between would
      // show the previous person, or nobody, before this search is sent.
      // Only a search that goes out is awaited. Typing on and back to the
      // name already being searched sends nothing, so nothing would ever
      // answer it and the screen would say "Searching…" for good.
      if (untrack(debouncedQuery) === trimmed) return;
      batch(() => {
        setDebouncedQuery(trimmed);
        setAwaitingSync(true);
      });
    }, USER_SEARCH_DEBOUNCE_MS);

    onCleanup(() => {
      timers.clearTimeout(handle);
    });
  });

  return debouncedQuery;
}

export function useDebouncedUserSearchEffect(
  query: Accessor<string>,
  onCompleted?: (query: string) => void
) {
  const canSearch = useCan(PERMISSION.peopleSearch);
  const myId = useMyId();
  const sync = useSyncEngineInstance();
  const engine = useSyncEngine();
  const moderation = useModeration();
  const [awaitingSync, setAwaitingSync] = createSignal(false);
  const [rateLimited, setRateLimited] = createSignal(false);
  const debouncedQuery = useDebouncedSearchQuery(
    query,
    canSearch,
    setAwaitingSync
  );

  createEffect(() => {
    const initialQuery = debouncedQuery();
    setRateLimited(false);
    if (!canSearch() || initialQuery.length === 0) {
      setAwaitingSync(false);
      return;
    }

    let cancelled = false;
    setAwaitingSync(true);
    const sub = sync.subscribeQuery(
      'searchProfiles',
      {
        query: initialQuery,
      },
      {
        onQueryNotice: (notice) => {
          if (!cancelled)
            setRateLimited(notice?.code === 'people_search_rate_limited');
        },
      }
    );
    void sub.waitForFirstSync().then(() => {
      if (cancelled) return;
      setAwaitingSync(false);
      onCompleted?.(initialQuery);
    });

    onCleanup(() => {
      cancelled = true;
      sub.unsubscribe();
    });
  });

  const local = createQuery(() => searchHitsSql(myId(), debouncedQuery()));
  const rows = local.rows;
  // A username that is no longer allowed is never found: the person is not
  // searchable by it, on any device, the moment the team stops allowing it.
  const results = createMemo(() =>
    rows()
      .filter((row) => row.id.length > 0)
      .filter(
        (row) => !displayUsername(moderation(), row.username, row.id).masked
      )
      .map(mapSearchHit)
  );

  const online = createMemo(() => engine.status().online);

  return {
    get results() {
      return results();
    },
    get searching() {
      const trimmed = query().trim();
      if (!canSearch() || trimmed.length === 0) return false;
      if (trimmed !== debouncedQuery()) return true;
      // The people already on this device are part of every answer.
      if (local.isLoading()) return true;
      // Offline the server cannot answer: not "Searching…" forever.
      return awaitingSync() && online() && !rateLimited();
    },
    /**
     * The search went out offline and is waiting on a server it cannot
     * reach. Results shown meanwhile are only the people already on this
     * device.
     */
    get rateLimited() {
      return rateLimited();
    },
    get needsConnection() {
      return canSearch() && awaitingSync() && !online();
    },
    /**
     * The sync engine reported why the server could not answer this search
     * (as opposed to the device simply being offline).
     */
    get failed() {
      const error = engine.status().lastError;
      return (
        canSearch() && awaitingSync() && error !== null && error.length > 0
      );
    },
    get canSearch() {
      return canSearch();
    },
  };
}

/** What a caller who may not search people is told, as plain view data. */
export function useUserSearchDenial(): Accessor<DenialView> {
  const decision = useDecision(PERMISSION.peopleSearch);
  return useDenialView({
    get decision() {
      return decision();
    },
    icon: UsersIcon,
    testId: Handles.searchDenied,
  });
}

/** What a caller who may not search people sees instead of results. */
export function UserSearchDenied(): JSX.Element {
  const denial = useUserSearchDenial();
  return <DenialSurfaceView denial={denial()} variant="compact" />;
}
