import { sql } from '@pkgs/sql';
import {
  useWatchOne,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useMemo } from 'react';

type SessionIdRow = {
  readonly id: string;
};

type SessionRow = {
  readonly id: string;
  readonly client_id: string | null;
  readonly join_announced: number | null;
};

const EMPTY_IDS: readonly string[] = [];

/**
 * Space ids with a local open-session row (newest first).
 * Source of truth for miniplayer + room host lifetime.
 */
export function useOpenSpaceSessionIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const paintReady = useSyncEnginePaintReady();
  const query = useMemo(
    () =>
      paintReady
        ? sql<SessionIdRow>`
            SELECT id FROM local_space_open_sessions
            ORDER BY opened_at DESC
          `
        : sql<SessionIdRow>`
            SELECT id FROM local_space_open_sessions WHERE false
          `,
    [paintReady]
  );
  const { rows, isLoading } = useWatchQuery(query);
  if (!paintReady) {
    return { spaceIds: EMPTY_IDS, isLoading: true };
  }
  return {
    spaceIds: rows.map((row) => row.id),
    isLoading,
  };
}

/** Whether this install currently has `spaceId` open locally. */
export function useIsSpaceOpenLocally(spaceId: string): boolean {
  const paintReady = useSyncEnginePaintReady();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () =>
      enabled
        ? sql<SessionIdRow>`
            SELECT id FROM local_space_open_sessions
            WHERE id = ${spaceId} LIMIT 1
          `
        : sql<SessionIdRow>`
            SELECT id FROM local_space_open_sessions WHERE false
          `,
    [enabled, spaceId]
  );
  const { row } = useWatchOne(query);
  return row !== null;
}

/** Local open-session fields for room clientId / join announce. */
export function useSpaceOpenSession(spaceId: string): {
  readonly clientId: string | null;
  readonly joinAnnounced: boolean;
  readonly isOpen: boolean;
  readonly isLoading: boolean;
} {
  const paintReady = useSyncEnginePaintReady();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () =>
      enabled
        ? sql<SessionRow>`
            SELECT id, client_id, join_announced
            FROM local_space_open_sessions
            WHERE id = ${spaceId} LIMIT 1
          `
        : sql<SessionRow>`
            SELECT id, client_id, join_announced
            FROM local_space_open_sessions WHERE false
          `,
    [enabled, spaceId]
  );
  const { row, isLoading } = useWatchOne(query);
  if (!paintReady) {
    return {
      clientId: null,
      joinAnnounced: false,
      isOpen: false,
      isLoading: true,
    };
  }
  return {
    clientId: row?.client_id ?? null,
    joinAnnounced: row?.join_announced === 1,
    isOpen: row !== null,
    isLoading,
  };
}
