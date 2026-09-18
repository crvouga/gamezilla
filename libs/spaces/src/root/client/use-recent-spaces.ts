import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

type RecentSpaceRow = {
  readonly id: string;
};

/**
 * Ended spaces the actor hosts or belonged to — the "return to my spaces"
 * history. Live spaces are listed by {@link useJoinableLiveSpaceIds}.
 */
export function useRecentSpaces(): {
  readonly spaceIds: Accessor<readonly string[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const memberId = useMyId();
  const enabled = createMemo(() => memberId().length > 0);
  const query = createQuery(() =>
    enabled()
      ? sql<RecentSpaceRow>`
          SELECT s.id
          FROM spaces AS s
          WHERE s.ended_at IS NOT NULL
            AND (
              s.host_member_id = ${memberId()}
              OR s.host_account_id = ${memberId()}
              OR s.id IN (
                SELECT su.space_id FROM spaces_users AS su
                WHERE su.user_id = ${memberId()}
              )
            )
          ORDER BY s.ended_at DESC
          LIMIT 20
        `
      : sql<RecentSpaceRow>`SELECT id FROM spaces WHERE false`
  );
  const spaceIds = createMemo(() =>
    enabled() ? query.rows().map((r) => r.id) : []
  );
  const isLoading = createMemo(() => enabled() && query.isLoading());
  return { spaceIds, isLoading };
}
