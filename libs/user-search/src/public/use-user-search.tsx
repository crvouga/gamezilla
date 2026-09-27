import { useMyId } from '@libs/auth/public/use-current-user';
import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useCan, useDecision } from '@libs/permissions/public/use-can';
import { Handles } from '@libs/test-ids';
import { useTimers } from '@pkgs/clock/solid';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';
import {
  createQuery,
  useSyncEngine,
  useSyncEngineInstance,
} from '@pkgs/sync-engine/solid';
import { UsersIcon } from '@pkgs/ui';
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

export function useDebouncedUserSearchEffect(
  query: Accessor<string>,
  onCompleted?: (query: string) => void
) {
  const canSearch = useCan(PERMISSION.peopleSearch);
  const myId = useMyId();
  const timers = useTimers();
  const sync = useSyncEngineInstance();
  const engine = useSyncEngine();
  const [debouncedQuery, setDebouncedQuery] = createSignal('');
  const [awaitingSync, setAwaitingSync] = createSignal(false);

  createEffect(() => {
    const trimmed = query().trim();
    if (!canSearch() || trimmed.length === 0) {
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
    const initialQuery = debouncedQuery();
    if (!canSearch() || initialQuery.length === 0) {
      setAwaitingSync(false);
      return;
    }

    let cancelled = false;
    setAwaitingSync(true);
    const sub = sync.subscribeQuery('searchProfiles', {
      query: initialQuery,
    });
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

  const { rows } = createQuery(() => searchHitsSql(myId(), debouncedQuery()));
  const results = createMemo(() =>
    rows()
      .filter((row) => row.id.length > 0)
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
      // Offline the server cannot answer: not "Searching…" forever.
      return awaitingSync() && online();
    },
    /** The search went out offline and is waiting on a server it cannot reach. */
    get needsConnection() {
      return canSearch() && awaitingSync() && !online();
    },
    get canSearch() {
      return canSearch();
    },
  };
}

/** What a caller who may not search people sees instead of results. */
export function UserSearchDenied(): JSX.Element {
  const decision = useDecision(PERMISSION.peopleSearch);
  return (
    <DenialSurface
      decision={decision()}
      icon={UsersIcon}
      variant="compact"
      testId={Handles.searchDenied}
    />
  );
}
