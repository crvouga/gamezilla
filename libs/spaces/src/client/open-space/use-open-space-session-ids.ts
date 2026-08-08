import { useDeviceId } from '@libs/auth/client/use-device-id';
import { type Sql, sql } from '@pkgs/sql';
import { useQuery, useSyncEngine } from '@pkgs/sync-engine/client';
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
  const localDeviceId = useDeviceId();
  const query = useMemo(
    () =>
      paintReady
        ? sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions
            WHERE _deleted_at IS NULL AND device_id = ${localDeviceId}
            ORDER BY opened_at DESC
          `
        : sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions WHERE false
          `,
    [paintReady, localDeviceId]
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
  const localDeviceId = useDeviceId();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () =>
      enabled
        ? sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions
            WHERE space_id = ${spaceId}
              AND device_id = ${localDeviceId}
              AND _deleted_at IS NULL
            LIMIT 1
          `
        : sql<SessionIdRow>`
            SELECT space_id FROM space_open_sessions WHERE false
          `,
    [enabled, spaceId, localDeviceId]
  );
  const { rows } = useQuery(query);
  const row = rows[0] ?? null;
  return row !== null;
}

/** Open-session fields for join announce (room clientId is per-tab in-memory). */
export function useSpaceOpenSession(spaceId: string): {
  readonly joinAnnounced: boolean;
  readonly isOpen: boolean;
  readonly isLoading: boolean;
} {
  const { paintReady } = useSyncEngine();
  const localDeviceId = useDeviceId();
  const enabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    (): Sql<SessionRow> =>
      enabled
        ? sql<SessionRow>`
            SELECT space_id, device_id, join_announced
            FROM space_open_sessions
            WHERE space_id = ${spaceId}
              AND device_id = ${localDeviceId}
              AND _deleted_at IS NULL
            LIMIT 1
          `
        : sql<SessionRow>`
            SELECT space_id, device_id, join_announced
            FROM space_open_sessions WHERE false
          `,
    [enabled, spaceId, localDeviceId]
  );
  const { rows, isLoading } = useQuery(query);
  const row = rows[0] ?? null;
  if (!paintReady) {
    return {
      joinAnnounced: false,
      isOpen: false,
      isLoading: true,
    };
  }
  return {
    joinAnnounced: row?.join_announced === 1,
    isOpen: row !== null,
    isLoading,
  };
}
