import { type Sql, sql } from '@pkgs/sql';
import {
  useQuery,
  useSyncEngine,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

type SessionIdRow = {
  readonly space_id: string;
};

type SessionRow = {
  readonly space_id: string;
  readonly device_id: string | null;
  readonly join_announced: number | null;
};

const EMPTY_IDS: readonly string[] = [];

/**
 * Space ids with an open-session row for this install (newest first).
 * Source of truth for miniplayer + room host lifetime.
 */
export function useOpenSpaceSessionIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { paintReady } = useSyncEngine();
  const query = useMemo(
    () =>
      paintReady
        ? sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions
            ORDER BY opened_at DESC
          `
        : sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions WHERE false
          `,
    [paintReady]
  );
  const { rows, isLoading } = useQuery(query);
  if (!paintReady) {
    return { spaceIds: EMPTY_IDS, isLoading: true };
  }
  return {
    spaceIds: rows.map((row) => row.space_id),
    isLoading,
  };
}

/** Whether this install currently has `spaceId` open. */
export function useIsSpaceOpenLocally(spaceId: string): boolean {
  const { paintReady } = useSyncEngine();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () =>
      enabled
        ? sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions
            WHERE space_id = ${spaceId} LIMIT 1
          `
        : sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions WHERE false
          `,
    [enabled, spaceId]
  );
  const { rows } = useQuery(query);
  const row = rows[0] ?? null;
  return row !== null;
}

/** Open-session fields for room clientId / join announce. */
export function useSpaceOpenSession(spaceId: string): {
  readonly clientId: string | null;
  readonly joinAnnounced: boolean;
  readonly isOpen: boolean;
  readonly isLoading: boolean;
} {
  const { paintReady } = useSyncEngine();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    (): Sql<SessionRow> =>
      enabled
        ? sql<SessionRow>`
            SELECT space_id, device_id, join_announced
            FROM space_open_sessions
            WHERE space_id = ${spaceId} LIMIT 1
          `
        : sql<SessionRow>`
            SELECT space_id, device_id, join_announced
            FROM space_open_sessions WHERE false
          `,
    [enabled, spaceId]
  );
  const { rows, isLoading } = useQuery(query);
  const row = rows[0] ?? null;
  if (!paintReady) {
    return {
      clientId: null,
      joinAnnounced: false,
      isOpen: false,
      isLoading: true,
    };
  }
  return {
    clientId: row?.device_id ?? null,
    joinAnnounced: row?.join_announced === 1,
    isOpen: row !== null,
    isLoading,
  };
}
