import { useMyId } from '@libs/auth/public/use-current-user';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createEffect } from 'solid-js';

import { shouldReopenLostHostSession } from '../../public/reopen-lost-host-session';
import { useSpacePresence } from '../../public/use-space-presence';
import { isViewerSpaceHost } from '../../shared/space/resolve-space-presence';
import { useJoinSpace } from '../../use-cases/join-space/client/use-join-space';

type SessionRow = { readonly deleted_at: string | null };
type HostRow = {
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly deleted_at: string | null;
};

function sessionTombstone(
  rows: readonly SessionRow[]
): string | null | undefined {
  const row = rows[0];
  if (row === undefined) return undefined;
  return row.deleted_at;
}

/**
 * Re-enter a live space this device was already in. Leaving ends a space, so
 * a tombstoned session on a live space is the device losing it.
 */
export function useReopenLostHostSession(spaceId: Accessor<string>): void {
  const presence = useSpacePresence(spaceId);
  const myId = useMyId();
  const deviceId = useDeviceId();
  const joinSpace = useJoinSpace();
  let attemptedId = '';
  const session = createQuery(
    () => sql<SessionRow>`
      SELECT deleted_at FROM spaces_open_sessions
      WHERE space_id = ${spaceId()} AND device_id = ${deviceId()}
      LIMIT 1
    `
  );
  const host = createQuery(
    () => sql<HostRow>`
      SELECT host_member_id, host_account_id, ended_at, deleted_at
      FROM spaces WHERE id = ${spaceId()}
      LIMIT 1
    `
  );

  createEffect(() => {
    const id = spaceId();
    if (attemptedId === id) return;
    const current = presence();
    if (current.status !== 'join' || current.ended) return;
    const space = host.rows()[0];
    if (space === undefined || space.deleted_at !== null) return;
    if (
      !shouldReopenLostHostSession({
        isHost: isViewerSpaceHost(space, myId()),
        sessionDeletedAt: sessionTombstone(session.rows()),
      })
    ) {
      return;
    }
    attemptedId = id;
    void joinSpace(id).catch(() => undefined);
  });
}
