import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { shouldEnterOwnLiveSpace } from '@libs/spaces-shared-ts/reopen-lost-host-session';
import { isViewerSpaceHost } from '@libs/spaces-shared-ts/resolve-space-presence';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createEffect, createMemo } from 'solid-js';
import { useSpacePresence } from './public-use-space-presence';
import { useJoinSpace } from './use-join-space';

type HostRow = {
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly deleted_at: string | null;
};

/**
 * Take a host into their own live space. End is only on the open space, and
 * a fresh device otherwise sits on Join until a button press that may never
 * finish. Leaving ends a space, so a live space is not a step-out.
 */
export function useReopenLostHostSession(spaceId: Accessor<string>): void {
  const presence = useSpacePresence(spaceId);
  const myId = useMyId();
  const joinSpace = useJoinSpace();
  let attemptedId = '';
  const host = createQuery(
    () => sql<HostRow>`
      SELECT host_member_id, host_account_id, ended_at, deleted_at
      FROM spaces WHERE id = ${spaceId()}
      LIMIT 1
    `
  );

  const standing = createMemo((): 'active' | 'enter' | 'wait' => {
    const current = presence();
    if (current.status === 'active') return 'active';
    if (current.status !== 'join' || current.ended) return 'wait';
    const space = host.rows()[0];
    if (space === undefined || space.deleted_at !== null) return 'wait';
    const enter = shouldEnterOwnLiveSpace({
      isHost: isViewerSpaceHost(space, myId()),
      spaceEnded: space.ended_at !== null,
    });
    return enter ? 'enter' : 'wait';
  });

  createEffect(
    () => ({ id: spaceId(), standing: standing() }),
    (now) => {
      if (now.standing === 'active') {
        attemptedId = '';
        return;
      }
      if (now.standing !== 'enter' || attemptedId === now.id) return;
      attemptedId = now.id;
      void joinSpace(now.id).catch(() => undefined);
    }
  );
}
