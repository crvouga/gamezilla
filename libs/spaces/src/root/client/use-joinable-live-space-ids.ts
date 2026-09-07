import { useMyId } from '@libs/auth/public/use-current-user';
import { createQuery } from '@pkgs/sync-engine/solid';
import { createMemo } from 'solid-js';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

/** Live spaces the viewer can join: host, spaces_users ACL, or a friend's live space. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const memberId = useMyId();
  const enabled = createMemo(() => memberId().length > 0);
  const query = createQuery(() =>
    sharedLiveSpaceIdsSql({ memberId: memberId() })
  );
  const spaceIds = createMemo(() =>
    enabled() ? query.rows().map((r) => r.id) : []
  );
  return {
    get spaceIds() {
      return spaceIds();
    },
    get isLoading() {
      return enabled() && query.isLoading();
    },
  };
}
