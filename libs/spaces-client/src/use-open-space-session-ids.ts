import { useDeviceId } from '@libs/auth-client/use-device-id';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

type SessionIdRow = {
  readonly space_id: string;
};

type SessionRow = {
  readonly space_id: string;
  readonly device_id: string | null;
  readonly join_announced: number | boolean | null;
};

const EMPTY_IDS: readonly string[] = [];

function readSpaceId(spaceId: string | Accessor<string>): string {
  return typeof spaceId === 'string' ? spaceId : spaceId();
}

/**
 * Space ids with an open-session row for this install (newest first).
 * Source of truth for miniplayer + room host lifetime.
 */
export function useOpenSpaceSessionIds(): {
  readonly spaceIds: Accessor<readonly string[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const { paintReady } = useSyncEngine();
  const localDeviceId = useDeviceId();
  const query = createQuery(() =>
    paintReady()
      ? sql<SessionIdRow>`
          SELECT space_id FROM spaces_open_sessions
          WHERE deleted_at IS NULL AND device_id = ${localDeviceId()}
          ORDER BY opened_at DESC
        `
      : sql<SessionIdRow>`
          SELECT space_id FROM spaces_open_sessions WHERE false
        `
  );
  const spaceIds = createMemo(() =>
    paintReady() ? query.rows().map((row) => row.space_id) : EMPTY_IDS
  );
  const loading = createMemo(() => (paintReady() ? query.isLoading() : true));
  return { spaceIds, isLoading: loading };
}

/** Whether this install currently has `spaceId` open. */
export function useIsSpaceOpenLocally(
  spaceId: string | Accessor<string>
): Accessor<boolean> {
  const { paintReady } = useSyncEngine();
  const localDeviceId = useDeviceId();
  const enabled = createMemo(
    () => paintReady() && readSpaceId(spaceId).length > 0
  );
  const query = createQuery(() =>
    enabled()
      ? sql<SessionIdRow>`
          SELECT space_id FROM spaces_open_sessions
          WHERE space_id = ${readSpaceId(spaceId)}
            AND device_id = ${localDeviceId()}
            AND deleted_at IS NULL
          LIMIT 1
        `
      : sql<SessionIdRow>`
          SELECT space_id FROM spaces_open_sessions WHERE false
        `
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => row() !== null);
}

/** Open-session fields for join announce (room clientId is per-tab in-memory). */
export function useSpaceOpenSession(spaceId: string | Accessor<string>): {
  readonly joinAnnounced: Accessor<boolean>;
  readonly isOpen: Accessor<boolean>;
  readonly isLoading: Accessor<boolean>;
} {
  const { paintReady } = useSyncEngine();
  const localDeviceId = useDeviceId();
  const enabled = createMemo(
    () => paintReady() && readSpaceId(spaceId).length > 0
  );
  const query = createQuery(
    (): Sql<SessionRow> =>
      enabled()
        ? sql<SessionRow>`
          SELECT space_id, device_id, join_announced
          FROM spaces_open_sessions
          WHERE space_id = ${readSpaceId(spaceId)}
            AND device_id = ${localDeviceId()}
            AND deleted_at IS NULL
          LIMIT 1
        `
        : sql<SessionRow>`
          SELECT space_id, device_id, join_announced
          FROM spaces_open_sessions WHERE false
        `
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  return {
    joinAnnounced: createMemo(
      () => paintReady() && Boolean(row()?.join_announced)
    ),
    isOpen: createMemo(() => paintReady() && row() !== null),
    isLoading: createMemo(() => (paintReady() ? query.isLoading() : true)),
  };
}
