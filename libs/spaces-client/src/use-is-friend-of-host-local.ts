import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

type IdLike = string | null | Accessor<string | null>;

function readId(id: IdLike): string | null {
  return typeof id === 'function' ? id() : id;
}

/** True when the viewer is friends with the space host on local SQLite. */
export function useIsFriendOfHostLocal(
  hostAccountId: IdLike,
  hostMemberId: IdLike,
  viewerAccountId: IdLike
): Accessor<boolean> {
  const enabled = createMemo(() => {
    const viewer = readId(viewerAccountId);
    const hostAccount = readId(hostAccountId);
    const hostMember = readId(hostMemberId);
    return (
      viewer !== null &&
      viewer.length > 0 &&
      ((hostAccount ?? '').length > 0 || (hostMember ?? '').length > 0)
    );
  });
  const query = createQuery(() => {
    const viewer = readId(viewerAccountId) ?? '';
    const hostAccount = readId(hostAccountId) ?? '';
    const hostMember = readId(hostMemberId) ?? '';
    return sql<{ readonly id: string }>`
      SELECT id
      FROM friends_friendships
      WHERE ${enabled()}
        AND deleted_at IS NULL
        AND (
          (
            user_low = ${viewer}
            AND (
              user_high = ${hostAccount}
              OR user_high = ${hostMember}
            )
          )
          OR (
            user_high = ${viewer}
            AND (
              user_low = ${hostAccount}
              OR user_low = ${hostMember}
            )
          )
        )
      LIMIT 1
    `;
  });
  return createMemo(() => enabled() && query.rows().length > 0);
}
