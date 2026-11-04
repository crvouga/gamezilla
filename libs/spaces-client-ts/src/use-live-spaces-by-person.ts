import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import type { FriendLiveSpace } from './use-friend-live-space';

type LiveHostRow = {
  readonly id: string;
  readonly host_account_id: string | null;
  readonly host_member_id: string | null;
};

type LiveSeatRow = {
  readonly space_id: string;
  readonly user_id: string;
};

/**
 * Everyone this device knows to be in a live space, by their id: the space
 * they host (newest first), else one they are seated in. One read for a
 * whole list of people, where {@link useFriendLiveSpace} reads one.
 */
export function useLiveSpacesByPerson(): Accessor<
  ReadonlyMap<string, FriendLiveSpace>
> {
  const hosts = createQuery(
    () => sql<LiveHostRow>`
      SELECT id, host_account_id, host_member_id
      FROM spaces
      WHERE ended_at IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC
    `
  );
  const seats = createQuery(
    () => sql<LiveSeatRow>`
      SELECT space_id, user_id
      FROM spaces_users
      WHERE deleted_at IS NULL
        AND joined = ${true}
        AND space_id IN (
          SELECT id FROM spaces WHERE ended_at IS NULL AND deleted_at IS NULL
        )
    `
  );
  return createMemo(() => {
    const byPerson = new Map<string, FriendLiveSpace>();
    for (const row of hosts.rows()) {
      for (const id of [row.host_account_id, row.host_member_id]) {
        if (id !== null && !byPerson.has(id)) {
          byPerson.set(id, { spaceId: row.id, hosting: true });
        }
      }
    }
    for (const row of seats.rows()) {
      if (!byPerson.has(row.user_id)) {
        byPerson.set(row.user_id, { spaceId: row.space_id, hosting: false });
      }
    }
    return byPerson;
  });
}
